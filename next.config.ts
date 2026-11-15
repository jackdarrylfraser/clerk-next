import "./env";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@outbound-endurance/markdown-engine"],
  outputFileTracingIncludes: {
    "/api/stripe/checkout": ["./public/stripe-catalog.json"],
    "/api/webhooks/vercel/deployment": ["./public/stripe-catalog.json"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
