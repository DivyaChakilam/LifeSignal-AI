import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // ✅ Allow Firebase SSR and dynamic routes
  output: "standalone", // <– important! enables runtime rendering

  // ✅ Optional: ensures dynamic routes aren't statically built
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },

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
