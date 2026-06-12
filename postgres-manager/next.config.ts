import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the native `pg` package external to the server bundle so its
  // optional native helpers resolve correctly at runtime.
  serverExternalPackages: ["pg"],
  // This app lives in a subdirectory of a larger repo; pin the file-tracing
  // root to this project so Next doesn't pick up the parent lockfile.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
