import { describe, expect, it } from "bun:test";
import {
  getSubscribeUrls,
  parseSubscribeQuery,
  resolveSubscribeState,
  resolveSubscribeFlow,
} from "./flow-state";

const urls = getSubscribeUrls("standard", "annual");

function resolve(overrides = {}) {
  return resolveSubscribeFlow({
    step: "payment",
    planId: "standard",
    urls,
    selectedPlanStatus: "ready",
    isAuthLoaded: true,
    isSignedIn: true,
    ...overrides,
  });
}

describe("subscription flow state", () => {
  it("leaves missing or invalid URL options available for session fallback", () => {
    expect(
      parseSubscribeQuery({
        plan: null,
        period: null,
        auth: null,
      }),
    ).toEqual({
      plan: null,
      period: null,
      auth: null,
    });

    expect(
      parseSubscribeQuery({
        plan: "standard",
        period: "weekly",
        auth: "unknown",
      }),
    ).toEqual({
      plan: "standard",
      period: null,
      auth: null,
    });
  });

  it("restores session choices and lets valid URL values take precedence", () => {
    const savedState = {
      planId: "saved-plan",
      period: "annual",
      authMode: "sign-in",
    };

    expect(
      resolveSubscribeState(
        parseSubscribeQuery({ plan: null, period: null, auth: null }),
        savedState,
      ),
    ).toEqual(savedState);

    expect(
      resolveSubscribeState(
        parseSubscribeQuery({
          plan: "url-plan",
          period: "month",
          auth: "sign-up",
        }),
        savedState,
      ),
    ).toEqual({
      planId: "url-plan",
      period: "month",
      authMode: "sign-up",
    });
  });

  it("uses safe defaults when neither the URL nor session has choices", () => {
    expect(
      resolveSubscribeState(
        parseSubscribeQuery({ plan: null, period: null, auth: null }),
        null,
      ),
    ).toEqual({
      planId: null,
      period: "month",
      authMode: "sign-up",
    });
  });

  it("builds URLs with the selected plan and billing period", () => {
    expect(getSubscribeUrls("plan / one", "annual")).toEqual({
      plans: "/subscribe?period=annual",
      account: "/subscribe/account?plan=plan%20%2F%20one&period=annual",
      payment: "/subscribe/payment?plan=plan%20%2F%20one&period=annual",
    });
  });

  it("sends a step without a plan to the plan picker", () => {
    expect(resolve({ step: "account", planId: null })).toEqual({
      kind: "redirect",
      href: urls.plans,
    });
  });

  it("sends an invalid selected plan back to the picker", () => {
    expect(
      resolve({ step: "payment", selectedPlanStatus: "unavailable" }),
    ).toEqual({
      kind: "redirect",
      href: urls.plans,
    });
  });

  it("sends signed-out users to account before payment", () => {
    expect(resolve({ step: "payment", isSignedIn: false })).toEqual({
      kind: "redirect",
      href: urls.account,
    });
  });

  it("allows payment without an independent terms step", () => {
    expect(resolve()).toEqual({ kind: "ready" });
  });

  it("waits for account or plan state before deciding where to go", () => {
    expect(resolve({ isAuthLoaded: false })).toEqual({
      kind: "loading",
      reason: "account",
    });
    expect(resolve({ selectedPlanStatus: "loading" })).toEqual({
      kind: "loading",
      reason: "plan",
    });
  });
});
