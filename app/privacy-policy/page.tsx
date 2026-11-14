import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Outbound Endurance",
  description: "How Outbound Endurance handles personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="markdown-page">
      <article className="markdown-content">
        <h1>Privacy Policy</h1>
        <p className="legal-draft-notice" role="note">
          Draft for review. Confirm data retention, analytics and cookie
          settings, and any additional legal disclosures before publishing.
        </p>
        <p>
          <strong>Effective date:</strong> [Add publication date]
        </p>
        <p>
          This Privacy Policy describes how Outbound Endurance handles
          information when you visit the website, create an account, subscribe,
          or contact us.
        </p>

        <h2>Information we handle</h2>
        <ul>
          <li>
            Account and subscription information, such as account identifiers,
            contact details you provide, and subscription status.
          </li>
          <li>
            Payment information submitted during checkout, which is handled by
            Clerk and its payment processors, including Stripe.
          </li>
          <li>
            Contact-form information, including your name, email address, and
            marketing consent.
          </li>
          <li>
            Website usage information measured through Umami analytics. The
            exact information collected depends on the deployed Umami settings
            and must be confirmed before publication.
          </li>
          <li>
            IP address information used to rate-limit contact-form submissions.
          </li>
        </ul>

        <h2>How we use information</h2>
        <p>
          We use information to provide and manage memberships, process
          subscriptions, respond to messages, send requested service or
          marketing email, protect the site from abuse, and understand website
          usage.
        </p>

        <h2>Service providers</h2>
        <p>
          We use Clerk for account and checkout services, Stripe for payment
          processing through checkout, Resend for contact and email
          communications, Umami for website analytics, and Upstash for
          contact-form rate limiting and duplicate-submission handling. These
          providers process information as needed to provide their services.
        </p>

        <h2>Cookies and similar technologies</h2>
        <p>
          Sign-in, checkout, or analytics settings may use cookies or similar
          technologies. Confirm the production configuration and the
          information associated with those technologies before publishing
          this policy.
        </p>

        <h2>Retention and your choices</h2>
        <p>
          We retain information for as long as needed to provide the services,
          meet legal obligations, resolve disputes, and enforce agreements.
          Specific retention periods and available privacy rights depend on
          applicable law and need to be confirmed for publication. For requests
          or questions, contact us using the details below.
        </p>

        <h2>Contact</h2>
        <p>
          Contact Outbound Endurance at{" "}
          <a href="mailto:contact@outboundendurance.com">
            contact@outboundendurance.com
          </a>{" "}
          about this Privacy Policy.
        </p>
        <p>
          See also our{" "}
          <Link href="/terms-of-service">Terms of Service</Link>.
        </p>
      </article>
    </main>
  );
}
