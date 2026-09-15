import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal server bundle for the Docker image.
  output: "standalone",
  // Let the dev server be opened via 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    // Logos in data/info.json are served from these hosts.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.simpleicons.org" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "cfengine.com" },
    ],
  },
};

export default nextConfig;
