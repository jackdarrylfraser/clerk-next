# Product and Operations Gaps

The repository has a useful foundation for membership checkout and protected
Markdown content, but the end-to-end acquisition, onboarding, sales, and
fulfillment process is not yet industry-leading. This assessment is based on
the application code; Clerk, Stripe, Resend, and DNS settings in deployed
environments have not been independently verified.

## Highest priority

### 1. Define the paid-content access model

RESOLVED: Members need to have an active site_access plan on their account to have access. If their payment fails they will lose access after their failed payment. if they cancel they will have access throughout the end of their billing period.

### 2. Add explicit marketing consent and email preferences

The contact flow creates a Resend contact and sends a confirmation, but the
application does not record explicit marketing consent, its source, or the
consent language/version. No double opt-in, preference center, unsubscribe
workflow, or suppression handling is evident in the application.

- Separate transactional messages from marketing subscriptions.
- Collect clear, unchecked-by-default consent for marketing email.
- Persist consent time, source/form, and the wording/version accepted.
- Implement confirmation, unsubscribe, and preference management before
  sending marketing campaigns.
- Configure sender-domain authentication and required marketing email footers
  in the email provider.

Relevant implementation: [contact form](./components/contact-form.tsx),
[contact endpoint](./app/api/contacts/route.ts), and
[email automation definitions](./emails/automations/definitions.ts).

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

The form confirmation says a message was received, but the form collects only
first name, last name, and email. The endpoint creates a contact; it does not
capture a message or show an application workflow that routes an inquiry to a
support inbox.

- If this is a support form, collect and securely route the message.
- If it is a marketing signup, make the consent and email expectations explicit
  and remove copy that implies a support request was submitted.

Relevant implementation: [contact form](./components/contact-form.tsx) and
[contact endpoint](./app/api/contacts/route.ts).

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

### 8. Add end-to-end journey tests

The application should have automated coverage of the full journey, not only
isolated flow helpers:

- Public visitor to signup and email verification.
- Consent capture and unsubscribe.
- Checkout success, failure, and retry.
- Access allowed and denied for each entitlement state.
- Webhook retries and idempotent email enrollment.
- Cancellation, payment failure, and access revocation.

## Existing strengths to preserve

- Server-side feature protection for member activities.
- Separate public and member Markdown directories, with sanitized Markdown
  rendering.
- Server-side contact validation, rate limiting, and idempotency.
- Signature verification for Clerk webhook requests.
- Clerk-managed checkout and account UI.

## External launch checks

This repository review cannot verify the deployed Clerk plan/feature
assignments, Stripe payment configuration, Resend automation state, sender
domain SPF/DKIM/DMARC, or production webhook secrets and delivery. Confirm and
test those settings separately in each environment before launch.
