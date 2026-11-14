import { createIdempotencyStore, createRedisClient } from "@clerk-next/kv";
import { env } from "@/env";

export const getRedisClient = createRedisClient({
  redisUrl: env.UPSTASH_REDIS_REST_URL,
  redisToken: env.UPSTASH_REDIS_REST_TOKEN,
});

export const idempotency = createIdempotencyStore({ getRedisClient });
