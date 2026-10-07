/**
 * Generates two fictitious .xlsx exports in testdata/fictief/:
 * - Lijst_FvB_<datum>.xlsx: the HR export, same structure as the real "Lijst FvB"
 *   (sheet "DG MW in dienst", title rows, columns) — identical to the AI & data dashboard;
 * - SPP_export_IJK_<datum>.xlsx: the SPP export in the delivered format: no header row, columns
 *   A personnel number · B name · C company · D manager · E quadrant.
 *
 * Companies, organisational units and headcounts follow the real structure
 * (scripts/data/organisatie-2026.ts); names, e-mail addresses, managers and quadrants are fictitious.
 * Deterministic: a seeded PRNG makes the output identical on every run.
 * All e-mail addresses end in `.example`.
 *
 * Usage: npm run testdata
 */
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEDRIJVEN, type Bedrijf } from '../src/core/config/bedrijven';
import { DEMO_HR_BESTAND, DEMO_SPP_BESTAND } from '../src/data/demoConfig';
import { ORGANISATIE_2026 } from './data/organisatie-2026';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'testdata', 'fictief');
const PEILDATUM = new Date(Date.UTC(2026, 9, 1)); // 1 Oct 2026

// --- Seeded PRNG (mulberry32) ---------------------------------------------------------
let seed = 20261001;
function rnd(): number {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];

// --- Fictitious names ------------------------------------------------------------------
const VOORNAMEN = [
  'Anouk', 'Bram', 'Charlotte', 'Daan', 'Eva', 'Floor', 'Gijs', 'Hanna', 'Ilse', 'Joost',
  'Kim', 'Lars', 'Maud', 'Niels', 'Olga', 'Pim', 'Quinten', 'Roos', 'Sander', 'Tessa',
  'Ugo', 'Vera', 'Wout', 'Xander', 'Yara', 'Zeno', 'Amira', 'Bilal', 'Chen', 'Dewi',
  'Emre', 'Fleur', 'Gerrit', 'Hatice', 'Ivo', 'Jolien', 'Koen', 'Lotte', 'Mees', 'Noor',
];
const ACHTERNAMEN = [
  'Akkerman', 'Bosveld', 'Claessen', 'Dijkhoff', 'Elzinga', 'Feenstra', 'Groenewoud',
  'Hofstede', 'IJzerman', 'Jansma', 'Kloosterboer', 'Lindeman', 'Mulderij', 'Nieuwland',
  'Oosterhof', 'Postma', 'Quaedvlieg', 'Rietveld', 'Schoonhoven', 'Terpstra', 'Uiterwijk',
  'Vermeulen', 'Wildschut', 'Zandbergen', 'Brouwershaven', 'Kortenhoeven', 'Meerdink',
];
const TUSSENVOEGSELS = ['', '', '', '', 'van', 'de', 'van der', 'van den', 'ter'];

interface Mw {
  personeelsnummer: number;
  naam: string;
  email: string;
  bedrijf: Bedrijf;
  afdeling: string;
  leidinggevende: string;
}

function maakMedewerkers(): Mw[] {
  const gebruikt = new Set<string>();
  const lijst: Mw[] = [];
  for (const [werkgevernaam, oes] of Object.entries(ORGANISATIE_2026)) {
    const b = BEDRIJVEN.find((x) => x.werkgevernaam === werkgevernaam);
    if (!b) throw new Error(`Bedrijf ontbreekt in src/core/config/bedrijven.ts: ${werkgevernaam}`);
    for (const [afd, aantal] of oes) {
      // Large units have two managers
      const leiding = [`${pick(VOORNAMEN)} ${pick(ACHTERNAMEN)}`, `${pick(VOORNAMEN)} ${pick(ACHTERNAMEN)}`];
      for (let i = 0; i < aantal; i++) {
        let voornaam: string, tv: string, achternaam: string, email: string;
        do {
          voornaam = pick(VOORNAMEN);
          tv = pick(TUSSENVOEGSELS);
          achternaam = pick(ACHTERNAMEN);
          email = `${`${voornaam}.${tv.replace(/ /g, '')}${achternaam}`.toLowerCase()}@${b.code}.example`;
        } while (gebruikt.has(email));
        gebruikt.add(email);
        lijst.push({
          personeelsnummer: 2000 + lijst.length,
          naam: `${voornaam} ${tv ? `${tv} ` : ''}${achternaam}`,
          email,
          bedrijf: b,
          afdeling: afd, // shown exactly as in the source, including the prefix
          leidinggevende: aantal > 12 && i >= aantal / 2 ? leiding[1] : leiding[0],
        });
      }
    }
  }
  return lijst;
}

// Spelling variants as they might appear in the export (the dashboard must recognise all of them)
const SCHRIJFWIJZEN: Record<string, string[]> = {
  talent: ['Talent\\voorloper', 'Talent\\voorloper', 'Talent/voorloper', 'Talent'],
  vaste_waarde: ['Vaste waarde\\sterkhouder', 'Vaste waarde\\sterkhouder', 'Vaste waarde/sterkhouder', 'Sterkhouder'],
  vraagteken: ['Vraagteken', 'vraagteken'],
  achterblijver: ['Achterblijver', 'ACHTERBLIJVER'],
};

/** Deterministic profile per company and department: how many are scored and how the quadrants are spread. */
function profiel(sleutel: string) {
  const h = [...sleutel].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  const f = (x: number) => ((h >>> x) % 1000) / 1000;
  return {
    gescoord: 0.55 + f(0) * 0.42,
    gewichten: { talent: 0.12 + f(3) * 0.2, vaste_waarde: 0.35 + f(6) * 0.25, vraagteken: 0.08 + f(9) * 0.2, achterblijver: 0.04 + f(12) * 0.16 },
  };
}

function kiesKwadrant(gewichten: Record<string, number>): string {
  const totaal = Object.values(gewichten).reduce((a, b) => a + b, 0);
  let r = rnd() * totaal;
  for (const [k, w] of Object.entries(gewichten)) {
    if ((r -= w) <= 0) return k;
  }
  return 'vaste_waarde';
}

function nieuwWerkboek(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  // Fixed metadata so the generated files are byte-for-byte reproducible
  wb.creator = 'genereer-testdata (fictief)';
  wb.created = PEILDATUM;
  wb.modified = PEILDATUM;
  return wb;
}

async function schrijfHr(medewerkers: Mw[]) {
  const wb = nieuwWerkboek();
  const ws = wb.addWorksheet('DG MW in dienst');
  ws.addRow(['Lijst FvB — medewerkers in dienst (FICTIEF)']);
  ws.addRow(['Peildatum: 01-10-2026']);
  ws.addRow([]);
  // Like the real export: no personnel number column (matching is done on name)
  ws.addRow(['Naam', 'E-mail werk', 'Werkgevernaam', 'Org. eenheid omschrijving', 'Leidinggevende', 'Functie']);
  medewerkers.forEach((m, i) => {
    ws.addRow([
      m.naam,
      i % 23 === 0 ? m.email.toUpperCase() : m.email,
      m.bedrijf.werkgevernaam,
      m.afdeling,
      m.leidinggevende,
      pick(['Medewerker', 'Senior medewerker', 'Specialist', 'Coördinator', 'Adviseur']),
    ]);
  });
  await wb.xlsx.writeFile(join(OUT_DIR, DEMO_HR_BESTAND));
}

type SppRegel = [personeelsnummer: number | null, naam: string, bedrijf: string, leidinggevende: string, kwadrant: string];

async function schrijfSpp(rijen: SppRegel[]) {
  const wb = nieuwWerkboek();
  const ws = wb.addWorksheet('Blad1');
  // Like the delivered export: no title or header row, data starts in row 1
  for (const r of rijen) ws.addRow(r);
  await wb.xlsx.writeFile(join(OUT_DIR, DEMO_SPP_BESTAND));
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const medewerkers = maakMedewerkers();
  // The SPP export only covers IJK (the HR export covers the whole group)
  const ijk = medewerkers.filter((m) => m.bedrijf.code === 'ijk' || m.bedrijf.code === 'ijkservices');
  const spp: SppRegel[] = ijk.map((m) => {
    const p = profiel(`${m.bedrijf.code}|${m.afdeling}`);
    const kwadrant = rnd() < p.gescoord ? pick(SCHRIJFWIJZEN[kiesKwadrant(p.gewichten)]) : '';
    return [m.personeelsnummer, m.naam, m.bedrijf.werkgevernaam, m.leidinggevende, kwadrant];
  });

  // Edge cases
  spp.push([90001, 'Stagiair Extern', 'IJK B.V.', ijk[0].leidinggevende, 'Vraagteken']); // not in the HR list
  spp.push([90002, 'Oud Medewerker', 'IJK Services B.V.', ijk[1].leidinggevende, '']); // not in the HR list, not scored
  const dubbel = ijk[5];
  spp.push([dubbel.personeelsnummer, dubbel.naam, dubbel.bedrijf.werkgevernaam, dubbel.leidinggevende, 'Talent\\voorloper']); // duplicate row
  spp[42][4] = 'Ster'; // unknown quadrant value

  await schrijfHr(medewerkers);
  await schrijfSpp(spp);
  console.log(`Testdata gegenereerd in ${OUT_DIR}: ${medewerkers.length} HR-medewerkers, ${spp.length} SPP-rijen.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
