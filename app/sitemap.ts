import type { MetadataRoute } from "next";
import { getAllSkillSlugs, getDBPublisherRows } from "@/lib/db";
import { START_PAGES, SKILLS_PAGES, FEATURES, CASES } from "@/lib/manual";

const BASE = "https://claudinho.xyz";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE,                  changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/skills`,      changeFrequency: "weekly",  priority: 0.9 },
    { url: `${BASE}/creators`,    changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/search`,      changeFrequency: "weekly",  priority: 0.7 },
  ];

  // The Manual — guide pages + features + LIVE examples only (stubs are thin
  // content; they join the sitemap as they're produced).
  const manualRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/manual`, changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${BASE}/manual/features`, changeFrequency: "monthly" as const, priority: 0.6 },
    ...START_PAGES.map((p) => ({
      url: `${BASE}/manual/start/${p.topic}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...SKILLS_PAGES.map((p) => ({
      url: `${BASE}/manual/skills/${p.topic}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...FEATURES.filter((f) => f.guide).map((f) => ({
      url: `${BASE}/manual/features/${f.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...CASES.filter((c) => c.status === "live").map((c) => ({
      url: `${BASE}/manual/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
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

  return [...staticRoutes, ...manualRoutes, ...skillRoutes, ...publisherRoutes];
}
