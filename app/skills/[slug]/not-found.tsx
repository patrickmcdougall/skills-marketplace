import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { REAL_STATS } from "@/lib/data";

export default function SkillNotFound() {
  const stats = REAL_STATS;

  return (
    <div className="lp dp accent-orange bg-cream">
      <Nav stats={stats} />

      <main className="dp-page" style={{ paddingTop: 96, paddingBottom: 120 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 28,
            maxWidth: 560,
          }}
        >
          <span className="lp-eyebrow">
            <span className="dot" />
            404 · not found
          </span>

          <h1
            style={{
              fontFamily: "var(--font-geist-sans), sans-serif",
              fontWeight: 600,
              fontSize: "clamp(32px, 4vw, 48px)",
              lineHeight: 1.05,
              letterSpacing: "-0.034em",
              margin: 0,
              color: "var(--ink)",
            }}
          >
            This one&rsquo;s not on the squad.
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--ink-2)",
              maxWidth: "52ch",
            }}
          >
            No skill at that address — it may have been removed, renamed, or
            never existed. Check the slug and try again, or browse the full
            roster.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
            <Link href="/browse" className="lp-btn accent">
              Browse all skills
            </Link>
            <Link href="/publishers" className="lp-btn">
              See the table
            </Link>
          </div>
        </div>
      </main>

      <Footer stats={stats} />
    </div>
  );
}
