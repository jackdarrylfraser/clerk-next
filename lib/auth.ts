import { env } from "@/env";

export const isDevAuthBypassEnabled =
  env.NODE_ENV === "development" && env.DEV_AUTH_BYPASS === "true";
