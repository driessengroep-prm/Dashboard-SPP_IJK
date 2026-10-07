import type { SppStatus } from './config/kwadranten';

/** A single cell value after reading a worksheet. */
export type Cel = string | number | boolean | Date | null;
export type Tabel = Cel[][];

/** Employee as read from the HR export ("Lijst FvB"; only the columns we need). */
export interface HrMedewerker {
  /** 1-based row number in the worksheet. */
  rijnummer: number;
  /** Normalised work e-mail (trimmed, lower case), or null when missing. */
  email: string | null;
  /** Personnel number as text, or null when the column/value is missing. */
  personeelsnummer: string | null;
  naam: string;
  werkgevernaam: string;
  /** Company code from config/bedrijven.ts, or null when the employer is unknown. */
  bedrijfCode: string | null;
  /** "Org. eenheid omschrijving", shown as-is (including the company prefix). */
  afdeling: string;
}

/** Row as read from the SPP export (only the columns we need). */
export interface SppRij {
  rijnummer: number;
  naam: string;
  email: string | null;
  personeelsnummer: string | null;
  /** Company as stated in the SPP export ('' when absent); only used when the employee is not in the HR export. */
  bedrijf: string;
  leidinggevende: string;
  /** Raw quadrant value as it appears in the export ('' when not scored). */
  kwadrantRuw: string;
}

export type UitzonderingType =
  | 'geen_hr_match'
  | 'onbekend_kwadrant'
  | 'spp_dubbel'
  | 'naam_dubbelzinnig'
  | 'hr_dubbel'
  | 'onbekend_bedrijf';

/** Item on the exception list. Contains personal data: visible to `beheerder` only. */
export interface Uitzondering {
  type: UitzonderingType;
  bron: 'spp' | 'hr';
  rijnummer?: number;
  naam?: string;
  detail: string;
}

/** One employee on the dashboard: the SPP row enriched with company and department from the HR export. */
export interface DashboardRegel {
  /** Internal, stable key (never shown, never put in a URL; see filters.medewerkerId). */
  sleutel: string;
  naam: string;
  leidinggevende: string;
  bedrijfCode: string | null;
  werkgevernaam: string;
  afdeling: string;
  status: SppStatus;
  /** False when the employee could not be found in the HR export. */
  inHr: boolean;
}
