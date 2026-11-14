import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import { clerkAuthAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <div className="clerk-auth flex min-h-screen items-center justify-center">
      <Suspense>
        <SignIn
          fallbackRedirectUrl="/"
          appearance={clerkAuthAppearance}
        />
      </Suspense>
    </div>
  );
}
