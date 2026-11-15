"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/better-auth-client";

type Status = {
  kind: "success" | "error";
  message: string;
};

export function CheckoutAccountForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [hasSentCode, setHasSentCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  async function sendCode(): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    setStatus(null);
    setIsSubmitting(true);

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "sign-in",
      });

      if (result.error) {
        setStatus({
          kind: "error",
          message: "We couldn't send a code. Check your email and try again.",
        });
        return;
      }

      setEmail(normalizedEmail);
      setHasSentCode(true);
      setStatus({
        kind: "success",
        message: "A verification code is on its way to your inbox.",
      });
    } catch (error) {
      console.error("Checkout account verification request failed", error);
      setStatus({
        kind: "error",
        message: "We couldn't send a code. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendCode();
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    try {
      const result = await authClient.signIn.emailOtp({
        email,
        otp: otp.trim(),
        name: name.trim(),
      });

      if (result.error) {
        setStatus({
          kind: "error",
          message: "That code couldn't be verified. Check it and try again.",
        });
        return;
      }

      window.location.assign("/subscribe/payment");
    } catch (error) {
      console.error("Checkout account verification failed", error);
      setStatus({
        kind: "error",
        message: "We couldn't verify the code. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeEmail() {
    setHasSentCode(false);
    setOtp("");
    setStatus(null);
  }

  return (
    <div className="auth-container email-code-auth">
      <div className="activity-heading">
        <h1>{hasSentCode ? `Check your email, ${email}` : "Create your account."}</h1>
        {!hasSentCode && (
          <p>
            New customers create an account when they verify their email.
            Existing customers can sign in with the same code.
          </p>
        )}
      </div>
      <div className="guest-access-panel">
        {!hasSentCode ? (
          <form className="guest-access-form" onSubmit={requestCode}>
            <label>
              Name
              <input
                autoComplete="name"
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                required
                type="text"
                value={name}
              />
            </label>
            <label>
              Email address
              <input
                autoComplete="email"
                maxLength={254}
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <button
              className="primary-button guest-access-submit"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Sending code..." : "Send account code"}
            </button>
          </form>
        ) : (
          <form className="guest-access-form" onSubmit={verifyCode}>
            <label>
              Verification code
              <input
                autoComplete="one-time-code"
                autoFocus
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setOtp(event.target.value)}
                pattern="[0-9]{6}"
                required
                type="text"
                value={otp}
              />
            </label>
            <button
              className="primary-button guest-access-submit"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Verifying..." : "Verify and continue"}
            </button>
            <button
              className="text-button guest-access-back"
              disabled={isSubmitting}
              onClick={sendCode}
              type="button"
            >
              Send a new code
            </button>
            <button
              className="text-button guest-access-back"
              disabled={isSubmitting}
              onClick={changeEmail}
              type="button"
            >
              Use a different email address
            </button>
          </form>
        )}
        {status && (
          <p
            className={`guest-access-status ${status.kind}`}
            role={status.kind === "error" ? "alert" : "status"}
          >
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}
