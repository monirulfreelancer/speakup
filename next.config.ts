import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Coolify builds a Docker image; standalone output emits a self-contained
  // server so the image ships without the full node_modules tree.
  output: "standalone",
};

export default nextConfig;
