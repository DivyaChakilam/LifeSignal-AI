// next.config.ts
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // ✅ Correct placement: top-level, not inside `experimental`
  ...(isDev && {
    allowedDevOrigins: ["*.cloudworkstations.dev"],
  }),

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    domains: ["placehold.co"],
  },
};

export default nextConfig;
