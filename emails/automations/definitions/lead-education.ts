import type { AutomationDefinition } from "./types";

export const leadEducationDefinition: AutomationDefinition = {
  name: "Clerk Next — Lead education flow",
  purpose: "Send educational information requested through the lead form.",
  status: "enabled",
  event: {
    name: "marketing.opted_in",
    schema: {
      first_name: "string",
      last_name: "string",
      form_submission_id: "string",
      topic_key: "string",
    },
  },
  template: {
    name: "Lead education welcome",
    alias: "clerk-next-contact-submitted",
    subject: "A practical way to explore what matters",
    text: 'Hello,\n\nA useful way to learn about an important issue is to ask three questions: What is happening? Why does it matter? What can I do about it? Our educational emails use this framework to share practical explanations and next steps.\n\n<a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a>',
    html: `<p>Hello,</p>
<p>A useful way to learn about an important issue is to ask three questions: What is happening? Why does it matter? What can I do about it? Our educational emails use this framework to share practical explanations and next steps.</p>
<p><a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a></p>`,
  },
  steps: [
    {
      key: "lead_submitted",
      type: "trigger",
      config: { eventName: "marketing.opted_in" },
    },
    {
      key: "send_education",
      type: "send_email",
      config: {
        template: {
          id: "clerk-next-contact-submitted",
        },
      },
    },
  ],
  connections: [{ from: "lead_submitted", to: "send_education" }],
};
