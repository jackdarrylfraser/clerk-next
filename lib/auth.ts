import { env } from "@/env";

export const isPublicOnlyMode = env.PUBLIC_ONLY_MODE === "true";

export const isDevAuthBypassEnabled =
  !isPublicOnlyMode &&
  env.NODE_ENV === "development" &&
  env.DEV_AUTH_BYPASS === "true";
