import { mapKwadrant } from '../config/kwadranten';
import type { Cel, SppRij, Tabel } from '../types';
import { ParseFout, celTekst, isLegeRij, kolomIndices, normaliseerEmail, normaliseerKop, normaliseerPersoneelsnummer, vindKoprij, type KolomDef } from './tabel';

type SppKolom = 'naam' | 'email' | 'personeelsnummer' | 'bedrijf' | 'leidinggevende' | 'kwadrant';

/**
 * Accepted column headers when the SPP export has a header row (case, spaces and a
 * trailing period are ignored). Add a variant here when the export uses another header.
 */
export const SPP_KOLOMMEN: Record<SppKolom, KolomDef> = {
  naam: { namen: ['Naam', 'Naam medewerker', 'Medewerker', 'Werknemer', 'Naam werknemer', 'Volledige naam'], verplicht: true },
  email: { namen: ['E-mail werk', 'E-mail', 'Email', 'E-mailadres', 'Emailadres', 'E-mail medewerker', 'Zakelijk e-mailadres'], verplicht: false },
  personeelsnummer: {
    namen: ['Personeelsnummer', 'Personeelsnr', 'Pers.nr', 'Pers. nr', 'Pnr', 'Nummer', 'Nr', 'Medewerkernummer', 'Werknemersnummer'],
    verplicht: false,
  },
  bedrijf: { namen: ['Bedrijf', 'Werkgever', 'Werkgevernaam', 'Bedrijfsnaam'], verplicht: false },
  leidinggevende: { namen: ['Leidinggevende', 'Naam leidinggevende', 'Leidinggevende naam', 'Manager'], verplicht: false },
  kwadrant: {
    namen: ['SPP-kwadrant', 'SPP kwadrant', 'Kwadrant', 'SPP', 'SPP-score', 'SPP score', 'SPP-positie', 'Score', 'Positie', 'Plot', 'Categorie'],
    verplicht: true,
  },
};

/**
 * Column layout of the SPP export without a header row (as delivered):
 * A personnel number · B name · C company · D manager · E quadrant.
 */
export const SPP_VASTE_INDELING: Record<Exclude<SppKolom, 'email'>, number> = {
  personeelsnummer: 0,
  naam: 1,
  bedrijf: 2,
  leidinggevende: 3,
  kwadrant: 4,
};

export interface SppResultaat {
  rijen: SppRij[];
  /** False when the export has no header row and the fixed column layout was used. */
  heeftKopregel: boolean;
  heeftEmail: boolean;
  heeftPersoneelsnummer: boolean;
  heeftLeidinggevende: boolean;
}

const isKwadrant = (c: Cel | undefined) => {
  const s = mapKwadrant(celTekst(c));
  return s !== null && s !== 'niet_gescoord';
};
const isNummer = (c: Cel | undefined) => /^\d+$/.test(normaliseerPersoneelsnummer(c ?? null) ?? '');

export function parseSpp(tabel: Tabel): SppResultaat {
  const kopIdx = vindKoprij(tabel, SPP_KOLOMMEN.kwadrant.namen);
  return kopIdx >= 0 ? metKopregel(tabel, kopIdx) : zonderKopregel(tabel);
}

/** Header used by the SPP export for both the personnel number and the employee name ("Mdw."). */
const MDW = 'mdw';

/**
 * The SPP export labels two columns "Mdw.": the first holds the personnel number, the second
 * the employee name (export layout: Mdw. · Mdw. · Werkgever · Naam Leidinggevende · SPP). A single
 * "Mdw." column is a personnel number when its values are numbers, otherwise the name.
 */
function benoemMdwKolommen(tabel: Tabel, kopIdx: number): Cel[] {
  const kop = [...tabel[kopIdx]];
  const mdw = kop.flatMap((c, i) => (typeof c === 'string' && normaliseerKop(c) === MDW ? [i] : []));
  if (mdw.length >= 2) {
    kop[mdw[0]] = 'Personeelsnummer';
    kop[mdw[1]] = 'Naam';
  } else if (mdw.length === 1) {
    const waarden = tabel.slice(kopIdx + 1).map((r) => r?.[mdw[0]]).filter((c) => celTekst(c) !== '');
    const numeriek = waarden.filter((c) => /^\d+$/.test(normaliseerPersoneelsnummer(c ?? null) ?? '')).length;
    kop[mdw[0]] = waarden.length > 0 && numeriek >= waarden.length / 2 ? 'Personeelsnummer' : 'Naam';
  }
  return kop;
}

function metKopregel(tabel: Tabel, kopIdx: number): SppResultaat {
  const k = kolomIndices(benoemMdwKolommen(tabel, kopIdx), SPP_KOLOMMEN, 'SPP-export');
  const lees = (rij: Cel[], i: number) => (i >= 0 ? celTekst(rij[i]) : '');
  const rijen: SppRij[] = [];
  for (let i = kopIdx + 1; i < tabel.length; i++) {
    const rij = tabel[i] ?? [];
    if (isLegeRij(rij)) continue;
    const r: SppRij = {
      rijnummer: i + 1,
      naam: lees(rij, k.naam),
      email: normaliseerEmail(lees(rij, k.email)) || null,
      personeelsnummer: k.personeelsnummer >= 0 ? normaliseerPersoneelsnummer(rij[k.personeelsnummer]) : null,
      bedrijf: lees(rij, k.bedrijf),
      leidinggevende: lees(rij, k.leidinggevende),
      kwadrantRuw: lees(rij, k.kwadrant),
    };
    if (r.naam || r.email || r.personeelsnummer) rijen.push(r);
  }
  return { rijen, heeftKopregel: true, heeftEmail: k.email >= 0, heeftPersoneelsnummer: k.personeelsnummer >= 0, heeftLeidinggevende: k.leidinggevende >= 0 };
}

/**
 * Export without a header row: fixed layout (SPP_VASTE_INDELING). Leading rows that do not
 * look like data (no personnel number in A and no quadrant in E, e.g. a title or an
 * unrecognised header) are skipped.
 */
function zonderKopregel(tabel: Tabel): SppResultaat {
  const k = SPP_VASTE_INDELING;
  const start = tabel.findIndex((rij) => isNummer(rij?.[k.personeelsnummer]) || isKwadrant(rij?.[k.kwadrant]));
  const fout = () =>
    new ParseFout(
      'SPP-export: de kolommen zijn niet herkend. Verwacht wordt een kopregel met o.a. "Naam" en "Kwadrant", of zonder kopregel de kolommen ' +
        'A personeelsnummer, B naam, C bedrijf, D leidinggevende en E kwadrant.',
    );
  if (start < 0) throw fout();
  const rijen: SppRij[] = [];
  for (let i = start; i < tabel.length; i++) {
    const rij = tabel[i] ?? [];
    if (isLegeRij(rij)) continue;
    const naam = celTekst(rij[k.naam]);
    const personeelsnummer = normaliseerPersoneelsnummer(rij[k.personeelsnummer]);
    if (!naam && !personeelsnummer) continue;
    rijen.push({
      rijnummer: i + 1,
      naam,
      email: null,
      personeelsnummer,
      bedrijf: celTekst(rij[k.bedrijf]),
      leidinggevende: celTekst(rij[k.leidinggevende]),
      kwadrantRuw: celTekst(rij[k.kwadrant]),
    });
  }
  // Sanity check: with this layout the personnel numbers are in A; otherwise it is another file
  if (rijen.filter((r) => r.personeelsnummer && /^\d+$/.test(r.personeelsnummer)).length < rijen.length / 2) throw fout();
  return { rijen, heeftKopregel: false, heeftEmail: false, heeftPersoneelsnummer: true, heeftLeidinggevende: true };
}
