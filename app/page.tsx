import { Suspense } from "react";
import { Subscribe } from "./subscribe";

export default function Home() {
  return (
    <Suspense fallback={<main className="loading-page">Loading subscription options...</main>}>
      <Subscribe />
    </Suspense>
  );
}
