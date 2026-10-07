import { bedrijfCodeVoor } from '../config/bedrijven';
import type { HrMedewerker, Tabel, Uitzondering } from '../types';
import { ParseFout, celTekst, isLegeRij, kolomIndices, normaliseerEmail, normaliseerPersoneelsnummer, vindKoprij, type KolomDef } from './tabel';

/** Same HR export ("Lijst FvB") as the AI & data training dashboard. */
export const HR_WERKBLAD = 'DG MW in dienst';
export const HR_HERKENNINGSKOP = 'Werkgevernaam';

// Data minimisation: only these columns are read. "Leidinggevende" comes from the SPP export, not from here.
const KOLOMMEN: Record<'naam' | 'email' | 'personeelsnummer' | 'werkgever' | 'afdeling', KolomDef> = {
  naam: { namen: ['Naam'], verplicht: true },
  email: { namen: ['E-mail werk'], verplicht: false },
  personeelsnummer: { namen: ['Personeelsnummer'], verplicht: false },
  werkgever: { namen: ['Werkgevernaam'], verplicht: true },
  afdeling: { namen: ['Org. eenheid omschrijving'], verplicht: true },
};

export interface HrResultaat {
  medewerkers: HrMedewerker[];
  uitzonderingen: Uitzondering[];
  /** Which optional join columns the export contains. */
  heeftEmail: boolean;
  heeftPersoneelsnummer: boolean;
}

export function parseHr(tabel: Tabel): HrResultaat {
  const kopIdx = vindKoprij(tabel, HR_HERKENNINGSKOP);
  if (kopIdx < 0) throw new ParseFout(`HR-export: geen koprij met kolom "${HR_HERKENNINGSKOP}" gevonden.`);
  const k = kolomIndices(tabel[kopIdx], KOLOMMEN, 'HR-export');
  const medewerkers: HrMedewerker[] = [];
  const uitzonderingen: Uitzondering[] = [];
  const gezienEmail = new Set<string>();

  for (let i = kopIdx + 1; i < tabel.length; i++) {
    const rij = tabel[i] ?? [];
    if (isLegeRij(rij)) continue;
    const naam = celTekst(rij[k.naam]);
    const email = k.email >= 0 ? normaliseerEmail(celTekst(rij[k.email])) || null : null;
    const werkgevernaam = celTekst(rij[k.werkgever]);
    const afdeling = celTekst(rij[k.afdeling]);
    if (!naam && !email) continue;

    if (email && gezienEmail.has(email)) {
      uitzonderingen.push({ type: 'hr_dubbel', bron: 'hr', rijnummer: i + 1, naam, detail: 'E-mailadres komt meerdere keren voor in de HR-export; eerste regel gebruikt.' });
      continue;
    }
    if (email) gezienEmail.add(email);
    const bedrijfCode = bedrijfCodeVoor(werkgevernaam) ?? null;
    if (!bedrijfCode) {
      uitzonderingen.push({ type: 'onbekend_bedrijf', bron: 'hr', rijnummer: i + 1, naam, detail: `Onbekende werkgevernaam "${werkgevernaam}".` });
    }
    medewerkers.push({
      rijnummer: i + 1,
      email,
      personeelsnummer: k.personeelsnummer >= 0 ? normaliseerPersoneelsnummer(rij[k.personeelsnummer]) : null,
      naam,
      werkgevernaam,
      bedrijfCode,
      afdeling,
    });
  }
  return { medewerkers, uitzonderingen, heeftEmail: k.email >= 0, heeftPersoneelsnummer: k.personeelsnummer >= 0 };
}
