import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (local dev fallback DB) ships WASM + data files; load it from node_modules as-is.
  serverExternalPackages: ["@electric-sql/pglite"],
  // PGlite is only for local dev/tests (lib/db/client.ts loads it lazily); keep it out of the
  // deployed functions — it is ~25 MB and slows every cold start.
  outputFileTracingExcludes: {
    "*": ["node_modules/@electric-sql/**", "node_modules/.pnpm/@electric-sql+pglite*/**"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
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
