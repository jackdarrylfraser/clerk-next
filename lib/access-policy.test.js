import { describe, expect, test } from "bun:test";
import { hasAccessLevel } from "./access-policy.ts";

describe("access level policy", () => {
  test("guest access includes guest content only", () => {
    expect(hasAccessLevel("guest", "guest")).toBe(true);
    expect(hasAccessLevel("guest", "self_guided")).toBe(false);
  });

  test("self-guided access includes guest and self-guided content", () => {
    expect(hasAccessLevel("self_guided", "guest")).toBe(true);
    expect(hasAccessLevel("self_guided", "self_guided")).toBe(true);
  });

  test("admin access includes every access level", () => {
    expect(hasAccessLevel("admin", "guest")).toBe(true);
    expect(hasAccessLevel("admin", "self_guided")).toBe(true);
    expect(hasAccessLevel("admin", "admin")).toBe(true);
  });
});
