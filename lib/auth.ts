export const isDevAuthBypassEnabled =
  process.env.NODE_ENV === "development" &&
  process.env.DEV_AUTH_BYPASS === "true";
