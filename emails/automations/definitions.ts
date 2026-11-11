import type {
  AutomationConnection,
  AutomationStatus,
  AutomationStep,
  CreateTemplateOptions,
  EventSchemaMap,
} from "resend";

type AutomationDefinition = {
  name: string;
  purpose: string;
  status: AutomationStatus;
  event: {
    name: string;
    schema: EventSchemaMap;
  };
  template: {
    name: string;
    alias: string;
    subject: string;
    text: string;
    html: string;
    variables?: NonNullable<CreateTemplateOptions["variables"]>;
  };
  steps: AutomationStep[];
  connections: AutomationConnection[];
};

export const automationDefinitions: AutomationDefinition[] = [
  {
    name: "Clerk Next — Contact submission confirmation",
    purpose: "Confirm that an educational email signup was received.",
    status: "enabled",
    event: {
      name: "contact.submitted",
      schema: {
        first_name: "string",
        last_name: "string",
      },
    },
    template: {
      name: "Contact submission confirmation",
      alias: "clerk-next-contact-submitted",
      subject: "Thanks for signing up for learning updates",
      text: "Hello,\n\nThanks for signing up for educational emails. We'll share practical learning about what matters, why it matters, and how to put ideas into practice.",
      html: `<p>Hello,</p>
<p>Thanks for signing up for educational emails. We'll share practical learning about what matters, why it matters, and how to put ideas into practice.</p>`,
    },
    steps: [
      {
        key: "contact_submitted",
        type: "trigger",
        config: { eventName: "contact.submitted" },
      },
      {
        key: "send_confirmation",
        type: "send_email",
        config: {
          template: {
            id: "clerk-next-contact-submitted",
          },
        },
      },
    ],
    connections: [{ from: "contact_submitted", to: "send_confirmation" }],
  },
  {
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
  },
];
