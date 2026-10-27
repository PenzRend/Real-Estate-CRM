import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // A self-contained server (`.next/standalone`) for the Docker image.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // The extension download packages the repository's extension folder at request time.
  outputFileTracingIncludes: { "/api/extension/download": ["./extension/**"] },
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
