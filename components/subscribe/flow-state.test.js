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
  it("uses safe defaults for missing or invalid URL options", () => {
    expect(
      parseSubscribeQuery({
        plan: null,
        period: null,
        auth: "sign-up",
      }),
    ).toEqual({
      plan: null,
      period: "month",
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
    });
  });

  it("builds URLs with the selected plan and billing period", () => {
    expect(getSubscribeUrls("plan / one", "annual")).toEqual({
      plans: "/subscribe/plan?plan=plan%20%2F%20one&period=annual",
      account: "/subscribe/account?plan=plan%20%2F%20one&period=annual",
      payment: "/subscribe/payment?plan=plan%20%2F%20one&period=annual",
    });
    expect(getSubscribeUrls(null, "month").plans).toBe(
      "/subscribe/plan?period=month",
    );
    expect(getSubscribeUrls(null, "month").account).toBe(
      "/subscribe/account?period=month",
    );
  });

  it("allows plan selection before account creation or sign-in", () => {
    expect(
      resolve({
        step: "plan",
        planId: null,
        isSignedIn: false,
      }),
    ).toEqual({ kind: "ready" });
  });

  it("sends signed-in users from the account step to the next required step", () => {
    expect(
      resolve({
        step: "account",
        planId: null,
        isSignedIn: true,
      }),
    ).toEqual({
      kind: "redirect",
      href: urls.plans,
    });

    expect(
      resolve({
        step: "account",
        planId: "standard",
        isSignedIn: true,
      }),
    ).toEqual({
      kind: "redirect",
      href: urls.payment,
    });
  });

  it("allows signed-out users to view plans before selecting one", () => {
    expect(
      resolve({
        step: "plan",
        planId: null,
        isSignedIn: false,
      }),
    ).toEqual({ kind: "ready" });
  });

  it("requires sign-in after a plan is selected", () => {
    expect(
      resolve({
        step: "plan",
        planId: "standard",
        isSignedIn: false,
      }),
    ).toEqual({
      kind: "redirect",
      href: urls.account,
    });
  });

  it("sends a signed-in user with a valid selected plan to payment", () => {
    expect(
      resolve({
        step: "plan",
        selectedPlanStatus: "ready",
        isSignedIn: true,
      }),
    ).toEqual({
      kind: "redirect",
      href: urls.payment,
    });
  });

  it("preserves a selected plan when requiring sign-in", () => {
    expect(
      resolve({
        step: "plan",
        planId: "standard",
        isSignedIn: false,
      }),
    ).toEqual({
      kind: "redirect",
      href: urls.account,
    });
  });

  it("waits for the selected plan before resuming checkout", () => {
    expect(
      resolve({
        step: "plan",
        selectedPlanStatus: "loading",
        isSignedIn: true,
      }),
    ).toEqual({
      kind: "loading",
      reason: "plan",
    });
  });

  it("leaves unavailable selected plans on the picker", () => {
    expect(
      resolve({
        step: "plan",
        selectedPlanStatus: "unavailable",
        isSignedIn: true,
      }),
    ).toEqual({ kind: "ready" });
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
    expect(
      resolve({ step: "payment", planId: null, isSignedIn: false }),
    ).toEqual({
      kind: "redirect",
      href: urls.account,
    });
  });

  it("sends signed-in users without a plan to the plan picker", () => {
    expect(resolve({ step: "payment", planId: null })).toEqual({
      kind: "redirect",
      href: urls.plans,
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
