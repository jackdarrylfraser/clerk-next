# Clerk Next

If you're reading this six months from now, this is a small membership site
built with Next.js, Clerk, Resend, and Upstash Redis. Visitors choose a
membership plan, then sign in or create an account through the same account
flow before checkout. The selected plan stays in the URL so signed-in users
can go straight to checkout.

## What the app does

- **Membership and account management:** Clerk provides sign-in/sign-up,
  user-facing billing plans, checkout, and the profile and subscription
  management UI. The `/subscribe` flow is split into account, plan, and
  payment steps. The selected plan and billing period stay in the URL so the
  flow can resume after sign-in or a refresh. Terms acceptance is held in
  browser session storage; it is not a durable audit record.
- **Member content:** The home page lists paginated activities from
  `content/self-guided`. Individual activity pages require the Clerk
  `user:site_access` feature entitlement. Tag links filter activities.
- **Public content:** Markdown files in `content/public` are listed at
  `/public`, rendered at `/public/<slug>`, and filterable by tag. Public pages also
  include the contact form.
- **Guest content:** Markdown files in `content/guest` are listed at
  `/guest`, rendered at `/guest/<slug>`, and filterable by starter tags.
  Access requires the Clerk `user:site_access` feature entitlement.
- **Contact capture:** The form posts names, email, and explicit marketing
  consent to `/api/contacts`. The endpoint records consent details, adds the
  contact to Resend's Marketing topic, and starts an educational email
  automation. This is an information request, not an account signup; it does
  not send a signup-confirmation email.
- **Email automations:** A verified Clerk webhook triggers a welcome
  automation when a subscription is created. Contact and subscription events,
  templates, and automations are declared in `emails/automations/definitions.ts`
  and can be synced to Resend.
- **Abuse and duplicate protection:** Upstash Redis backs a five-submission
  per IP, per ten-minute contact limit and idempotency records for contact and
  subscription event delivery. If Redis is missing or unavailable, these
  operations fail rather than running without protection.
- **Local member-content preview:** `DEV_AUTH_BYPASS=true` in development lets
  you browse self-guided and starter content without signing in. It does not
  create a Clerk session, so checkout and account management still need real
  authentication.

## Start here

Use Bun (the repo's package manager):

```sh
bun install
bun run dev
```

Create `.env.local` with the Clerk keys and Resend API key below, then open
<http://localhost:3000>. To preview member content without a Clerk session,
also set `DEV_AUTH_BYPASS=true` and restart the dev server. The bypass is
disabled outside development.

Useful commands:

```sh
bun run dev          # local app
bun run build        # production build
bun run start        # serve a production build
bun test             # tests
bun run lint         # ESLint
bun run emails:sync  # create/update declared Resend email resources
```

## Services and configuration

`env.ts` validates the app's environment variables. Configure them in
`.env.local` locally and in the deployment environment (for example, Vercel)
for production. Never commit real values.

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk on the client; required to run/build the app |
| `CLERK_SECRET_KEY` | Clerk server-side operations; required to run/build the app |
| `RESEND_API_KEY` | Resend contact, event, and transactional email APIs; required to run/build the app |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Verifying Clerk webhook deliveries; configure this before enabling the webhook |
| `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` | Contact rate limiting and idempotency for contact/subscription events; both must be set |
| `RESEND_FROM_EMAIL` | Verified sender for billing emails and `bun run emails:sync` |
| `DEV_AUTH_BYPASS` | Optional local member-content preview; set to `true` only for development |

Before expecting checkout to work, configure Clerk Billing, connect its payment
provider, publish user plans, and enable the desired sign-in methods in the
Clerk Dashboard. In the Dashboard's User model settings, turn off **Allow users
to set their first and last name** if accounts should not collect names.
Optional fields are hidden in the app's Clerk components. Member plans must
have the `site_access` feature entitlement. Plan names, prices, trial settings,
and features are read from Clerk rather than hard-coded here.

To enable email workflows:

1. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL`, then run
   `bun run emails:sync`. The command provisions code-defined marketing topics,
   consent properties, events, templates, and automations. The contact endpoint
   resolves the selected topic by its code-defined name.
2. Add a Clerk webhook at `/api/webhooks/clerk` for `subscription.created`,
   `paymentAttempt.created`, `paymentAttempt.updated`, and
   `subscriptionItem.canceled`; set its signing secret in
   `CLERK_WEBHOOK_SIGNING_SECRET`. Billing notifications are sent directly
   through Resend and do not use Resend automations. Cancellation notifications
   correspond to the canceled subscription item.
3. Configure both Upstash Redis variables. Contact capture and event
   idempotency return an error when Redis is not configured.

Checkout uses Clerk's experimental Billing APIs. Check Clerk's current
version-pinning guidance before deploying. Test payment flows with the
development Clerk instance and payment provider's test mode.

## Where to make changes

- **Pages and routes:** `app/` (home, sign-in, account, subscribe, activities,
  guest and public Markdown, contact API, and Clerk webhook).
- **Shared UI and checkout steps:** `components/`; checkout state and URL
  handling live in `components/subscribe/`.
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
- **Environment and auth:** `env.ts`, `proxy.ts`, and `lib/auth.ts`.

Markdown supports CommonMark/GitHub Flavored Markdown, tables, task lists,
footnotes, KaTeX math, collapsible `<details>` sections, and `[!NOTE]`,
`[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and `[!CAUTION]` callouts. Rendered
content is sanitized. Do not put private information in any content directory:
rendered pages are web pages, and route protection must not be treated as a
place to store secrets.

## A few things to remember

- Local auth bypass is only for browsing member content. It does not test Clerk
  sign-in, billing, entitlements, or account management.
- Redis credentials are optional for building, but contact submissions and
  email event idempotency will not work without both credentials.
- The webhook only handles `subscription.created`; it is not a complete
  subscription lifecycle integration.
- `gaps.md` tracks product and operational gaps that are not implemented yet.
