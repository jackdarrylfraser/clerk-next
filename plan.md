Set up Better Auth and Turso

Create a fresh Turso database and Better Auth schema.
Implement the existing email-code sign-in experience with Better Auth and Resend.
Replace Clerk session checks and UI in the app, including the navigation, sign-in, and account pages.
Set up Lemon Squeezy

Create Lemon Squeezy products and variants for the planned monthly/yearly options.
Replace Clerk’s plan lookup and checkout in app/subscribe/payment/page.tsx.
Use Lemon Squeezy’s customer portal for subscription management.
Implement subscription state and access control

Store each user’s Lemon Squeezy customer/subscription IDs and subscription status in Turso.
Add a webhook endpoint that verifies Lemon Squeezy signatures and idempotently updates subscription records.
Replace Clerk entitlement checks for member content with server-side checks against the Turso subscription state.
Remove Clerk and verify

Remove Clerk dependencies, keys, middleware, webhook, and components; update env.ts and README.md.
Test sign-in, checkout, subscription changes, portal access, and member-content gating with fresh development accounts.
Keep the existing Resend contact workflows and Redis protections, which are separate from Clerk.
