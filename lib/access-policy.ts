import type { AccessLevel } from "@/db/schema";

const accessRank: Record<AccessLevel, number> = {
  guest: 0,
  self_guided: 1,
  admin: 2,
};

export function hasAccessLevel(
  granted: AccessLevel,
  required: AccessLevel,
): boolean {
  return accessRank[granted] >= accessRank[required];
}
