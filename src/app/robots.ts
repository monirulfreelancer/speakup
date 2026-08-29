import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/*
 * Crawlers get the public pages and nothing else. The disallowed paths are
 * either private (dashboard, practice, settings) or pointless to index
 * (api, offline).
 */

export default function robots(): MetadataRoute.Robots {
  const base = env.NEXTAUTH_URL.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/practice", "/settings", "/onboarding", "/offline"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
