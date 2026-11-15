import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isDevAuthBypassEnabled } from "@/lib/auth";
import { hasAccessLevel } from "@/lib/access-policy";
import { ACCESS_LEVELS } from "@/lib/constants";
import { getCurrentUserAccess } from "@/lib/server-access";
import { SignOutButton } from "@/components/sign-out-button";

export default function AccountPage() {
  return <Suspense fallback={<main className="loading-page">Loading your account...</main>}><Account /></Suspense>;
}

async function Account() {
  const current = await getCurrentUserAccess();
  if (!current && isDevAuthBypassEnabled) {
    return (
      <main className="account-page">
        <div className="account-heading">
          <div className="eyebrow"><span /> YOUR MEMBERSHIP</div>
          <h1>Your account.</h1>
          <p>
            Development access is enabled for member content, but account
            management requires a Better Auth session.{" "}
            <Link href="/sign-in">Sign in</Link> to continue.
          </p>
        </div>
      </main>
    );
  }

  if (!current) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent("/account")}`);
  }
  if (
    !hasAccessLevel(current.accessLevel, ACCESS_LEVELS.SELF_GUIDED.value)
  ) {
    redirect("/subscribe/plan");
  }

  return (
    <main className="account-page">
      <div className="account-heading">
        <div className="eyebrow"><span /> YOUR MEMBERSHIP</div>
        <h1>Your account.</h1>
        <p>Signed in as {current.user.email}.</p>
      </div>
      <div className="account-details">
        <p><strong>Name</strong> {current.user.name}</p>
        <p><strong>Email</strong> {current.user.email}</p>
        <SignOutButton />
      </div>
    </main>
  );
}
