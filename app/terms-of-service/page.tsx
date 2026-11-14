import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Outbound Endurance",
  description: "Terms governing Outbound Endurance memberships.",
};

export default function TermsOfServicePage() {
  return (
    <main className="markdown-page">
      <article className="markdown-content">
        <h1>Terms of Service</h1>
        <p className="legal-draft-notice" role="note">
          Draft for review. Confirm the effective date, governing state, and
          remaining legal requirements before publishing.
        </p>
        <p>
          <strong>Effective date:</strong> [Add publication date]
        </p>
        <p>
          These Terms of Service (“Terms”) apply to the Outbound Endurance
          website and membership services. By creating an account, purchasing a
          subscription, or using the services, you agree to these Terms. If you
          do not agree, do not use the services.
        </p>

        <h2>Accounts and membership</h2>
        <p>
          Keep your account information accurate and protect your sign-in
          credentials. You are responsible for activity under your account.
          Membership access and any plan-specific features are described on the
          site and at checkout.
        </p>

        <h2>Subscriptions, renewals, and trials</h2>
        <p>
          All plans are subscriptions and automatically renew for the selected
          billing period at the price shown at checkout unless canceled before
          the next renewal. If a free trial is offered, its eligibility,
          duration, and post-trial price will be shown at checkout. Payments are
          processed through the checkout providers.
        </p>

        <h2>Cancellation and refunds</h2>
        <p>
          You may cancel your subscription through your account. Cancellation
          stops the next renewal, and your paid access continues through the
          end of the current billing period. Payments are non-refundable,
          except where a refund is required by applicable law.
        </p>

        <h2>Changes to the services or these Terms</h2>
        <p>
          We may update the services or these Terms. Where required, we will
          give notice of material changes. Continued use after an updated
          version takes effect means you accept the updated Terms.
        </p>

        <h2>Governing law</h2>
        <p>
          The governing state within the United States has not yet been
          specified and must be completed before publication.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these Terms? Contact Outbound Endurance at{" "}
          <a href="mailto:contact@outboundendurance.com">
            contact@outboundendurance.com
          </a>
          .
        </p>
        <p>
          See also our <Link href="/privacy-policy">Privacy Policy</Link>.
        </p>
      </article>
    </main>
  );
}
