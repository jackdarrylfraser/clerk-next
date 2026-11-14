import { describe, expect, it } from "bun:test";
import {
  getSubscribeUrls,
  parseSubscribeQuery,
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
  it("defaults invalid or missing URL options", () => {
    expect(
      parseSubscribeQuery({
        plan: null,
        period: null,
        auth: null,
      }),
    ).toEqual({
      plan: null,
      period: "month",
      auth: "sign-up",
    });

    expect(
      parseSubscribeQuery({
        plan: "standard",
        period: "weekly",
        auth: "unknown",
      }),
    ).toEqual({
      plan: "standard",
      period: "month",
      auth: "sign-up",
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

  it("does not require persisted agreement state to reach payment", () => {
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
