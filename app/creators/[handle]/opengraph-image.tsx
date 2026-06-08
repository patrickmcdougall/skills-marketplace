import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";
import { getSkillsByOwner } from "@/lib/db";
import { PUBLISHERS, fmtCount } from "@/lib/data";

export const alt = "Claudinho creator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function loadFont(): ArrayBuffer {
  return readFileSync(join(process.cwd(), "public/fonts/Geist-Regular.ttf")).buffer as ArrayBuffer;
}

export default async function Image({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  const catalog = PUBLISHERS[handle];
  const name = catalog?.name ?? handle;
  const role = catalog?.role ?? null;

  const skills = await getSkillsByOwner(handle, 100);
  const skillCount = skills.length;
  const totalInstalls = skills.reduce(
    (a, s) => a + (s.skill_signal?.install_count_estimate ?? 0),
    0
  );

  const font = loadFont();

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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#F25C1F", flexShrink: 0 }} />
          <span style={{ fontSize: 20, color: "#1A1A18", letterSpacing: "-0.01em" }}>
            Claudinho
          </span>
        </div>

        {/* Creator name */}
        <div
          style={{
            display: "flex",
            fontSize: name.length > 24 ? 52 : name.length > 16 ? 64 : 72,
            color: "#1A1A18",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            flex: 1,
          }}
        >
          <span>{name}</span>
        </div>

        {/* Role */}
        {role ? (
          <div style={{ display: "flex", marginBottom: 32 }}>
            <span style={{ fontSize: 20, color: "#45413b" }}>{role}</span>
          </div>
        ) : null}

        {/* Bottom row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            paddingTop: 24,
            borderTop: "1px solid #ddd2b8",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {skillCount > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 12, color: "#7a7468", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  skills
                </span>
                <span style={{ fontSize: 20, color: "#1A1A18" }}>
                  {skillCount}
                </span>
              </div>
            ) : null}
            {totalInstalls > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 12, color: "#7a7468", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  installs
                </span>
                <span style={{ fontSize: 20, color: "#1A1A18" }}>
                  {fmtCount(totalInstalls)}
                </span>
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#2e8a4f" }} />
              <span style={{ fontSize: 13, color: "#45413b", letterSpacing: "0.02em" }}>
                verified registry
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
