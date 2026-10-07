import type { Cel, Tabel } from '../types';

export const normaliseerKop = (s: string) => s.trim().toLowerCase().replace(/[\s_]+/g, ' ').replace(/[.:]+$/, '');

export const normaliseerEmail = (s: string) => s.trim().toLowerCase();

export function celTekst(c: Cel | undefined): string {
  if (c === null || c === undefined) return '';
  if (c instanceof Date) return c.toISOString();
  return String(c).trim();
}

/** One column: one or more accepted header names (the export's exact naming is not fixed). */
export interface KolomDef {
  namen: readonly string[];
  verplicht: boolean;
}

const alsLijst = (namen: string | readonly string[]) => (typeof namen === 'string' ? [namen] : namen);

/**
 * Finds the header row dynamically: the first row that contains a cell equal to one of
 * `koppen` (case/whitespace-insensitive). Returns -1 when not found.
 */
export function vindKoprij(tabel: Tabel, koppen: string | readonly string[]): number {
  const doel = new Set(alsLijst(koppen).map(normaliseerKop));
  return tabel.findIndex((rij) => rij.some((c) => typeof c === 'string' && doel.has(normaliseerKop(c))));
}

export class ParseFout extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseFout';
  }
}

/**
 * Maps the requested columns to their index in the header row (-1 when an optional column is absent).
 * Only the requested columns are returned (data minimisation): other columns are never read.
 */
export function kolomIndices<K extends string>(kop: Cel[], kolommen: Record<K, KolomDef>, bron: string): Record<K, number> {
  const posities = new Map<string, number>();
  kop.forEach((c, i) => {
    if (typeof c === 'string' && !posities.has(normaliseerKop(c))) posities.set(normaliseerKop(c), i);
  });
  const res = {} as Record<K, number>;
  const ontbrekend: string[] = [];
  for (const [key, def] of Object.entries(kolommen) as [K, KolomDef][]) {
    const idx = def.namen.map((n) => posities.get(normaliseerKop(n))).find((i) => i !== undefined) ?? -1;
    if (idx < 0 && def.verplicht) ontbrekend.push(def.namen.map((n) => `"${n}"`).join(' of '));
    res[key] = idx;
  }
  if (ontbrekend.length) {
    throw new ParseFout(`${bron}: verplichte kolom(men) ontbreken: ${ontbrekend.join('; ')}.`);
  }
  return res;
}

export const isLegeRij = (rij: Cel[]) => rij.every((c) => celTekst(c) === '');

/** Personnel numbers: "00123", 123 and "123.0" are the same number. */
export function normaliseerPersoneelsnummer(c: Cel | undefined): string | null {
  const t = celTekst(c).replace(/\s+/g, '');
  if (!t) return null;
  if (/^\d+(\.0+)?$/.test(t)) return String(Number.parseInt(t, 10));
  return t.toLowerCase();
}

/**
 * Normalises a person's name for matching: diacritics, case, punctuation and spacing are
 * ignored, and "Achternaam, Voornaam tussenvoegsel" is turned into "voornaam tussenvoegsel achternaam".
 */
export function normaliseerNaam(naam: string): string {
  let n = naam.trim();
  const komma = n.indexOf(',');
  if (komma > 0) n = `${n.slice(komma + 1)} ${n.slice(0, komma)}`;
  return n
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
