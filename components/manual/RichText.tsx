import { Fragment, type ReactNode } from "react";

// Renders authored copy with minimal **bold** markup. Trusted content only —
// no arbitrary HTML, just bold spans split on the `**…**` delimiter.
export function RichText({ text }: { text: string }): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <b key={i}>{part.slice(2, -2)}</b>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}
