import type { MetadataRoute } from "next";
import { getAllSkillSlugs, getDBPublisherRows } from "@/lib/db";

const BASE = "https://claudinho.xyz";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE,                  changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/skills`,      changeFrequency: "weekly",  priority: 0.9 },
    { url: `${BASE}/creators`,    changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/search`,      changeFrequency: "weekly",  priority: 0.7 },
  ];

  const [slugs, publisherRows] = await Promise.all([
    getAllSkillSlugs(),
    getDBPublisherRows(),
  ]);

  const skillRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${BASE}/skills/${slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const publisherRoutes: MetadataRoute.Sitemap = publisherRows.map(({ handle }) => ({
    url: `${BASE}/creators/${handle}`,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...skillRoutes, ...publisherRoutes];
}
