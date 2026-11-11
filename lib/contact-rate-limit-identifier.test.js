import { describe, expect, it } from "bun:test";
import { getContactRateLimitIdentifier } from "./contact-rate-limit-identifier";

describe("contact rate limit identifier", () => {
  it("uses a valid forwarded IPv4 or IPv6 address", () => {
    expect(
      getContactRateLimitIdentifier(
        new Headers({ "x-forwarded-for": "203.0.113.4" }),
        "production",
      ),
    ).toBe("ip:203.0.113.4");
    expect(
      getContactRateLimitIdentifier(
        new Headers({ "x-forwarded-for": "2001:db8::1" }),
        "production",
      ),
    ).toBe("ip:2001:db8::1");
  });

  it("rejects invalid forwarded addresses and missing production IPs", () => {
    expect(
      getContactRateLimitIdentifier(
        new Headers({ "x-forwarded-for": "not-an-ip" }),
        "production",
      ),
    ).toBeNull();
    expect(getContactRateLimitIdentifier(new Headers(), "production")).toBeNull();
  });

  it("uses a shared identifier for local development without a forwarded IP", () => {
    expect(getContactRateLimitIdentifier(new Headers(), "development")).toBe(
      "local-development",
    );
  });
});
