import { Resend } from "resend";
import { z } from "zod";
import {
  createIdempotencyStore,
  createRateLimiter,
  createRedisClient,
  getIpRateLimitIdentifier,
} from "@clerk-next/kv";
import { env } from "@/env";
import { sendMarketingOptInEvent } from "@/emails/automations/events";
import { isMarketingTopicKey, marketingTopics } from "@/lib/marketing-topics";

const getRedisClient = createRedisClient({
  redisUrl: env.UPSTASH_REDIS_REST_URL,
  redisToken: env.UPSTASH_REDIS_REST_TOKEN,
});

const limitContactSubmissions = createRateLimiter({
  getRedisClient,
  limit: 5,
  window: "10 m",
  prefix: "clerk-next:contact",
  timeoutMs: 1_000,
});

const contactIdempotency = createIdempotencyStore({
  getRedisClient,
  prefix: "clerk-next:contact",
});

const contactSchema = z.object({
  submissionId: z.uuid(),
  topicKey: z.string().min(1),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  marketingConsent: z.literal(true),
});

export async function POST(request: Request): Promise<Response> {
  const identifier = getIpRateLimitIdentifier(request.headers, env.NODE_ENV);
  if (!identifier) {
    console.error("Contact rate limiting could not determine the client IP");
    return Response.json(
      { error: "Contact submissions are temporarily unavailable." },
      { status: 503 },
    );
  }

  let rateLimit: Awaited<ReturnType<typeof limitContactSubmissions>>;
  try {
    rateLimit = await limitContactSubmissions(identifier);
  } catch (error) {
    console.error("Contact rate limit check failed", error);
    return Response.json(
      { error: "Contact submissions are temporarily unavailable." },
      { status: 503 },
    );
  }

  if (rateLimit.reason === "timeout") {
    console.error("Contact rate limit check timed out");
    return Response.json(
      { error: "Contact submissions are temporarily unavailable." },
      { status: 503 },
    );
  }

  if (!rateLimit.success) {
    const retryAfter = Math.max(
      1,
      Math.ceil((rateLimit.reset - Date.now()) / 1000),
    );
    return Response.json(
      { error: "Too many contact submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error:
          "Enter your name and a valid email address, and consent to receive educational emails.",
      },
      { status: 400 },
    );
  }

  if (!isMarketingTopicKey(parsed.data.topicKey)) {
    return Response.json(
      { error: "Select a valid email preference." },
      { status: 400 },
    );
  }

  const topicDefinition = marketingTopics[parsed.data.topicKey];
  const email = parsed.data.email.toLowerCase();
  const source = "lead-capture-form";

  let claim: Awaited<ReturnType<typeof contactIdempotency.begin>>;
  try {
    claim = await contactIdempotency.begin(parsed.data.submissionId);
  } catch (error) {
    console.error("Contact idempotency check failed", error);
    return Response.json(
      { error: "Contact submissions are temporarily unavailable." },
      { status: 503 },
    );
  }

  if (claim.status === "completed") {
    return Response.json({ success: true }, { status: 200 });
  }

  if (claim.status === "in-progress") {
    return Response.json(
      { error: "This submission is already being processed." },
      {
        status: 425,
        headers: { "Retry-After": String(claim.retryAfterSeconds) },
      },
    );
  }

  const resend = new Resend(env.RESEND_API_KEY);
  let marketingTopicId: string;
  try {
    const topicList = await resend.topics.list();
    if (topicList.error || !topicList.data) {
      console.error("Resend marketing topic lookup failed", {
        name: topicList.error?.name,
        statusCode: topicList.error?.statusCode,
      });
      return Response.json(
        { error: "Contact submissions are temporarily unavailable." },
        { status: 503 },
      );
    }

    const matches = topicList.data.data.filter(
      (topic) => topic.name === topicDefinition.name,
    );
    if (matches.length !== 1) {
      console.error("Expected exactly one Resend marketing topic", {
        topicName: topicDefinition.name,
        matchCount: matches.length,
      });
      return Response.json(
        { error: "Contact submissions are temporarily unavailable." },
        { status: 503 },
      );
    }

    marketingTopicId = matches[0].id;
  } catch (error) {
    console.error("Resend marketing topic lookup request failed", error);
    return Response.json(
      { error: "Contact submissions are temporarily unavailable." },
      { status: 503 },
    );
  }

  let contactCreated = true;
  const marketingTopic = {
    id: marketingTopicId,
    subscription: "opt_in" as const,
  };

  try {
    const result = await resend.contacts.create({
      email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      topics: [marketingTopic],
    });

    if (result.error) {
      if (result.error.statusCode === 409) {
        contactCreated = false;
        const updateResult = await resend.contacts.update({
          email,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
        });

        if (updateResult.error || !updateResult.data) {
          console.error("Resend contact update failed", {
            name: updateResult.error?.name,
            statusCode: updateResult.error?.statusCode,
          });
          return Response.json(
            { error: "We couldn't save your contact. Please try again." },
            { status: 502 },
          );
        }

        const topicResult = await resend.contacts.topics.update({
          email,
          topics: [marketingTopic],
        });

        if (topicResult.error || !topicResult.data) {
          console.error("Resend marketing topic enrollment failed", {
            name: topicResult.error?.name,
            statusCode: topicResult.error?.statusCode,
          });
          return Response.json(
            { error: "We couldn't enroll your contact. Please try again." },
            { status: 502 },
          );
        }
      } else {
        console.error("Resend contact creation failed", {
          name: result.error.name,
          statusCode: result.error.statusCode,
        });
        return Response.json(
          { error: "We couldn't save your contact. Please try again." },
          { status: 502 },
        );
      }
    } else if (!result.data) {
      console.error("Resend contact creation returned no contact data");
      return Response.json(
        {
          error:
            "We couldn't confirm your contact was saved. Please try again.",
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("Resend contact creation request failed", error);
    return Response.json(
      { error: "We couldn't save your contact. Please try again." },
      { status: 502 },
    );
  }

  try {
    const automation = await sendMarketingOptInEvent({
      submissionId: parsed.data.submissionId,
      email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      topicKey: parsed.data.topicKey,
    });

    if (automation.status === "in-progress") {
      return Response.json(
        { error: "This submission is already being processed." },
        {
          status: 425,
          headers: { "Retry-After": String(automation.retryAfterSeconds) },
        },
      );
    }
  } catch (error) {
    console.error("Contact automation event delivery failed", error);
    return Response.json(
      { error: "We couldn't enroll your contact. Please try again." },
      { status: 502 },
    );
  }

  try {
    const completed = await contactIdempotency.complete(
      parsed.data.submissionId,
      claim.token,
    );
    if (!completed) {
      console.error("Contact idempotency claim expired before completion");
      return Response.json(
        {
          error:
            "We couldn't confirm your contact was saved. Please try again.",
        },
        { status: 503 },
      );
    }
  } catch (error) {
    console.error("Contact idempotency completion failed", error);
    return Response.json(
      {
        error: "We couldn't confirm your contact was saved. Please try again.",
      },
      { status: 503 },
    );
  }

  return Response.json(
    { success: true },
    { status: contactCreated ? 201 : 200 },
  );
}
