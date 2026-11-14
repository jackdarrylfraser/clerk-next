import Link from "next/link";
import type { ReactNode } from "react";
import { getSubscribeUrls } from "./flow-state";
import type { Step } from "./types";

const steps: { key: Step; title: string; description: string }[] = [
  { key: "plan", title: "Choose a plan", description: "Find the right fit" },
  { key: "account", title: "Sign in / Sign up", description: "One flow for both" },
  { key: "payment", title: "Payment", description: "Complete checkout" },
];

export function SubscribeLayout({
  step,
  selectedId,
  urls,
  isLoaded,
  isSignedIn,
  devAuthBypassEnabled,
  children,
}: {
  step: Step;
  selectedId: string | null;
  urls: ReturnType<typeof getSubscribeUrls>;
  isLoaded: boolean;
  isSignedIn: boolean;
  devAuthBypassEnabled: boolean;
  children: ReactNode;
}) {
  const stepIndex = steps.findIndex((item) => item.key === step);
  const stepUrls = {
    plan: urls.plans,
    account: urls.account,
    payment: urls.payment,
  };

  return (
    <div className="site-shell">
      <main className="main-content">
        <div className="checkout-security">
          <span className="secure-label">
            <span>●</span> SECURE CHECKOUT
          </span>
        </div>
        {devAuthBypassEnabled && isLoaded && !isSignedIn && (
          <p className="dev-auth-notice" role="status">
            Development access is enabled for member content. Account
            management and checkout still require a Clerk sign-in.
          </p>
        )}
        <nav className="progress" aria-label="Subscription progress">
          <ol>
            {steps.map((item, index) => {
              const completed =
                index < stepIndex &&
                (item.key === "account" ? isSignedIn : !!selectedId);

              return (
                <li
                  key={item.key}
                  className={
                    index === stepIndex
                      ? "current"
                      : completed
                        ? "completed"
                        : ""
                  }
                  aria-current={index === stepIndex ? "step" : undefined}
                >
                  {index < stepIndex &&
                  !(item.key === "account" && isSignedIn) ? (
                    <Link
                      className="progress-step progress-link"
                      href={stepUrls[item.key]}
                    >
                      <span className="progress-number">
                        {completed ? "✓" : `0${index + 1}`}
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.description}</small>
                      </span>
                    </Link>
                  ) : (
                    <span className="progress-step">
                      <span className="progress-number">
                        {completed ? "✓" : `0${index + 1}`}
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.description}</small>
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="checkout-layout">
          <section className="flow-panel">{children}</section>
        </div>
      </main>
    </div>
  );
}
