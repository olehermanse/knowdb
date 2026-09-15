import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal server bundle for the Docker image.
  output: "standalone",
  // Let the dev server be opened via 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
