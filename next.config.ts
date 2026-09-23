import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal server bundle for the Docker image.
  output: "standalone",
  // Let the dev server be opened via 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  // web-tree-sitter loads its own .wasm file relative to its module at
  // runtime, so it must stay in node_modules instead of being bundled.
  serverExternalPackages: ["web-tree-sitter"],
};

export default nextConfig;
