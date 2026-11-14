"use client";

import { useState, type FormEvent } from "react";
import { useSignIn } from "@clerk/nextjs";

type GuestEmailVerificationGateProps = {
  returnTo: string;
};

type GateStatus = {
  kind: "success" | "error";
  message: string;
};

export function GuestEmailVerificationGate({
  returnTo,
}: GuestEmailVerificationGateProps) {
  const { signIn, fetchStatus } = useSignIn();
  const [emailAddress, setEmailAddress] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [hasSentCode, setHasSentCode] = useState(false);
  const [status, setStatus] = useState<GateStatus | null>(null);
  const isSubmitting = fetchStatus === "fetching";

  async function requestVerificationCode() {
    setStatus(null);

    try {
      const { error } = await signIn.emailCode.sendCode({
        emailAddress: emailAddress.trim(),
      });

      if (error) {
        setStatus({
          kind: "error",
          message:
            "We couldn't send a verification code. Check the email address and try again.",
        });
        return;
      }

      setHasSentCode(true);
      setStatus({
        kind: "success",
        message: "A verification code is on its way to your inbox.",
      });
    } catch (error) {
      console.error("Guest email verification code request failed", error);
      setStatus({
        kind: "error",
        message: "We couldn't send a verification code. Please try again.",
      });
    }
  }

  async function sendVerificationCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestVerificationCode();
  }

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    try {
      const { error } = await signIn.emailCode.verifyCode({
        code: verificationCode.trim(),
      });

      if (error) {
        setStatus({
          kind: "error",
          message:
            "That code couldn't be verified. Check it and try again, or request a new code.",
        });
        return;
      }

      if (signIn.status !== "complete") {
        setStatus({
          kind: "error",
          message:
            "Your account needs another security check before this content is available. Please contact support.",
        });
        return;
      }

      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          const destination = session.currentTask
            ? `/sign-in/tasks/${session.currentTask.key}`
            : returnTo;
          window.location.assign(decorateUrl(destination));
        },
      });
    } catch (error) {
      console.error("Guest email verification failed", error);
      setStatus({
        kind: "error",
        message:
          "We couldn't verify that code. Please try again or request a new one.",
      });
    }
  }

  function changeEmail() {
    signIn.reset();
    setHasSentCode(false);
    setVerificationCode("");
    setStatus(null);
  }

  return (
    <main className="activity-home guest-access">
      <div className="activity-heading">
        <h1>
          {hasSentCode
            ? `Enter the verification code sent to ${emailAddress}`
            : "Enter your email to receive your content."}
        </h1>
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
              {isSubmitting ? "Sending code..." : "Submit"}
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
              {isSubmitting ? "Verifying..." : "Access Content"}
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
    </main>
  );
}
