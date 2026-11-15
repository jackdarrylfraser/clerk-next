import Link from "next/link";
import type { ReactNode } from "react";

const steps = [
  { key: "plan", title: "Monthly plan", description: "Choose your membership" },
  { key: "account", title: "Your account", description: "Sign in to continue" },
  { key: "payment", title: "Payment", description: "Complete secure checkout" },
] as const;

export function SubscribeLayout({
  step,
  children,
}: {
  step: (typeof steps)[number]["key"];
  children: ReactNode;
}) {
  const stepIndex = steps.findIndex((item) => item.key === step);

  return (
    <div className="site-shell">
      <main className="main-content">
        <div className="checkout-security">
          <span className="secure-label">
            <span>●</span> SECURE CHECKOUT
          </span>
        </div>
        <nav className="progress" aria-label="Subscription progress">
          <ol>
            {steps.map((item, index) => {
              const completed = index < stepIndex;

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
                  {completed ? (
                    <Link
                      className="progress-step progress-link"
                      href="/subscribe/plan"
                    >
                      <span className="progress-number">
                        ✓
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.description}</small>
                      </span>
                    </Link>
                  ) : (
                    <span className="progress-step">
                      <span className="progress-number">
                        {`0${index + 1}`}
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
