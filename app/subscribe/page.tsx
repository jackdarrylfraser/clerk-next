import { Suspense } from "react";
import { Subscribe } from "@/components/subscribe";

export default function SubscribePage() {
  return (
    <Suspense fallback={<main className="loading-page">Loading subscription options...</main>}>
      <Subscribe />
    </Suspense>
  );
}
