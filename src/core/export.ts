import type { Groep } from './aggregate';
import { KWADRANTEN, STATUS_LABELS } from './config/kwadranten';
import type { DashboardRegel } from './types';

/** One cell of the export: text, a whole number, a fraction (0–1, shown as percentage) or empty. */
export type ExportCel = string | number | null;

export interface ExportTabel {
  naam: string;
  kolommen: string[];
  /** Per column: how it should be formatted. */
  soorten: ('tekst' | 'status' | 'aantal' | 'percentage')[];
  rijen: ExportCel[][];
}

/** The employee table exactly as shown in the dashboard (all filters + search term applied). */
export function bouwMedewerkerExport(regels: readonly DashboardRegel[]): ExportTabel {
  return {
    naam: 'Medewerkers',
    kolommen: ['Medewerker', 'Bedrijf', 'Afdeling/OE', 'Leidinggevende', 'SPP-kwadrant'],
    soorten: ['tekst', 'tekst', 'tekst', 'tekst', 'status'],
    rijen: regels.map((r) => [r.naam, r.werkgevernaam, r.afdeling, r.leidinggevende || null, STATUS_LABELS[r.status]]),
  };
}

/** Aggregate per group: counts per quadrant and the share of each quadrant among the scored employees. */
export function bouwGroepExport(naam: string, kolomnaam: string, groepen: readonly Groep[]): ExportTabel {
  const kolommen = [kolomnaam, 'Medewerkers', 'Gescoord', 'Niet gescoord'];
  const soorten: ExportTabel['soorten'] = ['tekst', 'aantal', 'aantal', 'aantal'];
  for (const k of KWADRANTEN) {
    kolommen.push(STATUS_LABELS[k], `${STATUS_LABELS[k]} (% van gescoord)`);
    soorten.push('aantal', 'percentage');
  }
  const rijen = groepen.map((g) => {
    const rij: ExportCel[] = [g.label, g.medewerkers, g.gescoord, g.telling.niet_gescoord];
    for (const k of KWADRANTEN) rij.push(g.telling[k], g.gescoord ? g.telling[k] / g.gescoord : null);
    return rij;
  });
  return { naam, kolommen, soorten, rijen };
}

/** Safe file name with the date, e.g. "spp-ijk-2026-10-07.xlsx". */
export const exportBestandsnaam = (datum: Date) => `spp-ijk-${datum.toISOString().slice(0, 10)}.xlsx`;
