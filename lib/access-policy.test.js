import { describe, expect, test } from "bun:test";
import { hasAccessLevel } from "./access-policy.ts";
import { ACCESS_LEVELS } from "./constants.ts";

describe("access level policy", () => {
  test("guest access includes guest content only", () => {
    expect(
      hasAccessLevel(
        ACCESS_LEVELS.GUEST.value,
        ACCESS_LEVELS.GUEST.value,
      ),
    ).toBe(true);
    expect(
      hasAccessLevel(
        ACCESS_LEVELS.GUEST.value,
        ACCESS_LEVELS.SELF_GUIDED.value,
      ),
    ).toBe(false);
  });

  test("self-guided access includes guest and self-guided content", () => {
    expect(
      hasAccessLevel(
        ACCESS_LEVELS.SELF_GUIDED.value,
        ACCESS_LEVELS.GUEST.value,
      ),
    ).toBe(true);
    expect(
      hasAccessLevel(
        ACCESS_LEVELS.SELF_GUIDED.value,
        ACCESS_LEVELS.SELF_GUIDED.value,
      ),
    ).toBe(true);
  });

  test("admin access includes every access level", () => {
    expect(
      hasAccessLevel(ACCESS_LEVELS.ADMIN.value, ACCESS_LEVELS.GUEST.value),
    ).toBe(true);
    expect(
      hasAccessLevel(
        ACCESS_LEVELS.ADMIN.value,
        ACCESS_LEVELS.SELF_GUIDED.value,
      ),
    ).toBe(true);
    expect(
      hasAccessLevel(ACCESS_LEVELS.ADMIN.value, ACCESS_LEVELS.ADMIN.value),
    ).toBe(true);
  });
});
