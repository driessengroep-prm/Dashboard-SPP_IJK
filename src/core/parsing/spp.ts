import type { SppRij, Tabel } from '../types';
import { ParseFout, celTekst, isLegeRij, kolomIndices, normaliseerEmail, normaliseerPersoneelsnummer, vindKoprij, type KolomDef } from './tabel';

/**
 * Accepted column headers of the SPP export. The exact naming of the real export is not
 * fixed yet, so several common variants are accepted (case, spaces and a trailing
 * period are ignored). Add a variant here when the export uses another header.
 */
export const SPP_KOLOMMEN: Record<'naam' | 'email' | 'personeelsnummer' | 'leidinggevende' | 'kwadrant', KolomDef> = {
  naam: { namen: ['Naam', 'Naam medewerker', 'Medewerker', 'Werknemer', 'Naam werknemer', 'Volledige naam'], verplicht: true },
  email: { namen: ['E-mail werk', 'E-mail', 'Email', 'E-mailadres', 'Emailadres', 'E-mail medewerker', 'Zakelijk e-mailadres'], verplicht: false },
  personeelsnummer: {
    namen: ['Personeelsnummer', 'Personeelsnr', 'Pers.nr', 'Pers. nr', 'Medewerkernummer', 'Werknemersnummer'],
    verplicht: false,
  },
  leidinggevende: { namen: ['Leidinggevende', 'Naam leidinggevende', 'Leidinggevende naam', 'Manager'], verplicht: false },
  kwadrant: {
    namen: ['SPP-kwadrant', 'SPP kwadrant', 'Kwadrant', 'SPP', 'SPP-score', 'SPP score', 'SPP-positie', 'Score', 'Positie', 'Plot', 'Categorie'],
    verplicht: true,
  },
};

export interface SppResultaat {
  rijen: SppRij[];
  heeftEmail: boolean;
  heeftPersoneelsnummer: boolean;
  heeftLeidinggevende: boolean;
}

export function parseSpp(tabel: Tabel): SppResultaat {
  const kopIdx = vindKoprij(tabel, SPP_KOLOMMEN.kwadrant.namen);
  if (kopIdx < 0) {
    throw new ParseFout(`SPP-export: geen koprij gevonden met een kolom voor het kwadrant (${SPP_KOLOMMEN.kwadrant.namen.map((n) => `"${n}"`).join(', ')}).`);
  }
  const k = kolomIndices(tabel[kopIdx], SPP_KOLOMMEN, 'SPP-export');
  const rijen: SppRij[] = [];
  for (let i = kopIdx + 1; i < tabel.length; i++) {
    const rij = tabel[i] ?? [];
    if (isLegeRij(rij)) continue;
    const naam = celTekst(rij[k.naam]);
    const email = k.email >= 0 ? normaliseerEmail(celTekst(rij[k.email])) || null : null;
    const personeelsnummer = k.personeelsnummer >= 0 ? normaliseerPersoneelsnummer(rij[k.personeelsnummer]) : null;
    if (!naam && !email && !personeelsnummer) continue;
    rijen.push({
      rijnummer: i + 1,
      naam,
      email,
      personeelsnummer,
      leidinggevende: k.leidinggevende >= 0 ? celTekst(rij[k.leidinggevende]) : '',
      kwadrantRuw: celTekst(rij[k.kwadrant]),
    });
  }
  return { rijen, heeftEmail: k.email >= 0, heeftPersoneelsnummer: k.personeelsnummer >= 0, heeftLeidinggevende: k.leidinggevende >= 0 };
}
