import { mapKwadrant, type SppStatus } from './config/kwadranten';
import { normaliseerNaam } from './parsing/tabel';
import type { DashboardRegel, HrMedewerker, SppRij, Uitzondering } from './types';

export const ONBEKEND_BEDRIJF = 'Onbekend (niet in HR-lijst)';
export const ONBEKENDE_AFDELING = 'Onbekend (niet in HR-lijst)';

export type KoppelWijze = 'personeelsnummer' | 'email' | 'naam';

export interface KoppelSamenvatting {
  /** Employees on the dashboard (rows of the SPP export after removing duplicates). */
  medewerkers: number;
  gekoppeld: number;
  nietGekoppeld: number;
  gescoord: number;
  nietGescoord: number;
  hrMedewerkers: number;
  /** HR employees that do not occur in the SPP export (not shown on the dashboard). */
  hrNietInSpp: number;
  /** How many SPP rows were matched by which key. */
  perWijze: Record<KoppelWijze, number>;
  uitzonderingen: number;
}

export interface KoppelResultaat {
  regels: DashboardRegel[];
  uitzonderingen: Uitzondering[];
  samenvatting: KoppelSamenvatting;
}

function index<K>(items: readonly HrMedewerker[], sleutel: (m: HrMedewerker) => K | null): Map<K, HrMedewerker[]> {
  const map = new Map<K, HrMedewerker[]>();
  for (const m of items) {
    const k = sleutel(m);
    if (k === null || k === '') continue;
    const lijst = map.get(k);
    if (lijst) lijst.push(m);
    else map.set(k, [m]);
  }
  return map;
}

const hrSleutel = (m: HrMedewerker) => `hr:${m.rijnummer}`;

/**
 * Joins the SPP export (who is scored in which quadrant, by which manager) with the HR
 * export (company and department). Per SPP row the most reliable available key is used:
 * personnel number, then work e-mail, then the normalised name.
 * - The SPP export determines who is on the dashboard; HR employees missing from it are only counted.
 * - An SPP row without HR match stays on the dashboard with an unknown company/department and is reported.
 * - A name that occurs more than once in the HR export is not matched on name (reported).
 * - The same employee twice in the SPP export: the last row with a quadrant counts (reported).
 * - An unrecognised quadrant value counts as "niet gescoord" and is reported.
 */
export function koppel(spp: readonly SppRij[], hr: readonly HrMedewerker[], bestaandeUitzonderingen: Uitzondering[] = []): KoppelResultaat {
  const uitzonderingen: Uitzondering[] = [...bestaandeUitzonderingen];
  const opNummer = index(hr, (m) => m.personeelsnummer);
  const opEmail = index(hr, (m) => m.email);
  const opNaam = index(hr, (m) => normaliseerNaam(m.naam));
  const perWijze: Record<KoppelWijze, number> = { personeelsnummer: 0, email: 0, naam: 0 };

  const zoek = (r: SppRij): { m: HrMedewerker; wijze: KoppelWijze } | 'dubbelzinnig' | null => {
    const nr = r.personeelsnummer ? opNummer.get(r.personeelsnummer) : undefined;
    if (nr?.length === 1) return { m: nr[0], wijze: 'personeelsnummer' };
    const em = r.email ? opEmail.get(r.email) : undefined;
    if (em?.length === 1) return { m: em[0], wijze: 'email' };
    const nm = r.naam ? opNaam.get(normaliseerNaam(r.naam)) : undefined;
    if (nm?.length === 1) return { m: nm[0], wijze: 'naam' };
    return nm && nm.length > 1 ? 'dubbelzinnig' : null;
  };

  // One entry per employee; a later row replaces an earlier one unless it has no quadrant.
  const perMedewerker = new Map<string, { regel: DashboardRegel; rij: SppRij }>();
  const hrGevonden = new Set<string>();

  for (const r of spp) {
    let status: SppStatus | null = mapKwadrant(r.kwadrantRuw);
    if (status === null) {
      uitzonderingen.push({
        type: 'onbekend_kwadrant',
        bron: 'spp',
        rijnummer: r.rijnummer,
        naam: r.naam,
        detail: `Onbekende kwadrantwaarde "${r.kwadrantRuw}"; telt in het dashboard als niet gescoord.`,
      });
      status = 'niet_gescoord';
    }

    const gevonden = zoek(r);
    let regel: DashboardRegel;
    if (gevonden && gevonden !== 'dubbelzinnig') {
      perWijze[gevonden.wijze]++;
      const { m } = gevonden;
      hrGevonden.add(hrSleutel(m));
      regel = {
        sleutel: hrSleutel(m),
        naam: m.naam || r.naam,
        leidinggevende: r.leidinggevende,
        bedrijfCode: m.bedrijfCode,
        werkgevernaam: m.werkgevernaam,
        afdeling: m.afdeling,
        status,
        inHr: true,
      };
    } else {
      uitzonderingen.push({
        type: gevonden === 'dubbelzinnig' ? 'naam_dubbelzinnig' : 'geen_hr_match',
        bron: 'spp',
        rijnummer: r.rijnummer,
        naam: r.naam,
        detail:
          gevonden === 'dubbelzinnig'
            ? 'Deze naam komt meerdere keren voor in de HR-export; niet gekoppeld. Voeg personeelsnummer of e-mail toe aan de SPP-export.'
            : 'Niet gevonden in de HR-export; getoond met onbekend bedrijf en onbekende afdeling.',
      });
      regel = {
        sleutel: `spp:${r.email ?? r.personeelsnummer ?? normaliseerNaam(r.naam)}`,
        naam: r.naam,
        leidinggevende: r.leidinggevende,
        bedrijfCode: null,
        werkgevernaam: ONBEKEND_BEDRIJF,
        afdeling: ONBEKENDE_AFDELING,
        status,
        inHr: false,
      };
    }

    const vorige = perMedewerker.get(regel.sleutel);
    if (vorige) {
      const houdVorige = regel.status === 'niet_gescoord' && vorige.regel.status !== 'niet_gescoord';
      uitzonderingen.push({
        type: 'spp_dubbel',
        bron: 'spp',
        rijnummer: houdVorige ? r.rijnummer : vorige.rij.rijnummer,
        naam: r.naam,
        detail: `Medewerker staat meerdere keren in de SPP-export; rij ${houdVorige ? vorige.rij.rijnummer : r.rijnummer} telt.`,
      });
      if (houdVorige) continue;
    }
    perMedewerker.set(regel.sleutel, { regel, rij: r });
  }

  const regels = [...perMedewerker.values()].map((v) => v.regel).sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  const gescoord = regels.filter((r) => r.status !== 'niet_gescoord').length;
  const gekoppeld = regels.filter((r) => r.inHr).length;
  return {
    regels,
    uitzonderingen,
    samenvatting: {
      medewerkers: regels.length,
      gekoppeld,
      nietGekoppeld: regels.length - gekoppeld,
      gescoord,
      nietGescoord: regels.length - gescoord,
      hrMedewerkers: hr.length,
      hrNietInSpp: hr.filter((m) => !hrGevonden.has(hrSleutel(m))).length,
      perWijze,
      uitzonderingen: uitzonderingen.length,
    },
  };
}
