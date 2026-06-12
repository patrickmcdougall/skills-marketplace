import type { RichBlock } from "@/lib/manual";
import { RichText } from "./RichText";
import { SurfaceGrid } from "./SurfaceGrid";
import { FeatureList } from "./FeatureList";
import { CoworkWalkthrough } from "./CoworkWalkthrough";

// Renders a guide page's body blocks — shared by the Getting-started pages and
// the Features overview so the block switch lives in one place.
export function GuideBody({ body }: { body: RichBlock[] }) {
  return (
    <>
      {body.map((block, i) => {
        switch (block.kind) {
          case "p":
            return (
              <p key={i}>
                <RichText text={block.text} />
              </p>
            );
          case "h2":
            return (
              <h2 className="mn-h2" key={i}>
                {block.text}
              </h2>
            );
          case "tip":
            return (
              <aside className="mn-tip" key={i}>
                <span className="mn-tip-label">{block.label ?? "Tip"}</span>
                <p>
                  <RichText text={block.text} />
                </p>
              </aside>
            );
          case "callout":
            return (
              <div className="mn-callout" key={i}>
                <div className="mn-callout-title">{block.title}</div>
                <p>
                  <RichText text={block.text} />
                </p>
              </div>
            );
          case "list":
            return (
              <ul className="mn-list" key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>
                    <RichText text={item} />
                  </li>
                ))}
              </ul>
            );
          case "surface-grid":
            return <SurfaceGrid key={i} rows={block.rows} />;
          case "feature-list":
            return <FeatureList key={i} features={block.features} />;
          case "cowork-walkthrough":
            return <CoworkWalkthrough key={i} intro={block.intro} steps={block.steps} />;
        }
      })}
    </>
  );
}
