import { z } from "zod";
import type { SubscribeSessionState } from "./types";

export const SUBSCRIBE_SESSION_STORAGE_KEY = "subscribe-flow";

const subscribeSessionSchema = z.object({
  version: z.literal(1),
  planId: z.string().min(1).nullable(),
  period: z.enum(["month", "annual"]),
  authMode: z.enum(["sign-in", "sign-up"]),
});

export interface SubscribeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readSubscribeSession(
  storage: SubscribeStorage,
): SubscribeSessionState | null {
  const rawState = storage.getItem(SUBSCRIBE_SESSION_STORAGE_KEY);
  if (!rawState) return null;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawState);
  } catch {
    storage.removeItem(SUBSCRIBE_SESSION_STORAGE_KEY);
    console.warn("Discarded malformed subscription session state.");
    return null;
  }

  const result = subscribeSessionSchema.safeParse(parsedJson);
  if (!result.success) {
    storage.removeItem(SUBSCRIBE_SESSION_STORAGE_KEY);
    console.warn("Discarded invalid subscription session state.");
    return null;
  }

  return {
    planId: result.data.planId,
    period: result.data.period,
    authMode: result.data.authMode,
  };
}

export function writeSubscribeSession(
  storage: SubscribeStorage,
  state: SubscribeSessionState,
): void {
  storage.setItem(
    SUBSCRIBE_SESSION_STORAGE_KEY,
    JSON.stringify({ version: 1, ...state }),
  );
}

export function clearSubscribeSession(storage: SubscribeStorage): void {
  storage.removeItem(SUBSCRIBE_SESSION_STORAGE_KEY);
}
