import type { ReactNode } from "react";
import Link from "next/link";
import type { Step } from "./types";

const steps: { key: Step; title: string; description: string }[] = [
  { key: "plan", title: "Choose a plan", description: "Find the right fit" },
  { key: "account", title: "Your account", description: "Subscribe or sign in" },
  { key: "payment", title: "Payment", description: "Complete checkout" },
];

export function SubscribeLayout({
  step,
  selectedId,
  isLoaded,
  isSignedIn,
  devAuthBypassEnabled,
  storageError,
  children,
}: {
  step: Step;
  selectedId: string | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  devAuthBypassEnabled: boolean;
  storageError: boolean;
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
        {devAuthBypassEnabled && isLoaded && !isSignedIn && (
          <p className="dev-auth-notice" role="status">
            Development access is enabled for member content. Account
            management and checkout still require a Clerk sign-in.
          </p>
        )}
        {storageError && (
          <p className="dev-auth-notice" role="status">
            Your choices could not be saved for this tab. You can continue, but
            refreshing may restart the subscription flow.
          </p>
        )}
        <nav className="progress" aria-label="Subscription progress">
          <ol>
            {steps.map((item, index) => {
              const completed =
                index < stepIndex &&
                (item.key === "plan" ? !!selectedId : isSignedIn);

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
                  <span className="progress-number">
                    {completed ? "✓" : `0${index + 1}`}
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="checkout-layout">
          <section className="flow-panel">{children}</section>
        </div>
        <footer className="site-footer">
          <span>© {new Date().getFullYear()} MEMBERSHIP</span>
          <nav className="legal-footer-links" aria-label="Legal information">
            <Link href="/terms-of-service">Terms of Service</Link>
            <Link href="/privacy-policy">Privacy Policy</Link>
          </nav>
          <span>YOUR NEXT CHAPTER STARTS HERE ↗</span>
        </footer>
      </main>
    </div>
  );
}
