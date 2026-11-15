import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isDevAuthBypassEnabled } from "@/lib/auth";
import { getCurrentUser } from "@/lib/server-access";
import { SignOutButton } from "@/components/sign-out-button";
import { BillingManagement } from "@/components/account/billing-management";
import { getStripeAccountOverview } from "@/lib/stripe-account";

export default function AccountPage() {
  return <Suspense fallback={<main className="loading-page">Loading your account...</main>}><Account /></Suspense>;
}

async function Account() {
  const current = await getCurrentUser();
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

  let billingCustomers = null;
  let billingLoadFailed = false;
  try {
    billingCustomers = await getStripeAccountOverview(current.id);
  } catch (error) {
    console.error("Could not load Stripe billing details for the account page", error);
    billingLoadFailed = true;
  }

  return (
    <main className="account-page">
      <div className="account-heading">
        <div className="eyebrow"><span /> YOUR MEMBERSHIP</div>
        <h1>Your account.</h1>
        <p>Signed in as {current.email}.</p>
      </div>
      <div className="account-details">
        <p><strong>Name</strong> {current.name}</p>
        <p><strong>Email</strong> {current.email}</p>
        <SignOutButton />
      </div>
      {billingLoadFailed ? (
        <p className="account-billing-error" role="alert">
          Billing details could not be loaded. Please try again later.
        </p>
      ) : (
        <BillingManagement customers={billingCustomers ?? []} />
      )}
    </main>
  );
}
