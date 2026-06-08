import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";
import { getSkillBySlug, ownerFromUrl } from "@/lib/db";
import { fmtCount } from "@/lib/data";

export const alt = "Claudinho skill";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function loadFont(): ArrayBuffer {
  return readFileSync(join(process.cwd(), "public/fonts/Geist-Regular.ttf")).buffer as ArrayBuffer;
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = await getSkillBySlug(slug);

  const ok = row?.content_status === "ok";
  const title = (ok && row?.display_title) ? row.display_title : (row?.skill_name ?? "Skill not found");
  const bestFor = (ok && row?.best_for) ? row.best_for : null;
  const shelf = row?.shelf ?? null;
  const subShelf = row?.sub_shelf ?? null;
  const publisherHandle = row ? ownerFromUrl(row.source_url) : "";
  const installs = (row?.skill_signal?.install_count_estimate ?? 0) + (row?.skill_signal?.install_count ?? 0);
  const stars = row?.skill_signal?.stars ?? 0;

  const shelfLabel = shelf
    ? (subShelf ? `${shelf} / ${subShelf}` : shelf)
    : null;

  const font = loadFont();

  const fontSize = title.length > 70 ? 40 : title.length > 50 ? 48 : title.length > 35 ? 54 : 60;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#efece4",
          display: "flex",
          flexDirection: "column",
          padding: "60px 80px",
          fontFamily: "Geist",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#d8581c", flexShrink: 0 }} />
          <span style={{ fontSize: 20, color: "#1c1b18", letterSpacing: "-0.01em" }}>
            Claudinho
          </span>
        </div>

        {/* Shelf pill */}
        {shelfLabel && (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              background: "#e4e0d8",
              borderRadius: 999,
              padding: "4px 14px",
              marginBottom: 18,
            }}
          >
            <span style={{ fontSize: 13, color: "#45413b", letterSpacing: "0.03em" }}>
              {shelfLabel}
            </span>
          </div>
        )}

        {/* Skill title */}
        <div
          style={{
            display: "flex",
            fontSize,
            color: "#1c1b18",
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            maxWidth: 1000,
            flex: 1,
          }}
        >
          <span>{title}</span>
        </div>

        {/* Best-for line */}
        {bestFor && (
          <div style={{ display: "flex", marginTop: 16, marginBottom: 8 }}>
            <span style={{ fontSize: 18, color: "#7a7468", lineHeight: 1.4, maxWidth: 800 }}>
              {bestFor.length > 120 ? bestFor.slice(0, 117) + "…" : bestFor}
            </span>
          </div>
        )}

        {/* Bottom row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: 24,
            paddingTop: 20,
            borderTop: "1px solid #ddd2b8",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {publisherHandle ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 12, color: "#7a7468", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  creator
                </span>
                <span style={{ fontSize: 18, color: "#1c1b18" }}>
                  {publisherHandle}
                </span>
              </div>
            ) : null}
            {installs > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 12, color: "#7a7468", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  installs
                </span>
                <span style={{ fontSize: 18, color: "#1c1b18" }}>
                  {fmtCount(installs)}
                </span>
              </div>
            ) : null}
            {stars > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 12, color: "#7a7468", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  gh ★
                </span>
                <span style={{ fontSize: 18, color: "#1c1b18" }}>
                  {fmtCount(stars)}
                </span>
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#2e8a4f" }} />
              <span style={{ fontSize: 13, color: "#45413b", letterSpacing: "0.02em" }}>
                verified
              </span>
            </div>
            <span style={{ fontSize: 14, color: "#7a7468", letterSpacing: "0.04em" }}>
              claudinho.xyz
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Geist", data: font, weight: 400, style: "normal" }],
    }
  );
}
