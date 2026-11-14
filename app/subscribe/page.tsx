import { Suspense } from "react";
import { usePlans } from "@clerk/nextjs/experimental";
import { use } from "react";
import { useAuth } from "@clerk/nextjs";
import { useDevAuthBypass } from "@/components/dev-auth-bypass-provider";
import { useRouter } from "next/navigation";
import { getSubscribeUrls, parseSubscribeQuery } from "@/components/subscribe/flow-state";
import { PlanStep } from "@/components/subscribe/plan-step";
import { SubscribeLayout } from "@/components/subscribe/subscribe-layout";
import type { SubscribeSearchParams } from "@/components/subscribe/types";

export default function SubscribePage({
  searchParams,
}: PageProps<"/subscribe">) {
  return (
    <Suspense
      fallback={
        <main className="loading-page">Loading subscription options...</main>
      }
    >
      <SubscribePlanContent searchParams={searchParams} />
    </Suspense>
  );
}

function SubscribePlanContent({
  searchParams,
}: {
  searchParams: Promise<SubscribeSearchParams>;
}) {
  const query = parseSubscribeQuery(use(searchParams));
  const router = useRouter();
  const plans = usePlans({ for: "user", pageSize: 10, infinite: true });
  const { isLoaded, isSignedIn } = useAuth();
  const devAuthBypassEnabled = useDevAuthBypass();

  function selectPeriod(period: "month" | "annual"): void {
    router.replace(getSubscribeUrls(query.plan, period).plans);
  }

  function selectPlan(planId: string): void {
    router.push(getSubscribeUrls(planId, query.period).account);
  }

  return (
    <SubscribeLayout
      step="plan"
      selectedId={query.plan}
      isLoaded={isLoaded}
      isSignedIn={!!isSignedIn}
      devAuthBypassEnabled={devAuthBypassEnabled}
    >
      <PlanStep
        plans={plans.data}
        isLoading={plans.isLoading}
        isError={plans.isError}
        hasNextPage={plans.hasNextPage}
        fetchNext={() => {
          void plans.fetchNext();
        }}
        chosenPeriod={query.period}
        onPeriodChange={selectPeriod}
        selectedId={query.plan}
        accountUrl={getSubscribeUrls(query.plan, query.period).account}
        onChoosePlan={selectPlan}
      />
    </SubscribeLayout>
  );
}
