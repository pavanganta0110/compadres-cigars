import { useId } from "react";

/**
 * Lion Cigars seal, drawn in code (no picture, so the name is always right and it stays sharp at any size).
 * Decorative: the business name is always written next to it in text.
 */
export function LionMark({ size = 64, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs>
        <path id={`${id}t`} d="M 22,60 A 38,38 0 0 1 98,60" />
        <path id={`${id}b`} d="M 14,60 A 46,46 0 0 0 106,60" />
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f0cf8c" /><stop offset=".55" stopColor="#d6ad68" /><stop offset="1" stopColor="#a8782f" /></linearGradient>
      </defs>
      <circle cx="60" cy="60" r="57" fill="#17120f" stroke={`url(#${id}g)`} strokeWidth="2.4" />
      <circle cx="60" cy="60" r="52" fill="none" stroke={`url(#${id}g)`} strokeWidth=".8" />
      <circle cx="60" cy="60" r="34" fill="none" stroke={`url(#${id}g)`} strokeWidth=".8" />
      <g fill={`url(#${id}g)`} fontFamily="var(--font-label), Georgia, serif" fontWeight="600" letterSpacing="2.2">
        <text fontSize="10.5" textAnchor="middle"><textPath href={`#${id}t`} startOffset="50%">LION CIGARS</textPath></text>
        <text fontSize="8.6" textAnchor="middle" letterSpacing="1.6"><textPath href={`#${id}b`} startOffset="50%">PREMIUM · DOMINICAN</textPath></text>
      </g>
      <path d="M48 44 L51 35 L55 41 L60 32 L65 41 L69 35 L72 44 Z" fill={`url(#${id}g)`} />
      <text x="60" y="76" textAnchor="middle" fontSize="34" fontWeight="700" fill={`url(#${id}g)`} fontFamily="var(--font-display), Georgia, serif">L</text>
    </svg>
  );
}
