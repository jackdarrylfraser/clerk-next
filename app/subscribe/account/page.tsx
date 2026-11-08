import { Suspense } from "react";
import { Subscribe } from "@/components/subscribe";

export default function SubscribeAccountPage() {
  return (
    <Suspense fallback={<main className="loading-page">Loading account step...</main>}>
      <Subscribe step="account" />
    </Suspense>
  );
}
