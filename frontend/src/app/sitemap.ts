import type { MetadataRoute } from "next";

const siteUrl = "https://largent.site";

/**
 * Public pages intended for search engine discovery.
 * Keep authenticated app, onboarding, and authentication routes out of this list.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const publicRoutes = [
    { path: "", changeFrequency: "weekly" as const, priority: 1 },
    { path: "/about", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/faqs", changeFrequency: "monthly" as const, priority: 0.7 },
  ];

  return publicRoutes.map(({ path, changeFrequency, priority }) => ({
    url: `${siteUrl}${path}`,
    changeFrequency,
    priority,
  }));
}
