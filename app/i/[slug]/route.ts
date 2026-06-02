import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { packageSkill } from "@/scripts/lib/package-skill";

function serverDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

type ListingRow = {
  id: string;
  slug: string;
  source_url: string;
  skill_path: string | null;
  bundle_status: string | null;
  bundle_url: string | null;
  bundle_source_ref: string | null;
  distribution_mode: string | null;
};

// Coarse bot filter — don't count prefetch/crawler hits.
function isBot(req: NextRequest): boolean {
  const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
  return (
    ua.includes("bot") ||
    ua.includes("crawler") ||
    ua.includes("spider") ||
    ua.includes("prerender") ||
    ua.includes("prefetch") ||
    req.headers.get("x-purpose") === "prefetch" ||
    req.headers.get("purpose") === "prefetch"
  );
}

async function incrementInstallCount(db: ReturnType<typeof serverDb>, skillId: string) {
  // V1: read-modify-write is fine at current traffic levels.
  const { data } = await db
    .from("skill_signal")
    .select("install_count")
    .eq("skill_id", skillId)
    .maybeSingle();
  if (data) {
    await db
      .from("skill_signal")
      .update({ install_count: (data.install_count ?? 0) + 1 })
      .eq("skill_id", skillId);
  }
}

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/i/[slug]">
) {
  const { slug } = await ctx.params;
  const db = serverDb();

  const { data, error } = await db
    .from("skill_listing")
    .select("id, slug, source_url, skill_path, bundle_status, bundle_url, bundle_source_ref, distribution_mode")
    .eq("slug", slug)
    .eq("status", "indexed")
    .maybeSingle();

  if (error || !data) {
    return Response.redirect(new URL(`/skills/${slug}`, req.url), 302);
  }

  const listing = data as ListingRow;

  // Count the install (unless bot/prefetch)
  if (!isBot(req)) {
    await incrementInstallCount(db, listing.id);
  }

  // Source-only skills: no bundle, send back to detail page with flag
  if (listing.distribution_mode === "source-only" || listing.bundle_status === "source-only") {
    const dest = new URL(`/skills/${slug}`, req.url);
    dest.searchParams.set("install", "unavailable");
    return Response.redirect(dest, 302);
  }

  // Bundle ready — check if still fresh (source ref matches latest)
  if (listing.bundle_status === "ready" && listing.bundle_url && listing.bundle_source_ref) {
    return await bundleResponse(listing.bundle_url, slug);
  }

  // Package on demand (first visitor pays the cost; everyone after hits the cache)
  try {
    const result = await packageSkill({
      id: listing.id,
      slug: listing.slug,
      source_url: listing.source_url,
      skill_path: listing.skill_path,
    });

    if ("sourceOnly" in result) {
      await db.from("skill_listing").update({
        bundle_status: "source-only",
        distribution_mode: "source-only",
      }).eq("id", listing.id);
      const dest = new URL(`/skills/${slug}`, req.url);
      dest.searchParams.set("install", "unavailable");
      return Response.redirect(dest, 302);
    }

    if ("failed" in result) {
      await db.from("skill_listing").update({ bundle_status: "failed" }).eq("id", listing.id);
      const dest = new URL(`/skills/${slug}`, req.url);
      dest.searchParams.set("install", "unavailable");
      return Response.redirect(dest, 302);
    }

    // Success — persist and serve
    await db.from("skill_listing").update({
      bundle_url: result.bundleUrl,
      bundle_source_ref: result.sourceRef,
      bundle_status: "ready",
      bundle_packaged_at: new Date().toISOString(),
    }).eq("id", listing.id);

    return await bundleResponse(result.bundleUrl, slug);
  } catch {
    const dest = new URL(`/skills/${slug}`, req.url);
    dest.searchParams.set("install", "unavailable");
    return Response.redirect(dest, 302);
  }
}

async function bundleResponse(bundleUrl: string, slug: string): Promise<Response> {
  // Proxy the file so the browser gets a same-origin response with the right
  // Content-Disposition — cross-origin redirects don't trigger file downloads.
  const upstream = await fetch(bundleUrl);
  if (!upstream.ok) {
    throw new Error(`Storage fetch failed: ${upstream.status}`);
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}.skill"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
