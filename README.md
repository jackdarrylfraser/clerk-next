# Subscription checkout

The subscription flow has three pages: choose a Clerk Billing user plan at `/`, create an account or sign in at `/subscribe/account`, and complete secure checkout at `/subscribe/payment`. The selected plan and billing period travel in the URL so authentication redirects and browser refreshes can resume the flow. After checkout, customers are sent to `/account`, which uses Clerk's profile and billing management UI.

## Clerk configuration

- Configure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `.env.local`.
- Enable [Clerk Billing for users](https://clerk.com/docs/nextjs/guides/billing/for-b2c), connect a payment provider, and create publicly visible user plans in the Clerk Dashboard. The checkout uses the live plan names, prices, features, and trial settings; no plan IDs are hard-coded.
- Enable the desired sign-in and sign-up methods in Clerk. Clerk's embedded authentication handles the configured verification and multi-factor requirements. Checkout must authenticate before securely collecting payment details.
- Test payments in a development instance with [Stripe test cards](https://docs.stripe.com/testing). Clerk Billing checkout APIs are experimental; see [Clerk's version pinning guidance](https://clerk.com/docs/pinning) before deploying.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

To browse member activities without signing in locally, add `DEV_AUTH_BYPASS=true` to `.env.local` and restart the development server. This bypass is active only with `next dev`; production builds and deployments always use Clerk authentication and permissions. The `/account` page displays a notice instead of Clerk's profile while the bypass is enabled.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
