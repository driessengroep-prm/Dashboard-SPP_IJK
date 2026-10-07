import { SPP_STATUSSEN, type SppStatus } from './config/kwadranten';
import { bedrijfSleutel, leidinggevendeVan } from './filters';
import type { DashboardRegel } from './types';

export type Telling = Record<SppStatus, number>;

export interface Verdeling {
  medewerkers: number;
  /** Employees with one of the four quadrants. */
  gescoord: number;
  telling: Telling;
}

export interface Groep extends Verdeling {
  sleutel: string;
  label: string;
}

export const legeTelling = (): Telling => Object.fromEntries(SPP_STATUSSEN.map((s) => [s, 0])) as Telling;

/** Percentage with one decimal; 0 when the total is 0. */
export const pct = (deel: number, totaal: number) => (totaal === 0 ? 0 : Math.round((deel / totaal) * 1000) / 10);

export function verdeling(regels: readonly DashboardRegel[]): Verdeling {
  const telling = legeTelling();
  for (const r of regels) telling[r.status]++;
  return { medewerkers: regels.length, gescoord: regels.length - telling.niet_gescoord, telling };
}

export function groepeer(
  regels: readonly DashboardRegel[],
  sleutelVan: (r: DashboardRegel) => string,
  labelVan: (r: DashboardRegel) => string = sleutelVan,
): Groep[] {
  const map = new Map<string, { label: string; regels: DashboardRegel[] }>();
  for (const r of regels) {
    const k = sleutelVan(r);
    let g = map.get(k);
    if (!g) map.set(k, (g = { label: labelVan(r), regels: [] }));
    g.regels.push(r);
  }
  return [...map.entries()]
    .map(([sleutel, g]) => ({ sleutel, label: g.label, ...verdeling(g.regels) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'nl'));
}

export const perBedrijf = (regels: readonly DashboardRegel[]) => groepeer(regels, bedrijfSleutel, (r) => r.werkgevernaam || 'Onbekend');
export const perAfdeling = (regels: readonly DashboardRegel[]) => groepeer(regels, (r) => r.afdeling);
export const perLeidinggevende = (regels: readonly DashboardRegel[]) => groepeer(regels, leidinggevendeVan);

/** Share of a status in a group: quadrants as % of the scored employees, "niet gescoord" as % of all employees. */
export function aandeel(g: Verdeling, s: SppStatus): number {
  return s === 'niet_gescoord' ? pct(g.telling.niet_gescoord, g.medewerkers) : pct(g.telling[s], g.gescoord);
}
