export const ACCESS_LEVELS = {
  GUEST: { value: "guest", rank: 0 },
  SELF_GUIDED: { value: "self_guided", rank: 1 },
  ADMIN: { value: "admin", rank: 2 },
} as const;

export type AccessLevel =
  (typeof ACCESS_LEVELS)[keyof typeof ACCESS_LEVELS]["value"];

const accessLevelDefinitions = Object.values(ACCESS_LEVELS);

export function isAccessLevel(value: unknown): value is AccessLevel {
  return (
    typeof value === "string" &&
    accessLevelDefinitions.some((level) => level.value === value)
  );
}
