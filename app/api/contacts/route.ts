import { Resend } from "resend";
import { z } from "zod";
import {
  createRateLimiter,
  getIpRateLimitIdentifier,
} from "@clerk-next/kv";
import { env } from "@/env";
import { getRedisClient } from "@/lib/kv";
import { sendMarketingOptInEvent } from "@/emails/automations/events";
import { isMarketingTopicKey } from "@/lib/marketing-topics";

const limitContactSubmissions = createRateLimiter({
  getRedisClient,
  limit: 5,
  window: "10 m",
  prefix: "clerk-next:contact",
  timeoutMs: 1_000,
});

const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(128),
  marketingConsent: z.literal(true),
});

export async function POST(request: Request): Promise<Response> {
  const rateLimitResult = await checkContactRateLimit(request);
  const submissionResult = await parseContactSubmission(
    request,
    rateLimitResult,
  );
  if (submissionResult instanceof Response) {
    return submissionResult;
  }

  const claimedSubmission = {
    ...submissionResult,
    resend: new Resend(env.RESEND_API_KEY),
  };

  try {
    const savedContact = await saveContact(claimedSubmission);
    if (savedContact instanceof Response) {
      return savedContact;
    }

    const deliveredEvent = await deliverMarketingOptInEvent(savedContact);
    if (deliveredEvent instanceof Response) {
      return deliveredEvent;
    }

    return Response.json(
      { success: true },
      { status: deliveredEvent.contactCreated ? 201 : 200 },
    );
  } catch (error) {
    console.error("Contact submission processing failed", error);
    return Response.json(
      {
        error: "We couldn't confirm your contact was saved. Please try again.",
      },
      { status: 503 },
    );
  }
}

type ValidatedContactSubmission = {
  data: z.infer<typeof contactSchema>;
  email: string;
};

type ClaimedContactSubmission = ValidatedContactSubmission & {
  resend: Resend;
};

type SavedContactSubmission = ClaimedContactSubmission & {
  contactCreated: boolean;
};

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

  return {
    data: parsed.data,
    email: parsed.data.email.toLowerCase(),
  };
}

async function saveContact(
  submission: ClaimedContactSubmission | Response,
): Promise<SavedContactSubmission | Response> {
  if (submission instanceof Response) {
    return submission;
  }

  try {
    const result = await submission.resend.contacts.create({
      email: submission.email,
      firstName: submission.data.firstName,
      lastName: submission.data.lastName,
    });

    if (result.error) {
      if (result.error.statusCode === 409) {
        const updateResponse = await updateExistingContact(submission);
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
  submission: ClaimedContactSubmission,
): Promise<Response | undefined> {
  const updateResult = await submission.resend.contacts.update({
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
      email: submission.email,
      firstName: submission.data.firstName,
      lastName: submission.data.lastName,
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
