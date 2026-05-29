interface ShelfGlyphProps {
  id: string;
  size?: number;
}

export function ShelfGlyph({ id, size = 16 }: ShelfGlyphProps) {
  const s = size;
  const p = {
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const glyphs: Record<string, React.ReactNode> = {
    product: (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <polygon points="8,2 14,12 2,12" {...p} />
      </svg>
    ),
    eng: (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <polyline points="6,3 2,8 6,13" {...p} />
        <polyline points="10,3 14,8 10,13" {...p} />
      </svg>
    ),
    design: (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <circle cx="6" cy="6" r="3.5" {...p} />
        <rect x="7" y="7" width="7" height="7" {...p} />
      </svg>
    ),
    marketing: (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="2" {...p} />
        <line x1="8" y1="2" x2="8" y2="4" {...p} />
        <line x1="8" y1="12" x2="8" y2="14" {...p} />
        <line x1="2" y1="8" x2="4" y2="8" {...p} />
        <line x1="12" y1="8" x2="14" y2="8" {...p} />
        <line x1="3.5" y1="3.5" x2="5" y2="5" {...p} />
        <line x1="11" y1="11" x2="12.5" y2="12.5" {...p} />
        <line x1="3.5" y1="12.5" x2="5" y2="11" {...p} />
        <line x1="11" y1="5" x2="12.5" y2="3.5" {...p} />
      </svg>
    ),
    sales: (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <line x1="3" y1="13" x2="3" y2="10" {...p} />
        <line x1="8" y1="13" x2="8" y2="6" {...p} />
        <line x1="13" y1="13" x2="13" y2="2" {...p} />
      </svg>
    ),
    cs: (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <path
          d="M2 7c0-2.2 2.7-4 6-4s6 1.8 6 4-2.7 4-6 4c-.7 0-1.4-.1-2-.2L3 12l1-2.4C2.7 8.8 2 7.9 2 7z"
          {...p}
        />
      </svg>
    ),
    ops: (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <line x1="8" y1="2" x2="8" y2="14" {...p} />
        <line x1="2" y1="8" x2="14" y2="8" {...p} />
        <line x1="3.8" y1="3.8" x2="12.2" y2="12.2" {...p} />
        <line x1="3.8" y1="12.2" x2="12.2" y2="3.8" {...p} />
      </svg>
    ),
    finance: (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <ellipse cx="8" cy="5" rx="5" ry="2" {...p} />
        <path d="M3 5v6c0 1.1 2.2 2 5 2s5-.9 5-2V5" {...p} />
        <path d="M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" {...p} />
      </svg>
    ),
  };

  return (glyphs[id] as React.ReactElement) || null;
}
