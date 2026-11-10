import { Suspense } from "react";
import { Subscribe } from "@/components/subscribe";

export default function SubscribeTermsPage() {
  return (
    <Suspense
      fallback={<main className="loading-page">Loading plan terms...</main>}
    >
      <Subscribe step="terms" />
    </Suspense>
  );
}
