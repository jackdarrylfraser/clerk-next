import { describe, expect, it } from "bun:test";
import { getSubscribeRedirect } from "./flow-state";

describe("subscription flow state", () => {
  it("keeps signed-out visitors on account creation", () => {
    expect(getSubscribeRedirect("account", false)).toBeNull();
  });

  it("sends signed-in visitors from account creation to checkout", () => {
    expect(getSubscribeRedirect("account", true)).toBe("/subscribe/payment");
  });

  it("sends signed-out visitors away from checkout", () => {
    expect(getSubscribeRedirect("payment", false)).toBe("/subscribe/account");
  });

  it("allows signed-in visitors to continue to monthly checkout", () => {
    expect(getSubscribeRedirect("payment", true)).toBeNull();
  });
});
