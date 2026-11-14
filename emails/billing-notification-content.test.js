import { describe, expect, it } from "bun:test";
import {
  createPaymentFailedEmail,
  createSubscriptionCanceledEmail,
  createSubscriptionCreatedEmail,
} from "./billing-notification-content";

describe("billing notification email content", () => {
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
