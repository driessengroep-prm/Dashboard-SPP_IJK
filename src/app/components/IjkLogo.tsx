/**
 * Simplified IJK word mark in Blad green (text + the circled "d" of the Driessen family).
 * Placeholder: the official logo set can be requested via marketing@driessengroep.nl and
 * placed here as an inline SVG.
 */
export function IjkLogo() {
  return (
    <svg viewBox="0 0 74 44" role="img" aria-label="IJK" fill="currentColor">
      <text x="0" y="31" fontFamily="var(--font-kop)" fontWeight="700" fontSize="34" letterSpacing="-1">
        ijk
      </text>
      <circle cx="63" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <text x="63" y="14.2" textAnchor="middle" fontFamily="var(--font-kop)" fontWeight="700" fontSize="11">
        d
      </text>
    </svg>
  );
}
