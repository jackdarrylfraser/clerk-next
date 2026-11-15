import { createHmac } from "node:crypto";
import { describe, expect, it } from "bun:test";
import { verifyVercelWebhookSignature } from "./vercel-webhook-signature.ts";

describe("Vercel webhook signature verification", () => {
  const body = JSON.stringify({ type: "deployment.promoted" });
  const secret = "vercel_webhook_secret";

  it("accepts a valid SHA-1 HMAC signature", () => {
    const signature = createHmac("sha1", secret).update(body).digest("hex");

    expect(verifyVercelWebhookSignature(body, signature, secret)).toBe(true);
    expect(verifyVercelWebhookSignature(body, `sha1=${signature}`, secret)).toBe(
      true,
    );
  });

  it("rejects missing, malformed, or invalid signatures", () => {
    expect(verifyVercelWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyVercelWebhookSignature(body, "invalid", secret)).toBe(false);
    expect(
      verifyVercelWebhookSignature(body, "0".repeat(40), secret),
    ).toBe(false);
  });
});
