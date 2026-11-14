"use client";

import {
  EmailCodeVerificationForm,
  type EmailCodeVerificationCopy,
} from "@/components/email-code-verification-form";

type GuestEmailVerificationGateProps = {
  returnTo: string;
  title?: string;
};

const guestVerificationCopy = ({
  title,
}: Pick<
  GuestEmailVerificationGateProps,
  "title"
>): EmailCodeVerificationCopy => ({
  emailHeading: title
    ? `Enter your email to receive access to '${title}'.`
    : "Enter your email to receive access to your content.",
  codeHeading: (emailAddress) =>
    `Enter the verification code sent to ${emailAddress}`,
  requestButtonLabel: "Submit",
  verifyButtonLabel: "Access Content",
  requestSuccess: "A verification code is on its way to your inbox.",
  requestError:
    "We couldn't send a verification code. Check the email address and try again.",
  requestFailure: "We couldn't send a verification code. Please try again.",
  verifyError:
    "That code couldn't be verified. Check it and try again, or request a new code.",
  incompleteError:
    "Your account needs another security check before this content is available. Please contact support.",
  verifyFailure:
    "We couldn't verify that code. Please try again or request a new one.",
});

export function GuestEmailVerificationGate({
  returnTo,
  title,
}: GuestEmailVerificationGateProps) {
  return (
    <EmailCodeVerificationForm
      copy={guestVerificationCopy({ title })}
      getReturnTo={() => returnTo}
    />
  );
}
