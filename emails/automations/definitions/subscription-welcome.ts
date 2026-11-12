import type { AutomationDefinition } from "./types";

export const subscriptionWelcomeDefinition: AutomationDefinition = {
  name: "Clerk Next — Subscription welcome",
  purpose: "Welcome a customer after their Clerk subscription is created.",
  status: "enabled",
  event: {
    name: "subscription.created",
    schema: {
      subscription_id: "string",
      first_name: "string",
      last_name: "string",
    },
  },
  template: {
    name: "Subscription welcome",
    alias: "clerk-next-subscription-created",
    subject: "Thanks for subscribing",
    text: "Hello,\n\nThanks for subscribing. You can visit your account any time to review your subscription.",
    html: `<p>Hello,</p>
<p>Thanks for subscribing. You can visit your account any time to review your subscription.</p>`,
  },
  steps: [
    {
      key: "subscription_created",
      type: "trigger",
      config: { eventName: "subscription.created" },
    },
    {
      key: "send_welcome",
      type: "send_email",
      config: {
        template: {
          id: "clerk-next-subscription-created",
        },
      },
    },
  ],
  connections: [{ from: "subscription_created", to: "send_welcome" }],
};
