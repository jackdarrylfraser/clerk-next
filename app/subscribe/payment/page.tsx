import { Suspense } from "react";
import { Subscribe } from "../../subscribe";

export default function SubscribePaymentPage() {
  return (
    <Suspense fallback={<main className="loading-page">Loading payment step...</main>}>
      <Subscribe step="payment" />
    </Suspense>
  );
}
