import {
  ACCESS_LEVELS,
  type AccessLevel,
} from "@/lib/constants";

export function hasAccessLevel(
  granted: AccessLevel,
  required: AccessLevel,
): boolean {
  const grantedLevel = Object.values(ACCESS_LEVELS).find(
    (level) => level.value === granted,
  );
  const requiredLevel = Object.values(ACCESS_LEVELS).find(
    (level) => level.value === required,
  );

  if (!grantedLevel || !requiredLevel) {
    throw new Error("Unknown access level.");
  }

  return grantedLevel.rank >= requiredLevel.rank;
}
