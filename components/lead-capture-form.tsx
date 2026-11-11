"use client";

import { useId, useState, type FormEvent } from "react";

type FormStatus = {
  kind: "success" | "error";
  message: string;
};

type LeadCaptureFormCopy = {
  title: string;
  description: string;
  consentLabel: string;
  submitLabel: string;
};

const defaultCopy: LeadCaptureFormCopy = {
  title: "Learn the what, why, and how.",
  description:
    "Get practical educational emails that explain what matters, why it matters, and how to put ideas into practice.",
  consentLabel:
    "Yes, I agree to receive educational emails about what matters, why it matters, and how to put ideas into practice.",
  submitLabel: "Get learning updates",
};

type LeadCaptureFormProps = {
  copy?: Partial<LeadCaptureFormCopy>;
};

export function LeadCaptureForm({ copy: copyOverrides }: LeadCaptureFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus | null>(null);
  const titleId = useId();
  const copy = { ...defaultCopy, ...copyOverrides };

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
          marketingConsent: formData.get("marketingConsent") === "on",
        }),
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const waitMessage =
          Number.isSafeInteger(retryAfter) && retryAfter > 0
            ? `Please try again in ${Math.ceil(retryAfter / 60)} ${
                Math.ceil(retryAfter / 60) === 1 ? "minute" : "minutes"
              }.`
            : "Please wait a few minutes before trying again.";
        setStatus({
          kind: "error",
          message: `Too many attempts. ${waitMessage}`,
        });
        return;
      }

      if (response.status === 425) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const waitMessage =
          Number.isSafeInteger(retryAfter) && retryAfter > 0
            ? `Please try again in ${retryAfter} ${
                retryAfter === 1 ? "second" : "seconds"
              }.`
            : "Please try again in a moment.";
        setStatus({
          kind: "error",
          message: `This submission is already being processed. ${waitMessage}`,
        });
        return;
      }

      if (!response.ok) {
        setStatus({
          kind: "error",
          message:
            "We couldn't sign you up for learning emails. Please try again.",
        });
        return;
      }

      form.reset();
      setStatus({
        kind: "success",
        message: "Thanks for signing up for learning updates.",
      });
    } catch (error) {
      console.error("Learning email signup failed", error);
      setStatus({
        kind: "error",
        message: "We couldn't reach the server. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="lead-capture-section" aria-labelledby={titleId}>
      <h2 id={titleId}>{copy.title}</h2>
      <p>{copy.description}</p>
      <form className="lead-capture-form" onSubmit={handleSubmit}>
        <div className="lead-capture-fields">
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
        <label className="lead-capture-consent">
          <input name="marketingConsent" required type="checkbox" />
          <span>{copy.consentLabel}</span>
        </label>
        <button
          className="primary-button lead-capture-submit"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Signing up..." : copy.submitLabel}
        </button>
        {status && (
          <p
            className={`lead-capture-status ${status.kind}`}
            role={status.kind === "error" ? "alert" : "status"}
          >
            {status.message}
          </p>
        )}
      </form>
    </section>
  );
}
