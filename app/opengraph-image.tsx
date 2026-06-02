import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const alt = "Claudinho — skills, built by the community";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function loadFont(): ArrayBuffer {
  return readFileSync(join(process.cwd(), "public/fonts/Geist-Regular.ttf")).buffer as ArrayBuffer;
}

const STATS = [
  { n: "2k+", k: "skills" },
  { n: "89", k: "publishers" },
  { n: "181", k: "topics" },
];

export default function Image() {
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 60 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#d8581c", flexShrink: 0 }} />
          <span style={{ fontSize: 20, color: "#1c1b18", letterSpacing: "-0.01em" }}>
            Claudinho
          </span>
        </div>

        {/* Hero headline */}
        <div
          style={{
            display: "flex",
            fontSize: 62,
            color: "#1c1b18",
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            maxWidth: 960,
            flex: 1,
            flexWrap: "wrap",
          }}
        >
          <span>{"Someone already built the "}</span>
          <span style={{ color: "#d8581c" }}>thing</span>
          <span>{" you wanted Claude to do."}</span>
        </div>

        {/* Subhead */}
        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: "#7a7468",
            lineHeight: 1.45,
            maxWidth: 760,
            marginBottom: 40,
          }}
        >
          <span>Two thousand community skills, sorted by the job they do.</span>
        </div>

        {/* Bottom strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 24,
            borderTop: "1px solid #ddd2b8",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {STATS.map(({ n, k }) => (
              <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 22, color: "#1c1b18" }}>{n}</span>
                <span style={{ fontSize: 13, color: "#7a7468", letterSpacing: "0.04em", textTransform: "uppercase" }}>{k}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 14, color: "#7a7468", letterSpacing: "0.04em" }}>
            claudinho.xyz
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Geist", data: font, weight: 400, style: "normal" }],
    }
  );
}
