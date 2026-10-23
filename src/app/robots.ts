import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Read SITE_URL when served, not when built
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The API only does work for visitors; there's nothing for a crawler to read there
      disallow: "/api/",
    },
    sitemap: new URL("sitemap.xml", siteUrl()).toString(),
  };
}
