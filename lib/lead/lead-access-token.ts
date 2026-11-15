import { createHmac, timingSafeEqual } from "node:crypto";

export const leadAccessCookieName = "lead-access";

export type LeadAccessTokenPayload = {
  leadId: string;
  expiresAt: number;
};

export function createLeadAccessToken(
  payload: LeadAccessTokenPayload,
  secret: string,
): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyLeadAccessToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): LeadAccessTokenPayload | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature, ...rest] = token.split(".");
  if (
    !encodedPayload ||
    !signature ||
    rest.length > 0 ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  ) {
    return null;
  }

  const expectedSignature = Buffer.from(
    sign(encodedPayload, secret),
    "base64url",
  );
  const receivedSignature = Buffer.from(signature, "base64url");
  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
  } catch {
    return null;
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("leadId" in payload) ||
    typeof payload.leadId !== "string" ||
    !("expiresAt" in payload) ||
    typeof payload.expiresAt !== "number" ||
    !Number.isSafeInteger(payload.expiresAt) ||
    payload.expiresAt <= now
  ) {
    return null;
  }

  return { leadId: payload.leadId, expiresAt: payload.expiresAt };
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`lead-access-v1.${value}`)
    .digest("base64url");
}
