const nextConfig = {
  allowedDevOrigins: [
    "https://3000-firebase-studio-1755194311247.cluster-joak5ukfbnbyqspg4tewa33d24.cloudworkstations.dev"
  ],
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
