import { Suspense } from "react";
import { Subscribe } from "@/components/subscribe";

export default function SubscribePaymentPage() {
  return (
    <Suspense fallback={<main className="loading-page">Loading payment step...</main>}>
      <Subscribe step="payment" />
    </Suspense>
  );
}
