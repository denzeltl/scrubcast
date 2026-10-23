import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// One public page; pasted videos are private and never listed
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl().toString(), changeFrequency: "weekly", priority: 1 }];
}
