import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyVercelWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  const normalizedSignature = signature?.replace(/^sha1=/i, "").trim();
  if (
    !normalizedSignature ||
    !/^[a-f\d]{40}$/i.test(normalizedSignature)
  ) {
    return false;
  }

  const expected = createHmac("sha1", secret).update(rawBody).digest();
  const supplied = Buffer.from(normalizedSignature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
