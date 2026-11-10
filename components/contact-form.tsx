"use client";

import { useState, type FormEvent } from "react";

type FormStatus = {
  kind: "success" | "error";
  message: string;
};

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          email: formData.get("email"),
        }),
      });

      if (response.status === 409) {
        setStatus({
          kind: "error",
          message: "This email address is already a contact.",
        });
        return;
      }

      if (!response.ok) {
        setStatus({
          kind: "error",
          message: "We couldn't save your contact. Please try again.",
        });
        return;
      }

      form.reset();
      setStatus({ kind: "success", message: "Thanks — your contact was added." });
    } catch (error) {
      console.error("Contact form submission failed", error);
      setStatus({
        kind: "error",
        message: "We couldn't reach the server. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="contact-form-section" aria-labelledby="contact-form-title">
      <h2 id="contact-form-title">Stay in touch.</h2>
      <p>Leave your details and we’ll be in touch.</p>
      <form className="contact-form" onSubmit={handleSubmit}>
        <div className="contact-form-fields">
          <label>
            First name
            <input
              autoComplete="given-name"
              maxLength={100}
              name="firstName"
              required
            />
          </label>
          <label>
            Last name
            <input
              autoComplete="family-name"
              maxLength={100}
              name="lastName"
              required
            />
          </label>
          <label>
            Email address
            <input
              autoComplete="email"
              maxLength={254}
              name="email"
              required
              type="email"
            />
          </label>
        </div>
        <button className="primary-button contact-form-submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Get in touch"}
        </button>
        {status && (
          <p
            className={`contact-form-status ${status.kind}`}
            role={status.kind === "error" ? "alert" : "status"}
          >
            {status.message}
          </p>
        )}
      </form>
    </section>
  );
}
