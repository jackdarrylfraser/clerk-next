"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/better-auth-client";

export type EmailCodeVerificationCopy = {
  emailHeading: string;
  codeHeading: (emailAddress: string) => string;
  description?: string;
  requestButtonLabel: string;
  verifyButtonLabel: string;
  requestSuccess: string;
  requestError: string;
  requestFailure: string;
  verifyError: string;
  verifyFailure: string;
};

type EmailCodeVerificationFormProps = {
  copy: EmailCodeVerificationCopy;
  getReturnTo: () => string;
};

type Status = {
  kind: "success" | "error";
  message: string;
};

function getSafeReturnDestination(destination: string): string {
  try {
    const url = new URL(destination, window.location.origin);
    if (url.origin !== window.location.origin) {
      return "/";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function EmailCodeVerificationForm({
  copy,
  getReturnTo,
}: EmailCodeVerificationFormProps) {
  const [emailAddress, setEmailAddress] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [hasSentCode, setHasSentCode] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function requestVerificationCode() {
    const trimmedEmailAddress = emailAddress.trim();
    setStatus(null);
    setIsSubmitting(true);

    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: trimmedEmailAddress,
        type: "sign-in",
      });

      if (error) {
        setStatus({ kind: "error", message: copy.requestError });
        return;
      }

      setEmailAddress(trimmedEmailAddress);
      setHasSentCode(true);
      setStatus({ kind: "success", message: copy.requestSuccess });
    } catch (error) {
      console.error("Email verification code request failed", error);
      setStatus({ kind: "error", message: copy.requestFailure });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function sendVerificationCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestVerificationCode();
  }

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    try {
      const { error } = await authClient.signIn.emailOtp({
        email: emailAddress,
        otp: verificationCode.trim(),
      });

      if (error) {
        setStatus({ kind: "error", message: copy.verifyError });
        return;
      }

      window.location.assign(getSafeReturnDestination(getReturnTo()));
    } catch (error) {
      console.error("Email verification failed", error);
      setStatus({ kind: "error", message: copy.verifyFailure });
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeEmail() {
    setHasSentCode(false);
    setVerificationCode("");
    setStatus(null);
  }

  return (
    <div className="auth-container email-code-auth">
      <div className="activity-heading">
        <h1>
          {hasSentCode ? copy.codeHeading(emailAddress) : copy.emailHeading}
        </h1>
        {!hasSentCode && copy.description && <p>{copy.description}</p>}
      </div>
      <div className="guest-access-panel">
        {!hasSentCode ? (
          <form className="guest-access-form" onSubmit={sendVerificationCode}>
            <label>
              Email address
              <input
                autoComplete="email"
                maxLength={254}
                onChange={(event) => setEmailAddress(event.target.value)}
                required
                type="email"
                value={emailAddress}
              />
            </label>
            <button
              className="primary-button guest-access-submit"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Sending code..." : copy.requestButtonLabel}
            </button>
          </form>
        ) : (
          <form className="guest-access-form" onSubmit={verifyEmail}>
            <label>
              Verification code
              <input
                autoComplete="one-time-code"
                autoFocus
                inputMode="numeric"
                onChange={(event) => setVerificationCode(event.target.value)}
                required
                type="text"
                value={verificationCode}
              />
            </label>
            <button
              className="primary-button guest-access-submit"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Verifying..." : copy.verifyButtonLabel}
            </button>
            <button
              className="text-button guest-access-back"
              disabled={isSubmitting}
              onClick={requestVerificationCode}
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
