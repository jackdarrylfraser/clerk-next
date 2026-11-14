import { Suspense } from "react";
import { usePlans } from "@clerk/nextjs/experimental";
import { use } from "react";
import { useAuth } from "@clerk/nextjs";
import { useDevAuthBypass } from "@/components/dev-auth-bypass-provider";
import { useRouter } from "next/navigation";
import { getSubscribeUrls, parseSubscribeQuery } from "@/components/subscribe/flow-state";
import { PlanStep } from "@/components/subscribe/plan-step";
import { SubscribeLayout } from "@/components/subscribe/subscribe-layout";
import { useSubscribeSession } from "@/components/subscribe/use-subscribe-session";
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
  const session = useSubscribeSession(query);
  const router = useRouter();
  const plans = usePlans({ for: "user", pageSize: 10, infinite: true });
  const { isLoaded, isSignedIn } = useAuth();
  const devAuthBypassEnabled = useDevAuthBypass();
  const urls = getSubscribeUrls(session.state.planId, session.state.period);

  function selectPeriod(period: "month" | "annual"): void {
    session.update({ period });
    router.replace(getSubscribeUrls(null, period).plans);
  }

  function selectPlan(planId: string): void {
    session.update({ planId });
    router.push(getSubscribeUrls(planId, session.state.period).account);
  }

  return (
    <SubscribeLayout
      step="plan"
      selectedId={session.state.planId}
      isLoaded={isLoaded}
      isSignedIn={!!isSignedIn}
      devAuthBypassEnabled={devAuthBypassEnabled}
      storageError={session.storageError}
    >
      {!session.isReady ? (
        <p className="muted-indent" role="status">
          Restoring your subscription choices...
        </p>
      ) : (
        <PlanStep
          plans={plans.data}
          isLoading={plans.isLoading}
          isError={plans.isError}
          hasNextPage={plans.hasNextPage}
          fetchNext={() => {
            void plans.fetchNext();
          }}
          chosenPeriod={session.state.period}
          onPeriodChange={selectPeriod}
          selectedId={session.state.planId}
          accountUrl={urls.account}
          onChoosePlan={selectPlan}
        />
      )}
    </SubscribeLayout>
  );
}
