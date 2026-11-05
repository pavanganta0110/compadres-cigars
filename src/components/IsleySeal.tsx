/** Round "The Gold Standard" seal for Ronald Isley: portrait in the middle, name on the top ring, tagline on a gold band below. */
export function IsleySeal({ portrait, label }: { portrait: string; label: string }) {
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label={label} className="isley-seal">
      <defs>
        <clipPath id="isley-disc"><circle cx="200" cy="200" r="132" /></clipPath>
        <clipPath id="isley-bottom"><circle cx="200" cy="200" r="190" /></clipPath>
        <path id="isley-top-arc" d="M 38 200 A 162 162 0 0 1 362 200" />
        <path id="isley-bottom-arc" d="M 46 200 A 154 154 0 0 0 354 200" />
      </defs>
      <circle cx="200" cy="200" r="196" fill="#000" stroke="#d6ad68" strokeWidth="4" />
      <g clipPath="url(#isley-bottom)">
        <rect x="0" y="262" width="400" height="140" fill="#d6ad68" />
      </g>
      <circle cx="200" cy="200" r="138" fill="#000" stroke="#d6ad68" strokeWidth="3" />
      <image href={portrait} x="56" y="68" width="288" height="288" preserveAspectRatio="xMidYMid slice" clipPath="url(#isley-disc)" />
      <circle cx="200" cy="200" r="132" fill="none" stroke="#000" strokeWidth="2" />
      <text fontFamily="var(--font-d), Georgia, serif" fontSize="34" fontWeight="700" letterSpacing="6" fill="#fff" textAnchor="middle">
        <textPath href="#isley-top-arc" startOffset="50%">RONALD ISLEY</textPath>
      </text>
      <text fontFamily="var(--font-d), Georgia, serif" fontSize="24" fontWeight="700" letterSpacing="4" fill="#000" textAnchor="middle" dominantBaseline="hanging">
        <textPath href="#isley-bottom-arc" startOffset="50%">THE GOLD STANDARD</textPath>
      </text>
    </svg>
  );
}
