import { ImageResponse } from "next/og";
import { getSkillBySlug, ownerFromUrl } from "@/lib/db";
import { fmtCount } from "@/lib/data";

export const runtime = "edge";
export const alt = "Claudinho skill";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = await getSkillBySlug(slug);

  const title = row?.skill_name ?? "Skill not found";
  const publisherHandle = row ? ownerFromUrl(row.source_url) : "";
  const installs = row?.skill_signal?.install_count_estimate ?? 0;
  const category = row?.category ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#efece4",
          display: "flex",
          flexDirection: "column",
          padding: "64px 80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#d8581c",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "#1c1b18",
              letterSpacing: "-0.02em",
            }}
          >
            Claudinho
          </span>
        </div>

        {/* Category */}
        {category && (
          <div
            style={{
              fontSize: 15,
              fontFamily: "monospace",
              color: "#8e8b82",
              letterSpacing: "0.04em",
              marginBottom: 20,
              display: "flex",
            }}
          >
            {category}
          </div>
        )}

        {/* Skill title */}
        <div
          style={{
            fontSize: title.length > 60 ? 44 : title.length > 40 ? 52 : 58,
            fontWeight: 700,
            color: "#1c1b18",
            lineHeight: 1.08,
            letterSpacing: "-0.032em",
            maxWidth: 960,
            flex: 1,
          }}
        >
          {title}
        </div>

        {/* Bottom row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: 32,
            borderTop: "1px solid #d9d6cc",
          }}
        >
          {/* Publisher + install count */}
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {publisherHandle && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontFamily: "monospace", color: "#8e8b82", letterSpacing: "0.04em" }}>
                  publisher
                </span>
                <span style={{ fontSize: 20, fontWeight: 600, color: "#1c1b18", letterSpacing: "-0.015em" }}>
                  {publisherHandle}
                </span>
              </div>
            )}
            {installs > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontFamily: "monospace", color: "#8e8b82", letterSpacing: "0.04em" }}>
                  installs
                </span>
                <span style={{ fontSize: 20, fontWeight: 600, color: "#1c1b18", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums" }}>
                  {fmtCount(installs)}
                </span>
              </div>
            )}
          </div>

          {/* Verified + domain */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2e8a4f" }} />
              <span style={{ fontSize: 14, fontFamily: "monospace", color: "#54524c", letterSpacing: "0.02em" }}>
                verified
              </span>
            </div>
            <span style={{ fontSize: 16, fontFamily: "monospace", color: "#8e8b82", letterSpacing: "0.04em" }}>
              claudinho.xyz
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
