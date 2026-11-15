import { describe, expect, it } from "bun:test";
import {
  createCancellationScheduledEmail,
  createPaymentFailedEmail,
  createSubscriptionEndedEmail,
  createSubscriptionPaymentFailedEmail,
  createSubscriptionRenewedEmail,
  createSubscriptionCanceledEmail,
  createSubscriptionCreatedEmail,
} from "./billing-notification-content";

describe("billing notification email content", () => {
  it("creates a subscription renewal notice", () => {
    expect(
      createSubscriptionRenewedEmail({ firstName: "Ada" }),
    ).toEqual({
      subject: "Your subscription payment was received",
      text: "Hello Ada,\n\nYour subscription renewal payment was received. Your access remains available through any period you've already paid for.",
      html: "<p>Hello Ada,</p>\n<p>Your subscription renewal payment was received. Your access remains available through any period you&#39;ve already paid for.</p>",
    });
  });

  it("creates a renewal payment failure notice", () => {
    expect(
      createSubscriptionPaymentFailedEmail({ firstName: "Ada" }).subject,
    ).toBe("Your subscription payment failed");
  });

  it("creates a cancellation scheduling notice with its effective date", () => {
    expect(
      createCancellationScheduledEmail({
        firstName: "Ada",
        cancellationDate: "2026-12-01",
      }),
    ).toEqual({
      subject: "Your subscription cancellation is scheduled",
      text: "Hello Ada,\n\nYour subscription is scheduled to end on 2026-12-01. Your access remains available through any period you've already paid for.",
      html: "<p>Hello Ada,</p>\n<p>Your subscription is scheduled to end on 2026-12-01. Your access remains available through any period you&#39;ve already paid for.</p>",
    });
  });

  it("creates a subscription-ended notice", () => {
    expect(
      createSubscriptionEndedEmail({ firstName: "Ada" }).subject,
    ).toBe("Your subscription has ended");
  });

  it("creates a subscription confirmation", () => {
    expect(
      createSubscriptionCreatedEmail({
        firstName: "Ada",
        planName: "Pro",
      }),
    ).toEqual({
      subject: "Your subscription is confirmed",
      text: "Hello Ada,\n\nYour Pro subscription has been created.",
      html: "<p>Hello Ada,</p>\n<p>Your Pro subscription has been created.</p>",
    });
  });

  it("creates a payment failure notice", () => {
    expect(
      createPaymentFailedEmail({
        firstName: "Ada",
        planName: "Pro",
      }),
    ).toEqual({
      subject: "Your payment couldn't be processed",
      text: "Hello Ada,\n\nWe couldn't process a payment for your Pro subscription. Please review your billing details in your account.",
      html: "<p>Hello Ada,</p>\n<p>We couldn&#39;t process a payment for your Pro subscription. Please review your billing details in your account.</p>",
    });
  });

  it("creates a cancellation notice and escapes payer-provided values in HTML", () => {
    const email = createSubscriptionCanceledEmail({
      firstName: "<Ada>",
      planName: `Pro & "More"`,
    });

    expect(email.subject).toBe("A subscription item has been canceled");
    expect(email.text).toBe(
      `Hello <Ada>,\n\nThe Pro & "More" subscription item has been canceled.`,
    );
    expect(email.html).toBe(
      "<p>Hello &lt;Ada&gt;,</p>\n<p>The Pro &amp; &quot;More&quot; subscription item has been canceled.</p>",
    );
  });
});
