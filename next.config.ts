import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Coolify builds a Docker image; standalone output emits a self-contained
  // server so the image ships without the full node_modules tree.
  //
  // The service worker is NOT wired here: Next 16 builds with Turbopack,
  // which @serwist/next's webpack plugin doesn't support. Serwist runs in
  // configurator mode instead — see serwist.config.js and the build script.
  output: "standalone",
};

export default nextConfig;
