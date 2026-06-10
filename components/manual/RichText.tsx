import { Fragment, type ReactNode } from "react";
import Link from "next/link";

// Renders authored copy with minimal markup: **bold** spans and internal
// [text](/href) links. Trusted content only — no arbitrary HTML.
export function RichText({ text }: { text: string }): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <b key={i}>{part.slice(2, -2)}</b>;
        }
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return (
            <Link key={i} href={link[2]} className="mn-inline-link">
              {link[1]}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
