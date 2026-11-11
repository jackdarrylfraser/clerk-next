import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/env";

let contactRateLimiter: Ratelimit | undefined;

function getContactRateLimiter(): Ratelimit {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Upstash Redis is not configured");
  }

  contactRateLimiter ??= new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(5, "10 m"),
    prefix: "clerk-next:contact",
    timeout: 1_000,
  });

  return contactRateLimiter;
}

export function limitContactSubmissions(identifier: string) {
  return getContactRateLimiter().limit(identifier);
}
