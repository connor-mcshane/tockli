import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/marketing";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: {
      allow: "/",
      disallow: ["/api/", "/app"],
      userAgent: "*",
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
