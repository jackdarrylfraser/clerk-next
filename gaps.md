# Product and Operations Gaps

The repository has a useful foundation for membership checkout and protected
Markdown content, but the end-to-end acquisition, onboarding, sales, and
fulfillment process is not yet industry-leading. This assessment is based on
the application code; Clerk, Stripe, Resend, and DNS settings in deployed
environments have not been independently verified.

## Highest priority

### 3. Complete signup and customer onboarding

The application defines a subscription welcome automation, but no application
workflow for a newly created account or a sequenced onboarding journey. Clerk
may send account verification or security emails from its own configuration;
that does not provide product onboarding or marketing nurture.

- Define separate account-created, purchase-confirmation, and member-onboarding
  messages.
- Create a useful first-session path that helps a new member find and consume
  their purchased content.
- Add behavior-based follow-up only where the user has given appropriate
  consent.
- Handle retries and duplicate webhook deliveries without sending duplicate
  messages.

Relevant implementation: [Clerk webhook handler](./app/api/webhooks/clerk/route.ts)
and [automation definitions](./emails/automations/definitions.ts).

### 4. Make terms acceptance durable and complete

Plan-terms acceptance is stored in browser `sessionStorage`; it is not a
server-side audit record. The current subscription terms are brief template
copy rather than a complete set of customer-facing policies.

- Persist the accepting user, timestamp, terms version, plan, billing period,
  and displayed price in a durable record.
- Make accepted terms retrievable for support and compliance.
- Provide complete, reviewed terms and privacy information, including relevant
  renewal, cancellation, refund, and contact details.

Relevant implementation: [terms acceptance](./lib/plan-terms.ts) and
[subscription terms](./terms/subscription-terms.tsx).

## Important growth and reliability gaps

### 5. Turn the public site into a clear acquisition and sales funnel

The homepage has generic membership copy, while the public Markdown index is
presented as “More pages.” The site-level title and description are also generic.
The application does not show a clear lead magnet, source attribution, or funnel
measurement.

- Explain the audience, outcomes, and value of the membership on the landing
  page.
- Show representative public content and a specific reason to subscribe.
- Add per-page metadata for public Markdown pages and measure the path from
  landing page to signup and checkout.
- Capture attribution such as campaign/source where appropriate and with
  appropriate privacy disclosures.

Relevant implementation: [homepage](./app/page.tsx),
[public pages index](./app/more/page.tsx),
[public Markdown page](./app/more/[slug]/page.tsx), and
[layout metadata](./app/layout.tsx).

### 6. Align the contact form with its purpose

RESOLVED: The public form is an educational email signup, not a support
inquiry. It now explains its purpose and requires explicit marketing consent.
No support-inquiry form or inbox workflow is provided.

Relevant implementation: [lead capture form](./components/lead-capture-form.tsx)
and [contact endpoint](./app/api/contacts/route.ts).

### 7. Cover the full subscription lifecycle

The Clerk webhook currently handles `subscription.created` for the welcome
automation. Application-level workflows for renewal, payment trouble,
cancellation, and recovery are not evident. Clerk may provide some of these
behaviors directly, so verify the live configuration rather than assuming they
are absent from the whole service.

- Decide which lifecycle notices and recovery steps should be handled by Clerk
  and which by the application.
- Test entitlement behavior across active, canceled, past-due, and expired
  states.
- Add monitoring and a documented way to inspect and replay failed events.

Relevant implementation: [Clerk webhook handler](./app/api/webhooks/clerk/route.ts).
