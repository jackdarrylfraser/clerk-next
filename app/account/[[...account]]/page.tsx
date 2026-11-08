import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Suspense } from "react";
import { isDevAuthBypassEnabled } from "@/lib/auth";

export default function AccountPage() {
  return <Suspense fallback={<main className="loading-page">Loading your account...</main>}><Account /></Suspense>;
}

async function Account() {
  const { isAuthenticated, redirectToSignIn } = await auth();
  if (!isAuthenticated && isDevAuthBypassEnabled) {
    return (
      <main className="account-page">
        <div className="account-heading">
          <div className="eyebrow"><span /> YOUR MEMBERSHIP</div>
          <h1>Your account.</h1>
          <p>
            Development access is enabled for member content, but account
            management requires a Clerk session.{" "}
            <Link href="/sign-in">Sign in</Link> to continue.
          </p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) return redirectToSignIn({ returnBackUrl: "/account" });

  return (
    <main className="account-page">
      <div className="account-heading"><div className="eyebrow"><span /> YOUR MEMBERSHIP</div><h1>Your account.</h1><p>Manage your profile, security, and subscription.</p></div>
      <UserProfile path="/account" routing="path" />
    </main>
  );
}
