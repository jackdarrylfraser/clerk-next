"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import { useDevAuthBypass } from "@/components/dev-auth-bypass-provider";
import Link from "next/link";

export default function Navigation() {
  const { isLoaded, isSignedIn } = useAuth();
  const devAuthBypassEnabled = useDevAuthBypass();

  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Membership home">
        <span className="brand-mark">✳</span> MEMBERSHIP
      </Link>
      <nav className="header-right" aria-label="Main navigation">
        {isLoaded &&
          (isSignedIn ? (
            <>
              <Link href="/account">Your account</Link>
              <UserButton />
            </>
          ) : devAuthBypassEnabled ? (
            <>
              <Link href="/account">Your account</Link>
              <span className="dev-access-label">Dev access</span>
            </>
          ) : (
            <>
              <Link href="/sign-in">Sign in</Link>
              <Link href="/subscribe/plan" className="subscribe-link">
                Pricing
              </Link>
            </>
          ))}
      </nav>
    </header>
  );
}
