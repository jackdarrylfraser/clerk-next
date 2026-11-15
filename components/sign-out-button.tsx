"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/better-auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setError(null);
    setIsSigningOut(true);

    try {
      const result = await authClient.signOut();
      if (result.error) {
        console.error("Sign out failed", result.error);
        setError("We couldn't sign you out. Please try again.");
        return;
      }

      router.replace("/sign-in");
      router.refresh();
    } catch (caughtError) {
      console.error("Sign out failed", caughtError);
      setError("We couldn't sign you out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <>
      <button
        className="text-button"
        disabled={isSigningOut}
        onClick={signOut}
        type="button"
      >
        {isSigningOut ? "Signing out..." : "Sign out"}
      </button>
      {error && (
        <span className="error-message" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
