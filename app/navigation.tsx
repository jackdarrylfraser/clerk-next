"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";

export default function Navigation() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Membership home">
        <span className="brand-mark">✳</span> MEMBERSHIP
      </Link>
      <nav className="header-right" aria-label="Main navigation">
        {isLoaded &&
          (isSignedIn ? (
            <>
              <Link href="/activity/README">Activities</Link>
              <Link href="/account">Your account</Link>
              <UserButton />
            </>
          ) : (
            <>
              <Link href="/sign-in">Sign in</Link>
              <Link href="/subscribe" className="subscribe-link">
                Subscribe
              </Link>
            </>
          ))}
      </nav>
    </header>
  );
}
