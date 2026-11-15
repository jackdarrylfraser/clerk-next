# Stripe account billing portal plan

## Goal

Add a small billing-management section to the signed-in account page. Keep
subscription data and payment processing in Stripe; the app database continues
to store only Better Auth data and Stripe-customer-to-user mappings.

The Better Auth account remains the identity source. Never use a Stripe email
address to find, create, or change an app account.

## MVP experience

### Subscription overview

- Show subscriptions for every Stripe customer mapped to the signed-in user.
- Display the plan, price and billing interval, current status, and next renewal
  or scheduled cancellation date.
- Include active, trialing, and past-due subscriptions. Clearly distinguish
  subscriptions scheduled to cancel from subscriptions that have ended.
- Group subscriptions by mapped Stripe customer where a user has more than one.
- Read current data from Stripe; do not persist a local subscription snapshot.

### Billing email

- Let the user update the billing email on each mapped Stripe customer.
- Label this separately from the Better Auth sign-in email.
- Update only the selected Stripe customer's `email`; never copy it to the app
  user's email or use it for account matching.

### Cancel or keep a subscription

- Cancel at the end of the current paid period by setting
  `cancel_at_period_end: true`; do not immediately delete the subscription.
- Show the effective cancellation date and state that access continues through
  the time already paid for.
- Before the cancellation takes effect, allow the user to keep the subscription
  by setting `cancel_at_period_end: false`.
- Do not invalidate the access cache just because cancellation was scheduled,
  reversed, or completed. The existing paid-through cache expiry and Stripe
  access lookup remain authoritative.

### Update payment method

- Keep the account page custom, but use a Stripe Customer Portal session
  restricted to payment-method updates. This delegates card handling and
  authentication to Stripe without exposing the full billing portal.
- Configure the portal in Stripe Dashboard with payment-method updates enabled
  and unrelated features disabled.
- Return the user to the account page after the update.

## Implementation sequence

1. **Load a billing overview.** Add a server-side helper, such as
   `lib/stripe-account.ts`, that takes the authenticated Better Auth user ID,
   gets only that user's mapped Stripe customer IDs, and loads their customer
   and subscription details from Stripe. Do not search Stripe by email.
2. **Add the account billing UI.** Update
   `app/account/[[...account]]/page.tsx` to show the overview, billing-email
   controls, cancellation state/actions, and an update-payment-method button.
   Keep the existing account information and sign-out control.
3. **Implement billing-email updates.** Add a server endpoint that accepts a
   Stripe customer ID and a validated email. Require a signed-in user and
   verify that customer ID is mapped to that user before updating Stripe.
4. **Implement cancellation and undo.** Add a server endpoint that accepts the
   selected customer and subscription IDs plus the requested action. Verify
   the customer mapping and confirm the subscription belongs to that customer
   before updating it. Use period-end cancellation, not immediate deletion.
5. **Implement payment-method updates.** Add an endpoint that requires a
   signed-in user, verifies the requested customer mapping, and creates a
   Stripe Billing Portal session using the restricted configuration and a
   fixed account-page return URL. Add a button component to redirect to the
   returned Stripe URL.
6. **Keep lifecycle handling consistent.** The Stripe webhook may continue to
   send lifecycle notifications, but must not write subscription snapshots or
   invalidate access while paid-through access remains valid.
7. **Document Stripe setup.** Record the restricted Customer Portal
   configuration and any required server-side configuration in `README.md`.

## Security and failure behavior

- Derive the app user ID from the Better Auth session; never accept it from the
  browser.
- Treat submitted customer and subscription IDs as untrusted. Verify their
  ownership through the existing mapping and Stripe before every mutation.
- Fix the portal `return_url` on the server; do not accept arbitrary redirect
  URLs from the client.
- Return explicit errors when authentication, ownership checks, Stripe calls,
  or database lookups fail. Never report success if Stripe did not confirm the
  operation.
- Keep card data out of the app server and database.

## Tests and verification

- Unauthenticated requests cannot read or modify billing data.
- A customer mapped to another user, an unmapped customer, and a subscription
  belonging to a different customer are rejected.
- Billing-email changes update Stripe only, not the Better Auth user.
- Cancellation schedules for period end; undo clears the scheduled cancellation.
- Updating a payment method creates a portal session only for an owned
  customer and uses the fixed return URL.
- A user with no mapped customers sees an appropriate empty state and a link
  to subscribe.
- Run focused account-billing tests, `bunx tsc --noEmit`, `bun run lint`,
  `bun test`, and `bun run build`.

## Deferred

Plan changes, invoice history and receipt downloads, billing address and tax
details, coupons, and quantity changes can wait until the product needs them.
