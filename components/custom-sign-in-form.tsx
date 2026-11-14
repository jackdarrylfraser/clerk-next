"use client";

import {
  EmailCodeVerificationForm,
  type EmailCodeVerificationCopy,
} from "@/components/email-code-verification-form";

type CustomSignInFormProps = {
  returnTo?: string;
};

function getRedirectDestination() {
  const redirectUrl = new URLSearchParams(window.location.search).get(
    "redirect_url",
  );
  if (!redirectUrl) return "/account";

  try {
    const destination = new URL(redirectUrl, window.location.origin);
    if (destination.origin !== window.location.origin) return "/account";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/account";
  }
}

const signInCopy: EmailCodeVerificationCopy = {
  emailHeading: "Sign in.",
  codeHeading: (emailAddress) =>
    `Enter the sign-in code sent to ${emailAddress}`,
  description: "Enter your email address to receive a sign-in code.",
  requestButtonLabel: "Send sign-in code",
  verifyButtonLabel: "Sign in",
  requestSuccess: "A sign-in code is on its way to your inbox.",
  requestError:
    "We couldn't send a sign-in code. Check the email address and try again.",
  requestFailure: "We couldn't send a sign-in code. Please try again.",
  verifyError:
    "That code couldn't be verified. Check it and try again, or request a new code.",
  incompleteError:
    "Your account needs another security check before sign-in can finish. Please contact support.",
  verifyFailure:
    "We couldn't verify that code. Please try again or request a new one.",
};

export function CustomSignInForm({
  returnTo,
}: CustomSignInFormProps = {}) {
  return (
    <EmailCodeVerificationForm
      copy={signInCopy}
      getReturnTo={() => returnTo ?? getRedirectDestination()}
    />
  );
}
