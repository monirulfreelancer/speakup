// @ts-check
import { serwist } from "@serwist/next/config";

/*
 * Serwist "configurator mode" — bundler-agnostic, which matters because
 * Next 16 builds with Turbopack and the classic @serwist/next webpack
 * plugin can't run there. `serwist build` runs AFTER `next build` (see the
 * build script in package.json) and precaches the prerendered routes.
 */

export default serwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
});
