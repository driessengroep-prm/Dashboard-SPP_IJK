import type { SppStatus } from './config/kwadranten';
import type { DashboardRegel } from './types';

/** Empty or missing arrays mean "no filter". */
export interface DashboardFilters {
  /** Company codes; 'onbekend' selects employees not found in the HR export. */
  bedrijven?: string[];
  afdelingen?: string[];
  leidinggevenden?: string[];
  /** Employees, as opaque ids from medewerkerId() (never names in URLs). */
  medewerkers?: string[];
  kwadranten?: SppStatus[];
}

export const ONBEKEND_CODE = 'onbekend';
export const GEEN_LEIDINGGEVENDE = '(geen leidinggevende)';

const actief = <T>(a?: T[]): a is T[] => !!a && a.length > 0;

function fnv1a(tekst: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const idCache = new Map<string, string>();

/** Stable, opaque id for an employee key, used in filters and URLs so that no name ends up in the browser history. */
export function medewerkerId(sleutel: string): string {
  let id = idCache.get(sleutel);
  if (!id) {
    id = fnv1a(sleutel, 0x811c9dc5).toString(36) + fnv1a(sleutel, 0x01234567).toString(36);
    idCache.set(sleutel, id);
  }
  return id;
}

export const bedrijfSleutel = (r: DashboardRegel) => r.bedrijfCode ?? ONBEKEND_CODE;
export const leidinggevendeVan = (r: DashboardRegel) => r.leidinggevende || GEEN_LEIDINGGEVENDE;

/** Company, department, manager and employee filters: the population the figures are about. */
export function pasSelectieToe(regels: readonly DashboardRegel[], f: DashboardFilters): DashboardRegel[] {
  const mw = actief(f.medewerkers) ? new Set(f.medewerkers) : null;
  return regels.filter(
    (r) =>
      (!actief(f.bedrijven) || f.bedrijven.includes(bedrijfSleutel(r))) &&
      (!actief(f.afdelingen) || f.afdelingen.includes(r.afdeling)) &&
      (!actief(f.leidinggevenden) || f.leidinggevenden.includes(leidinggevendeVan(r))) &&
      (!mw || mw.has(medewerkerId(r.sleutel))),
  );
}

/** All filters, including the quadrant filter (used for the employee table and its export). */
export function pasFiltersToe(regels: readonly DashboardRegel[], f: DashboardFilters): DashboardRegel[] {
  const selectie = pasSelectieToe(regels, f);
  return actief(f.kwadranten) ? selectie.filter((r) => f.kwadranten!.includes(r.status)) : selectie;
}
