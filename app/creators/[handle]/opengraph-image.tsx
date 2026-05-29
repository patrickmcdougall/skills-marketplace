import { ImageResponse } from "next/og";
import { getSkillsByOwner } from "@/lib/db";
import { PUBLISHERS } from "@/lib/data";
import { fmtCount } from "@/lib/data";

export const runtime = "edge";
export const alt = "Claudinho creator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  const catalog = PUBLISHERS[handle];
  const name = catalog?.name ?? handle;
  const role = catalog?.role ?? null;

  // Get skill count from DB
  const skills = await getSkillsByOwner(handle, 100);
  const skillCount = skills.length;
  const totalInstalls = skills.reduce(
    (a, s) => a + (s.skill_signal?.install_count_estimate ?? 0),
    0
  );

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
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 48 }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#d8581c", flexShrink: 0 }} />
          <span style={{ fontSize: 22, fontWeight: 600, color: "#1c1b18", letterSpacing: "-0.02em" }}>
            Claudinho
          </span>
        </div>

        {/* Creator name */}
        <div
          style={{
            fontSize: name.length > 24 ? 52 : name.length > 16 ? 64 : 72,
            fontWeight: 700,
            color: "#1c1b18",
            lineHeight: 1.05,
            letterSpacing: "-0.034em",
            flex: 1,
          }}
        >
          {name}
        </div>

        {/* Role */}
        {role && (
          <div style={{ fontSize: 20, color: "#54524c", marginBottom: 32, display: "flex" }}>
            {role}
          </div>
        )}

        {/* Bottom row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            paddingTop: 28,
            borderTop: "1px solid #d9d6cc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {skillCount > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontFamily: "monospace", color: "#8e8b82", letterSpacing: "0.04em" }}>
                  skills
                </span>
                <span style={{ fontSize: 20, fontWeight: 600, color: "#1c1b18", letterSpacing: "-0.015em" }}>
                  {skillCount}
                </span>
              </div>
            )}
            {totalInstalls > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontFamily: "monospace", color: "#8e8b82", letterSpacing: "0.04em" }}>
                  installs
                </span>
                <span style={{ fontSize: 20, fontWeight: 600, color: "#1c1b18", letterSpacing: "-0.015em" }}>
                  {fmtCount(totalInstalls)}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2e8a4f" }} />
              <span style={{ fontSize: 14, fontFamily: "monospace", color: "#54524c", letterSpacing: "0.02em" }}>
                verified registry
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
