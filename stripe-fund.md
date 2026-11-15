# Stripe Implementation in Small Steps

This is a build order for implementing the Stripe plan from the repository's
pre-Stripe billing setup, in small, reviewable slices. Aim for roughly 200
changed lines per slice, but keep each slice coherent and verifiable rather
than splitting a file mid-feature.

## Starting point

Begin with the existing Clerk Billing flow, its multi-step subscribe pages and
webhook, and locally stored access-level records. The Stripe client,
user-to-Stripe-customer mapping, Stripe-based access lookup, Payment Link
checkout, and Stripe webhook flow described below still need to be added.
Do not treat any Stripe implementation files or migrations as prerequisites:
create them in the steps where they are introduced.

The ordering is deliberate: establish configuration and customer identity
first, build and test Stripe-based access next, then route the app through that
access rule before switching checkout and webhooks. Remove the old billing
system only after the new access gates and lifecycle handling are in place.

## Suggested implementation order

### 1. Stripe configuration

**Files:** `package.json`, `bun.lock`, `env.ts`, a new `lib/stripe.ts`, and the
configuration section of `README.md`.

Add the Stripe SDK, validate the server secret, webhook secret, and public
Payment Link URLs, then expose a server-only Stripe client. Don’t add billing
behavior in this slice.

**Check:** `bunx tsc --noEmit`.

### 2. Customer mapping

**Files:** `db/schema.ts`, a new `lib/stripe-customers.ts`, and `drizzle/`.

Add a mapping that allows multiple Stripe customers per app user while
ensuring each Stripe customer maps to at most one user. Add lookup helpers and
generate/check the migration.

For a staged production rollout, make this migration additive first. Drop the
legacy `user_access` table only after the app no longer reads or writes it.

**Check:** `bunx drizzle-kit check`.

### 3. Stripe access lookup and cache

**Files:** new `lib/stripe-access-policy.ts`, `lib/stripe-access.test.js`, and
`lib/stripe-access.ts`.

Implement access from paid invoice period ends (and trial ends where
applicable), not from locally stored subscription status. Cache positive
results only until paid-through expiry; use a short default TTL for denied
results. Surface Stripe or Redis failures instead of granting from stale
state.

**Check:** `bun test lib/stripe-access.test.js`.

### 4. Route access through the new rule

**Files:** `lib/server-access.ts`, `app/page.tsx`,
`app/activity/[content]/page.tsx`, and `app/activity/tag/[slug]/page.tsx`.

Replace access-level lookups on member pages with the Stripe access helper.
Keep guest content gated by sign-in only; it should not make unnecessary
Stripe calls.

**Check:** `bunx tsc --noEmit` and the focused access tests.

### 5. Public Payment Links

**Files:** `app/subscribe/plan/page.tsx`, `app/subscribe/page.tsx`, and the
legacy subscribe account/payment pages.

Replace the Clerk plan picker and account-before-checkout steps with monthly
and annual Payment Link buttons. A visitor should be able to check out without
an app account. Keep the Stripe URLs in configuration, not in code.

**Check:** `bun run build`.

### 6. Checkout return and provisioning status

**Files:** `app/subscribe/success/page.tsx`,
`app/api/stripe/checkout-status/route.ts`, and
`components/subscribe/checkout-provisioning-status.tsx`.

Retrieve the Checkout Session from Stripe on the success page, display its
purchase details, and poll only for the user-to-customer mapping. Never save a
Checkout Session ID as a billing record.

**Check:** `bun run build`; verify incomplete payment and still-provisioning
states as well as a completed purchase.

### 7. Signed webhook and checkout provisioning

**Files:** `app/api/webhooks/stripe/route.ts` and
`lib/stripe-webhook.ts`.

Verify the signature over the raw body and make event processing idempotent
with the shared KV package. First implement only successful subscription
checkout: normalize the email, find or create the Better Auth user, save the
customer mapping, invalidate access cache, and send sign-in instructions.

**Check:** test invalid signatures, duplicate events, missing customer data,
and an existing user before adding more event types.

### 8. Lifecycle events and notifications

**Files:** `lib/stripe-webhook.ts`,
`emails/billing-notification-content.ts`, and its tests.

Add subscription-cycle renewal, failed-payment, newly scheduled cancellation,
and deleted-subscription handling. Invalidate the user’s access cache when
billing changes, but never write a local subscription snapshot. Use stable
Resend idempotency keys per Stripe event.

**Check:** `bun test emails/billing-notification-content.test.js` and webhook
event tests.

### 9. Stripe-hosted billing management

**Files:** `app/account/[[...account]]/page.tsx`,
`app/api/stripe/portal/route.ts`, and
`components/subscribe/stripe-portal-button.tsx`.

Let signed-in users open Stripe’s hosted billing portal. Verify the requested
customer belongs to the current user before creating a portal session.

**Check:** verify unauthenticated and mismatched-customer requests are
rejected.

### 10. Remove legacy billing and finish

**Files:** old Clerk billing webhook and subscribe-flow files, `lib/better-auth.ts`,
`scripts/seed-admin.ts`, `README.md`, and the final database migration.

Remove unused Clerk Billing code and persisted access-level behavior only
after the Stripe access gates are active. Update setup instructions, then run
`bun run lint`, `bun test`, `bunx drizzle-kit check`, and `bun run build`.

## Completion criteria

- Stripe is the source of truth for access and billing lifecycle.
- The database stores only Better Auth data and user-to-customer mappings.
- Checkout works before sign-in; webhook provisioning does not depend on the
  customer returning to the success page.
- Stripe/Redis failures are visible and never silently grant paid access.
