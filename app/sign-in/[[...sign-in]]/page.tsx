import { Suspense } from "react";
import { CustomSignInForm } from "@/components/custom-sign-in-form";

export default function SignInPage() {
  return (
    <Suspense>
      <CustomSignInForm />
    </Suspense>
  );
}
