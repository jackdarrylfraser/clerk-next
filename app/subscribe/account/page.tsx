import { Suspense } from "react";
import { Subscribe } from "../../subscribe";

export default function SubscribeAccountPage() {
  return (
    <Suspense fallback={<main className="loading-page">Loading account step...</main>}>
      <Subscribe step="account" />
    </Suspense>
  );
}
