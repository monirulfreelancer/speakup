import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/*
 * Only the public, indexable pages. Everything behind auth (dashboard,
 * practice, settings, history) is deliberately absent — it needs a session,
 * so a crawler reaching it gets a redirect, not content.
 */

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXTAUTH_URL.replace(/\/$/, "");
  const lastModified = new Date();

  return [
    { url: `${base}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/signup`, lastModified, changeFrequency: "yearly", priority: 0.8 },
    { url: `${base}/login`, lastModified, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/download`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/guidelines`, lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.4 },
  ];
}
