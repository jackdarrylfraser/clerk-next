import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { SubscribeSearchParams } from "@/components/subscribe/types";

export default function SubscribeIndexPage({
  searchParams,
}: PageProps<"/subscribe">) {
  return (
    <Suspense
      fallback={
        <main className="loading-page">Loading subscription options...</main>
      }
    >
      <SubscribeRedirect searchParams={searchParams} />
    </Suspense>
  );
}

async function SubscribeRedirect({
  searchParams,
}: {
  searchParams: Promise<SubscribeSearchParams>;
}): Promise<never> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    }
  }

  const query = params.toString();
  return redirect(`/subscribe/plan${query ? `?${query}` : ""}`);
}
