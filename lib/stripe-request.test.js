import { describe, expect, it } from "bun:test";
import {
  isStripeRequestOriginAllowed,
  readStripeRequestBody,
} from "./stripe-request.ts";

describe("Stripe request helpers", () => {
  it("allows missing origins and requires present origins to match the app", () => {
    expect(
      isStripeRequestOriginAllowed(null, "https://example.com"),
    ).toBe(true);
    expect(
      isStripeRequestOriginAllowed(
        "https://example.com",
        "https://example.com/account",
      ),
    ).toBe(true);
    expect(
      isStripeRequestOriginAllowed(
        "https://attacker.example",
        "https://example.com",
      ),
    ).toBe(false);
    expect(
      isStripeRequestOriginAllowed("not a URL", "https://example.com"),
    ).toBe(false);
  });

  it("distinguishes malformed JSON from valid request content", async () => {
    await expect(
      readStripeRequestBody(
        new Request("https://example.com/api", {
          method: "POST",
          body: "{",
        }),
      ),
    ).resolves.toEqual({ success: false });

    await expect(
      readStripeRequestBody(
        new Request("https://example.com/api", {
          method: "POST",
          body: '{"customerId":"cus_123"}',
        }),
      ),
    ).resolves.toEqual({
      success: true,
      value: { customerId: "cus_123" },
    });
  });
});
