# Outbound Endurance

If you're reading this six months from now, this is a small membership site
built with Next.js, Better Auth, Stripe, Resend, and Upstash Redis. Visitors
choose a membership plan, then sign in or create an account before checkout.
Stripe Checkout Sessions are created on the server for the signed-in user.

## What the app does

- **Authentication and account access:** Better Auth handles email-code
  sign-in and session management. Account pages, account APIs, and member
  content require active Stripe access; users without it are sent to the
  subscription page.
- **Billing:** Stripe provides subscription access and server-created Checkout
  Sessions. Checkout requires a Better Auth session; Stripe customer IDs are
  linked to that existing user by a signed webhook. Stripe-provided email
  addresses are not used to find or create app accounts.
- **Member content:** The home page lists paginated activities from
  `content/self-guided` for users with Stripe access. Individual activity pages
  and tags use the same access rule.
- **Public content:** Markdown files in `content/public` are listed at
  `/public`, rendered at `/public/<slug>`, and filterable by tag. Public pages also
  include the contact form.
- **Guest content:** Markdown files in `content/guest` are listed at
  `/guest`, rendered at `/guest/<slug>`, and filterable by starter tags.
  Access requires a valid lead-verification cookie. Signing in or having a
  subscription does not grant guest-content access.
- **Contact capture:** The form posts names, email, and explicit marketing
  consent to `/api/contacts`. The endpoint records consent details, adds the
  contact to Resend's Marketing topic, and starts an educational email
  automation. This is an information request, not an account signup; it does
  not send a signup-confirmation email.
- **Email automations:** Lead opt-ins trigger the education automation; Stripe
  checkout and subscription lifecycle events send billing notifications
  directly. Automation resources are declared in
  `emails/automations/definitions.ts` and can be synced to Resend.
- **Abuse and duplicate protection:** Upstash Redis backs a five-submission
  per IP, per ten-minute contact limit and idempotency records for contact and
  subscription event delivery. If Redis is missing or unavailable, these
  operations fail rather than running without protection.
- **Local member-content preview:** `DEV_AUTH_BYPASS=true` in development lets
  you browse self-guided and guest content without signing in. It does not
  create a Better Auth session, so account access still requires a real
  self-guided or admin session.

## Start here

Use Bun (the repo's package manager):

```sh
bun install
bun run dev
```

Create `.env.local` with the Better Auth, database, Stripe, and Resend
keys below, then open
<http://localhost:3000>. To preview member content without signing in,
also set `DEV_AUTH_BYPASS=true` and restart the dev server. The bypass is
disabled outside development.

Useful commands:

```sh
bun run dev          # local app
bun run build        # sync Stripe catalog, then create production build
bun run start        # serve a production build
bun test             # tests
bun run lint         # ESLint
bun run db:generate  # generate migrations from db/schema.ts
bun run db:migrate   # apply generated migrations to Turso
bun run db:studio    # inspect the database
bun run emails:sync  # create/update declared Resend email resources
bun run stripe:sync  # create/update declared Stripe Product and Price
```

## Services and configuration

`env.ts` validates the app's environment variables. Configure them in
`.env.local` locally and in the deployment environment (for example, Vercel)
for production. Never commit real values.

| Variable | Needed for |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe server-side API access; required to run/build the app |
| `STRIPE_WEBHOOK_SECRET` | Verifying Stripe webhook deliveries |
| `STRIPE_PAYMENT_METHOD_PORTAL_CONFIGURATION_ID` | Optional Stripe Customer Portal configuration used for payment-method updates |
| `VERCEL_WEBHOOK_SECRET` | Optional signing secret for the Vercel production-promotion webhook |
| `VERCEL_WEBHOOK_PROJECT_ID` | Vercel project ID allowed to trigger old-Price cleanup |
| `BETTER_AUTH_SECRET` | Better Auth session signing; use a random secret of at least 32 characters |
| `BETTER_AUTH_URL` | Better Auth application URL, such as `http://localhost:3000` |
| `RESEND_API_KEY` | Resend contact, event, and transactional email APIs; required to run/build the app |
| `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` | Turso database used by Drizzle and Better Auth |
| `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` | Contact rate limiting and idempotency for contact/subscription events; both must be set |
| `RESEND_FROM_EMAIL` | Verified sender for billing emails and `bun run emails:sync` |
| `DEV_AUTH_BYPASS` | Optional local member-content preview; set to `true` only for development |

The Stripe catalog is declared in `lib/stripe-catalog.ts` and currently sets
the monthly membership to USD $25. `bun run build` first reconciles its Product
and Price in Stripe and writes a generated catalog used by checkout and the
subscription pages. The sync preserves existing subscriptions when a Price
changes; Stripe Prices are immutable, so a changed amount creates a replacement
Price. No Price ID is configured in the app environment. The build uses the
declared catalog and stable Stripe metadata/lookup key to find its managed
objects, creating them when they do not exist. To adopt a pre-existing Product
and Price before the first sync, mark both Stripe objects with the metadata key
`appCatalogKey=monthly-membership`; otherwise, the build treats them as
unrelated and creates a new managed catalog. Marking the old Price also allows
the post-deployment webhook to deactivate it after the new catalog is live.

Superseded managed Prices are deactivated only after a production deployment
is promoted. To automate this on Vercel, configure a team webhook for the
`Deployment Promoted` event, scoped to this project, and point it at
`https://<production-domain>/api/webhooks/vercel/deployment`. Save the webhook
secret as `VERCEL_WEBHOOK_SECRET` and the Vercel project ID as
`VERCEL_WEBHOOK_PROJECT_ID`. Vercel account webhooks require a Pro or
Enterprise plan. The handler verifies Vercel's signature, ensures the
deployed catalog Price is active, sets it as the Product default, then
deactivates only older active Prices marked as managed by this catalog.
Existing subscriptions remain on their original Price. If a Vercel rollback
restores a build whose Price was already deactivated, checkout reactivates
that build's Price and deactivates the newer managed Price before creating the
Checkout Session.

Use the matching Stripe test or live secret in each Vercel environment.
Configure the Stripe webhook endpoint at
`/api/webhooks/stripe` for `checkout.session.completed`, `invoice.paid`,
`invoice.payment_failed`, `customer.subscription.updated`, and
`customer.subscription.deleted`. Delayed payment methods are not enabled;
checkout currently accepts card payments only.
For payment-method updates, create a separate Customer Portal configuration in
the Stripe Dashboard with payment-method updates enabled and every unrelated
portal feature disabled. Set
`STRIPE_PAYMENT_METHOD_PORTAL_CONFIGURATION_ID` to that configuration's ID in
the server environment. The account page uses only this restricted
configuration and returns customers to `/account`.

Better Auth is configured in `lib/better-auth.ts`, mounted at
`/api/auth/[...all]`, and uses the Drizzle singleton in `lib/drizzle.ts`.
Checkout account creation/sign-in uses Better Auth's email OTP plugin and
sends through Resend. The separate lead-verification flow remains unchanged.
Guest content requires a valid lead-verification cookie. Account pages, account
APIs, and self-guided activities require an unexpired paid Stripe invoice
period or current trial. Subscription access uses only Stripe customer IDs
explicitly linked to the Better Auth user.
Define database tables in `db/schema.ts`; Drizzle Kit
uses `drizzle.config.ts` and writes migrations to `drizzle/`. Generate and
apply the initial auth migration with `bun run db:generate` and
`bun run db:migrate`.

Stripe checkout and customer provisioning use Better Auth sessions and the
Stripe webhook. Successful checkout and subscription lifecycle notifications
are sent through Resend.

To enable email workflows:

1. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL`, then run
   `bun run emails:sync`. The command provisions code-defined marketing topics,
   consent properties, events, templates, and automations. The contact endpoint
   resolves the selected topic by its code-defined name. The lead education
   automation sends after marketing opt-in.
2. Configure both Upstash Redis variables. Contact capture and event
   idempotency return an error when Redis is not configured.

The Stripe webhook handles paid subscription checkout, recurring invoice
renewals and failures, newly scheduled cancellations, and deleted
subscriptions. Billing notifications use the app email for the mapped Stripe
customer; Stripe-provided email addresses are not used for account lookup.
Lifecycle events do not invalidate access caches or write local subscription
snapshots. Access continues through paid-through time, and the cache expires
naturally at that boundary.

## Where to make changes

- **Pages and routes:** `app/` (home, sign-in, account, subscribe, activities,
  guest and public Markdown, contact API, and Stripe webhooks).
- **Shared UI and checkout steps:** `components/`; checkout state and URL
  handling live in `components/subscribe/`. The authenticated checkout endpoint
  is `app/api/stripe/checkout/route.ts`.
- **Member activities:** add or edit Markdown files in `content/self-guided/`.
- **Public pages:** add or edit Markdown files in `content/public/`.
  Each file needs YAML frontmatter with a non-empty `title`, `description`,
  and at least one valid `tags` entry. Tags become links to filtered lists.
- **Guest pages:** add or edit Markdown files in `content/guest/`.
  Each file needs the same YAML frontmatter; tags link to filtered starter pages.
- **Markdown behavior:** `packages/markdown-engine/` handles GitHub-flavored
  Markdown, math, callouts, and sanitization; `lib/markdown-content.ts` loads
  content and checks metadata. Keep each feed's content in its separate
  directory.
- **Checkout agreement and legal pages:** `components/subscribe/checkout.tsx`
  contains the required agreement checkbox; the draft policy pages live in
  `app/terms-of-service/` and `app/privacy-policy/`.
- **Email workflows:** `emails/automations/definitions.ts` describes the
  resources; `emails/automations/events.ts` sends events; `sync.ts` provisions
  and syncs them.
- **Marketing topics:** `lib/marketing-topics.ts` defines topic names and
  consent versions. Select a topic with the `topicKey` prop on
  `LeadCaptureForm`. Email automation sync creates topics with the `opt_in`
  default; new contacts inherit that setting, while existing contact topic
  preferences are left unchanged. The lead form still collects explicit
  consent before adding contacts.
- **Shared Redis helpers:** `packages/kv/` owns the Redis client, rate limiter,
  idempotency store, and IP identifier. Extend this package for new shared
  server-side Redis behavior instead of wiring Redis directly into routes.
- **Environment and auth:** `env.ts`, `lib/auth.ts`, and `lib/better-auth.ts`.

Markdown supports CommonMark/GitHub Flavored Markdown, tables, task lists,
footnotes, KaTeX math, collapsible `<details>` sections, and `[!NOTE]`,
`[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and `[!CAUTION]` callouts. Rendered
content is sanitized. Do not put private information in any content directory:
rendered pages are web pages, and route protection must not be treated as a
place to store secrets.

## A few things to remember

- Local auth bypass is only for browsing member content. It does not test
  sign-in, billing, subscription access, or account management.
- Redis credentials are optional for building, but contact submissions and
  email event idempotency will not work without both credentials.
- Configure the Stripe webhook for the event types listed in Services and
  configuration.
- `gaps.md` tracks product and operational gaps that are not implemented yet.
