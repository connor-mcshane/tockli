import type { MetadataRoute } from "next";
import { blogArticles, getSiteUrl } from "@/lib/marketing";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const staticRoutes = [
    {
      path: "/",
      priority: 0.8,
    },
    {
      path: "/landing",
      priority: 1,
    },
    {
      path: "/signup",
      priority: 0.9,
    },
    {
      path: "/blog",
      priority: 0.7,
    },
  ];

  return [
    ...staticRoutes.map((route) => ({
      changeFrequency: "weekly" as const,
      lastModified: new Date("2026-07-24"),
      priority: route.priority,
      url: `${baseUrl}${route.path}`,
    })),
    ...blogArticles.map((article) => ({
      changeFrequency: "monthly" as const,
      lastModified: new Date(`${article.publishedAt}T12:00:00Z`),
      priority: 0.6,
      url: `${baseUrl}/blog/${article.slug}`,
    })),
  ];
}
