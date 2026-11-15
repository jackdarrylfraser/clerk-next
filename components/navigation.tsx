"use client";

import { useDevAuthBypass } from "@/components/dev-auth-bypass-provider";
import { SignOutButton } from "@/components/sign-out-button";
import { authClient } from "@/lib/better-auth-client";
import Link from "next/link";

export default function Navigation() {
  const { data: session, isPending, error } = authClient.useSession();
  const devAuthBypassEnabled = useDevAuthBypass();

  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Membership home">
        Outbound Endurance
      </Link>
      <nav className="header-right" aria-label="Main navigation">
        {error ? (
          <span role="alert">Unable to load your account.</span>
        ) : !isPending ? (
          session ? (
            <>
              <Link href="/account">Your account</Link>
              <SignOutButton />
            </>
          ) : devAuthBypassEnabled ? (
            <>
              <Link href="/account">Your account</Link>
              <span className="dev-access-label">Dev access</span>
            </>
          ) : (
            <Link href="/sign-in" className="subscribe-link">
              Sign in / Sign up
            </Link>
          )
        ) : null}
      </nav>
    </header>
  );
}
