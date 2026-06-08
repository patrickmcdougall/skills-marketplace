interface ClaudinhoLogoProps {
  dark?: boolean;
  height?: number;
}

export function ClaudinhoLogo({ dark = false, height = 34 }: ClaudinhoLogoProps) {
  const width = Math.round((height * 300) / 110);
  const textColor = dark ? "#F7F5EF" : "#1A1A18";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 300 110"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Claudinho"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* mascot: symbol viewBox 0 0 100 100, placed at x=18 y=23 w=64 h=64 → scale(0.64) translate */}
      <g transform="translate(18,23) scale(0.64,0.64)">
        <rect x="12" y="20" width="76" height="74" rx="25" fill="#F25C1F" />
        <rect x="46" y="3" width="8" height="15" rx="4" fill="#F25C1F" transform="rotate(0 50 17)" />
        <rect x="46" y="3" width="8" height="15" rx="4" fill="#F25C1F" transform="rotate(-38 50 17)" />
        <rect x="46" y="3" width="8" height="15" rx="4" fill="#F25C1F" transform="rotate(38 50 17)" />
        <circle cx="38" cy="50" r="8" fill="#FFFFFF" />
        <circle cx="62" cy="50" r="8" fill="#FFFFFF" />
        <circle cx="38" cy="51" r="3.6" fill="#1A1A18" />
        <circle cx="62" cy="51" r="3.6" fill="#1A1A18" />
        <circle cx="40" cy="49" r="1.4" fill="#FFFFFF" />
        <circle cx="64" cy="49" r="1.4" fill="#FFFFFF" />
        <path d="M36 68 Q50 80 64 68" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
      {/* wordmark */}
      <text
        x="96"
        y="80"
        fontFamily="Geist, 'Geist Sans', Inter, system-ui, -apple-system, sans-serif"
        fontSize="36"
        fontWeight="600"
        letterSpacing="-0.5"
      >
        <tspan fill={textColor}>claud</tspan>
        <tspan fill="#F25C1F">inho</tspan>
      </text>
    </svg>
  );
}
