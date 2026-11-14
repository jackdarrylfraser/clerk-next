import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | Outbound Endurance",
  description: "Get in touch with Outbound Endurance.",
};

export default function ContactPage() {
  return (
    <main className="markdown-page">
      <article className="markdown-content">
        <h1>Contact Us</h1>
        <p>
          If you have any questions, email us at{" "}
          <a href="mailto:contact@outboundendurance.com">
            contact@outboundendurance.com
          </a>
          .
        </p>
      </article>
    </main>
  );
}
