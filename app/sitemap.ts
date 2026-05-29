import type { MetadataRoute } from "next";
import { getAllSkillSlugs } from "@/lib/db";
import { PUBLISHERS } from "@/lib/data";

const BASE = "https://claudinho.xyz";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE,                 changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/browse`,     changeFrequency: "weekly",  priority: 0.9 },
    { url: `${BASE}/publishers`, changeFrequency: "weekly",  priority: 0.8 },
  ];

  const slugs = await getAllSkillSlugs();
  const skillRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${BASE}/skills/${slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const publisherRoutes: MetadataRoute.Sitemap = Object.keys(PUBLISHERS).map(
    (handle) => ({
      url: `${BASE}/publishers/${handle}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })
  );

  return [...staticRoutes, ...skillRoutes, ...publisherRoutes];
}
