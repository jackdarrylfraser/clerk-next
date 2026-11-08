import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";

export default function AccountPage() {
  return <Suspense fallback={<main className="loading-page">Loading your account...</main>}><Account /></Suspense>;
}

async function Account() {
  const { isAuthenticated, redirectToSignIn } = await auth();
  if (!isAuthenticated) return redirectToSignIn({ returnBackUrl: "/account" });

  return (
    <main className="account-page">
      <div className="account-heading"><div className="eyebrow"><span /> YOUR MEMBERSHIP</div><h1>Your account.</h1><p>Manage your profile, security, and subscription.</p></div>
      <UserProfile path="/account" routing="path" />
    </main>
  );
}
