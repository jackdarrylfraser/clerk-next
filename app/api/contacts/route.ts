import { Resend } from "resend";
import { z } from "zod";
import {
  createIdempotencyStore,
  createRateLimiter,
  createRedisClient,
  getIpRateLimitIdentifier,
} from "@clerk-next/kv";
import { env } from "@/env";

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
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
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
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Enter your first name, last name, and a valid email address." },
      { status: 400 },
    );
  }

  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (idempotencyKey && idempotencyKey.length > 255) {
    return Response.json(
      { error: "The idempotency key must be 255 characters or fewer." },
      { status: 400 },
    );
  }

  let claim: Awaited<ReturnType<typeof contactIdempotency.begin>> | undefined;
  if (idempotencyKey) {
    try {
      claim = await contactIdempotency.begin(idempotencyKey);
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
  }

  const resend = new Resend(env.RESEND_API_KEY);
  let result: Awaited<ReturnType<typeof resend.contacts.create>>;

  try {
    result = await resend.contacts.create({
      email: parsed.data.email.toLowerCase(),
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
    });
  } catch (error) {
    console.error("Resend contact creation request failed", error);
    return Response.json(
      { error: "We couldn't save your contact. Please try again." },
      { status: 502 },
    );
  }

  if (result.error) {
    if (result.error.statusCode === 409) {
      return Response.json(
        { error: "This email address is already a contact." },
        { status: 409 },
      );
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
      { error: "We couldn't confirm your contact was saved. Please try again." },
      { status: 502 },
    );
  }

  if (idempotencyKey && claim?.status === "claimed") {
    try {
      const completed = await contactIdempotency.complete(
        idempotencyKey,
        claim.token,
      );
      if (!completed) {
        console.error("Contact idempotency claim expired before completion");
        return Response.json(
          { error: "We couldn't confirm your contact was saved. Please try again." },
          { status: 503 },
        );
      }
    } catch (error) {
      console.error("Contact idempotency completion failed", error);
      return Response.json(
        { error: "We couldn't confirm your contact was saved. Please try again." },
        { status: 503 },
      );
    }
  }

  return Response.json({ success: true }, { status: 201 });
}
