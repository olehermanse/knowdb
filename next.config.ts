import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal server bundle for the Docker image.
  output: "standalone",
  images: {
    // Logos in data/info.json are served from these hosts.
    remotePatterns: [{ protocol: "https", hostname: "cdn.simpleicons.org" }],
  },
};

export default nextConfig;
