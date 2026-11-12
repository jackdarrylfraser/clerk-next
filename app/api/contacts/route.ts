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
  const rateLimitResult = await checkContactRateLimit(request);
  const submissionResult = await parseContactSubmission(
    request,
    rateLimitResult,
  );
  const claimResult = await claimContactSubmission(submissionResult);
  const topicResult = await getMarketingTopicId(claimResult);
  const contactResult = await saveContact(topicResult);
  const automationResult = await deliverMarketingOptInEvent(contactResult);
  const completionResult = await completeContactSubmission(automationResult);

  return createContactSuccessResponse(completionResult);
}

type ValidatedContactSubmission = {
  data: z.infer<typeof contactSchema>;
  topicName: string;
  email: string;
};

type ClaimedContactSubmission = ValidatedContactSubmission & {
  token: string;
  resend: Resend;
};

type ContactWithMarketingTopic = ClaimedContactSubmission & {
  marketingTopicId: string;
};

type SavedContactSubmission = ContactWithMarketingTopic & {
  contactCreated: boolean;
};

function createContactSuccessResponse(
  result: SavedContactSubmission | Response,
): Response {
  if (result instanceof Response) {
    return result;
  }

  return Response.json(
    { success: true },
    { status: result.contactCreated ? 201 : 200 },
  );
}

async function checkContactRateLimit(
  request: Request,
): Promise<Response | undefined> {
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

  return undefined;
}

async function parseContactSubmission(
  request: Request,
  previousResponse?: Response,
): Promise<ValidatedContactSubmission | Response> {
  if (previousResponse) {
    return previousResponse;
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
  return {
    data: parsed.data,
    topicName: topicDefinition.name,
    email: parsed.data.email.toLowerCase(),
  };
}

async function claimContactSubmission(
  submission: ValidatedContactSubmission | Response,
): Promise<ClaimedContactSubmission | Response> {
  if (submission instanceof Response) {
    return submission;
  }

  let claim: Awaited<ReturnType<typeof contactIdempotency.begin>>;
  try {
    claim = await contactIdempotency.begin(submission.data.submissionId);
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

  return {
    ...submission,
    token: claim.token,
    resend: new Resend(env.RESEND_API_KEY),
  };
}

async function getMarketingTopicId(
  submission: ClaimedContactSubmission | Response,
): Promise<ContactWithMarketingTopic | Response> {
  if (submission instanceof Response) {
    return submission;
  }

  try {
    const topicList = await submission.resend.topics.list();
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
      (topic) => topic.name === submission.topicName,
    );
    if (matches.length !== 1) {
      console.error("Expected exactly one Resend marketing topic", {
        topicName: submission.topicName,
        matchCount: matches.length,
      });
      return Response.json(
        { error: "Contact submissions are temporarily unavailable." },
        { status: 503 },
      );
    }

    return { ...submission, marketingTopicId: matches[0].id };
  } catch (error) {
    console.error("Resend marketing topic lookup request failed", error);
    return Response.json(
      { error: "Contact submissions are temporarily unavailable." },
      { status: 503 },
    );
  }
}

async function saveContact(
  submission: ContactWithMarketingTopic | Response,
): Promise<SavedContactSubmission | Response> {
  if (submission instanceof Response) {
    return submission;
  }

  const marketingTopic = {
    id: submission.marketingTopicId,
    subscription: "opt_in" as const,
  };

  try {
    const result = await submission.resend.contacts.create({
      email: submission.email,
      firstName: submission.data.firstName,
      lastName: submission.data.lastName,
      topics: [marketingTopic],
    });

    if (result.error) {
      if (result.error.statusCode === 409) {
        const updateResponse = await updateExistingContact(
          submission.resend,
          submission,
          marketingTopic,
        );
        if (updateResponse) {
          return updateResponse;
        }
        return { ...submission, contactCreated: false };
      }

      console.error("Resend contact creation failed", {
        name: result.error.name,
        statusCode: result.error.statusCode,
      });
      return Response.json(
        { error: "We couldn't save your contact. Please try again." },
        { status: 502 },
      );
    }

    if (!result.data) {
      console.error("Resend contact creation returned no contact data");
      return Response.json(
        {
          error:
            "We couldn't confirm your contact was saved. Please try again.",
        },
        { status: 502 },
      );
    }

    return { ...submission, contactCreated: true };
  } catch (error) {
    console.error("Resend contact creation request failed", error);
    return Response.json(
      { error: "We couldn't save your contact. Please try again." },
      { status: 502 },
    );
  }
}

async function updateExistingContact(
  resend: Resend,
  submission: ValidatedContactSubmission,
  marketingTopic: { id: string; subscription: "opt_in" },
): Promise<Response | undefined> {
  const updateResult = await resend.contacts.update({
    email: submission.email,
    firstName: submission.data.firstName,
    lastName: submission.data.lastName,
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
    email: submission.email,
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

  return undefined;
}

async function deliverMarketingOptInEvent(
  submission: SavedContactSubmission | Response,
): Promise<SavedContactSubmission | Response> {
  if (submission instanceof Response) {
    return submission;
  }

  try {
    const automation = await sendMarketingOptInEvent({
      submissionId: submission.data.submissionId,
      email: submission.email,
      firstName: submission.data.firstName,
      lastName: submission.data.lastName,
      topicKey: submission.data.topicKey,
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

    return submission;
  } catch (error) {
    console.error("Contact automation event delivery failed", error);
    return Response.json(
      { error: "We couldn't enroll your contact. Please try again." },
      { status: 502 },
    );
  }
}

async function completeContactSubmission(
  submission: SavedContactSubmission | Response,
): Promise<SavedContactSubmission | Response> {
  if (submission instanceof Response) {
    return submission;
  }

  try {
    const completed = await contactIdempotency.complete(
      submission.data.submissionId,
      submission.token,
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

    return submission;
  } catch (error) {
    console.error("Contact idempotency completion failed", error);
    return Response.json(
      {
        error: "We couldn't confirm your contact was saved. Please try again.",
      },
      { status: 503 },
    );
  }
}
