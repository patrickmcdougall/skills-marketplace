import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#efece4",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 48 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#F25C1F",
            }}
          />
          <span style={{ fontSize: 28, fontWeight: 600, color: "#1A1A18", letterSpacing: "-0.02em" }}>
            Claudinho
          </span>
        </div>

        {/* headline */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#1A1A18",
            lineHeight: 1.05,
            letterSpacing: "-0.035em",
            maxWidth: 900,
          }}
        >
          Skills, built by the{" "}
          <span style={{ color: "#F25C1F" }}>community.</span>
        </div>

        {/* sub */}
        <div
          style={{
            marginTop: 32,
            fontSize: 24,
            color: "#54524c",
            lineHeight: 1.5,
            maxWidth: 720,
          }}
        >
          Every skill is installed, run on a real input, and re-verified weekly.
        </div>

        {/* url */}
        <div
          style={{
            position: "absolute",
            bottom: 64,
            right: 96,
            fontSize: 18,
            color: "#8e8b82",
            fontFamily: "monospace",
            letterSpacing: "0.04em",
          }}
        >
          claudinho.xyz
        </div>
      </div>
    ),
    { ...size }
  );
}
