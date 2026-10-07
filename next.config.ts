import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (local dev fallback DB) ships WASM + data files; load it from node_modules as-is.
  serverExternalPackages: ["@electric-sql/pglite"],
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
