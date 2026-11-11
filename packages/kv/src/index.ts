import "server-only";
import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type CreateRedisClientOptions = {
  redisUrl: string | undefined;
  redisToken: string | undefined;
};

export function createRedisClient({
  redisUrl,
  redisToken,
}: CreateRedisClientOptions) {
  let redis: Redis | undefined;

  return () => {
    if (!redisUrl || !redisToken) {
      throw new Error("Upstash Redis is not configured");
    }

    redis ??= new Redis({ url: redisUrl, token: redisToken });
    return redis;
  };
}

export type CreateRateLimiterOptions = {
  getRedisClient: () => Redis;
  limit: number;
  window: Duration;
  prefix: string;
  timeoutMs?: number;
};

export function createRateLimiter({
  getRedisClient,
  limit,
  window,
  prefix,
  timeoutMs = 1_000,
}: CreateRateLimiterOptions) {
  let rateLimiter: Ratelimit | undefined;

  return (identifier: string) => {
    rateLimiter ??= new Ratelimit({
      redis: getRedisClient(),
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix,
      timeout: timeoutMs,
    });

    return rateLimiter.limit(identifier);
  };
}

export { createIdempotencyStore } from "./idempotency";
export { getIpRateLimitIdentifier } from "./identifier";
