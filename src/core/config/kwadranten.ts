/**
 * The four SPP quadrants (strategische personeelsplanning) plus "niet gescoord".
 * The order is fixed: it is the order of the stacked bars, legends and tables, and the
 * colours follow the entity (never the rank).
 */
export const KWADRANTEN = ['talent', 'vaste_waarde', 'vraagteken', 'achterblijver'] as const;
export type Kwadrant = (typeof KWADRANTEN)[number];

export const SPP_STATUSSEN = [...KWADRANTEN, 'niet_gescoord'] as const;
export type SppStatus = (typeof SPP_STATUSSEN)[number];

export const STATUS_LABELS: Record<SppStatus, string> = {
  talent: 'Talent/voorloper',
  vaste_waarde: 'Vaste waarde/sterkhouder',
  vraagteken: 'Vraagteken',
  achterblijver: 'Achterblijver',
  niet_gescoord: 'Niet gescoord',
};

/** Short labels for narrow table headers. */
export const KORTE_LABELS: Record<SppStatus, string> = {
  talent: 'Talent',
  vaste_waarde: 'Vaste waarde',
  vraagteken: 'Vraagteken',
  achterblijver: 'Achterblijver',
  niet_gescoord: 'Niet gescoord',
};

/**
 * The 2×2 SPP matrix as used at the Driessen Groep ("Potentieel en prestatiematrix"):
 * horizontal = prestatie (low → high), vertical = groeiruimte (low at the top → high at the bottom).
 */
export const MATRIX_ASSEN = {
  x: { titel: 'Prestatie' },
  y: { titel: 'Groeiruimte' },
};
export const MATRIX_POSITIE: Record<Kwadrant, { rij: 1 | 2; kolom: 1 | 2 }> = {
  achterblijver: { rij: 1, kolom: 1 },
  vaste_waarde: { rij: 1, kolom: 2 },
  vraagteken: { rij: 2, kolom: 1 },
  talent: { rij: 2, kolom: 2 },
};

/**
 * Reading order of the matrix (top-left → bottom-right), followed by "niet gescoord".
 * Used for the key-figure tiles and the quadrant choice in the comparison, so they match the matrix.
 * (Stacked bars keep SPP_STATUSSEN: there Talent must not sit next to the grey "niet gescoord".)
 */
export const MATRIX_VOLGORDE: readonly SppStatus[] = ['achterblijver', 'vaste_waarde', 'vraagteken', 'talent', 'niet_gescoord'];

/** What each quadrant asks of the manager (from the matrix). */
export const KWADRANT_ACTIE: Record<Kwadrant, string> = {
  achterblijver: 'eerlijke aandacht',
  vaste_waarde: 'koesteren',
  vraagteken: 'uitdagen',
  talent: 'faciliteren',
};

const normaliseer = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Words that mean "not scored" (besides an empty cell). */
const NIET_GESCOORD = new Set(['', 'niet gescoord', 'nog niet gescoord', 'geen', 'geen score', 'niet geplot', 'nvt', 'n v t', 'onbekend', '-']);

const HERKENNING: [Kwadrant, string[]][] = [
  ['talent', ['talent', 'voorloper', 'talenten', 'voorlopers']],
  ['vaste_waarde', ['vaste waarde', 'vaste waarden', 'sterkhouder', 'sterkhouders']],
  ['vraagteken', ['vraagteken', 'vraagtekens']],
  ['achterblijver', ['achterblijver', 'achterblijvers']],
];

/**
 * Maps the raw quadrant value from the export. Case, punctuation and extra words are
 * ignored ("Talent / Voorloper", "Kwadrant: Vaste waarde"). Returns:
 * - a quadrant, or 'niet_gescoord' for an empty / "not scored" value;
 * - null for a value that cannot be recognised (goes to the exception list).
 */
export function mapKwadrant(ruw: string): SppStatus | null {
  const n = normaliseer(ruw);
  if (NIET_GESCOORD.has(n)) return 'niet_gescoord';
  const woorden = ` ${n} `;
  const treffers = HERKENNING.filter(([, termen]) => termen.some((t) => woorden.includes(` ${t} `))).map(([k]) => k);
  return treffers.length === 1 ? treffers[0] : null;
}
