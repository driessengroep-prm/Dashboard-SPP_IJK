import type { KoppelSamenvatting } from '../core/matching';
import type { Rol } from '../core/roles';
import type { DashboardRegel, Uitzondering } from '../core/types';

export interface DashboardData {
  regels: DashboardRegel[];
  peildatum: Date | null;
  /** True when no data set has been loaded yet (local build before the first upload). */
  geenDataset?: boolean;
}

export interface BeheerOverzicht {
  samenvatting: KoppelSamenvatting;
  /** Contains personal data — beheerder only. */
  uitzonderingen: Uitzondering[];
  /** Which optional columns were found in the SPP export. */
  sppKolommen: { email: boolean; personeelsnummer: boolean; leidinggevende: boolean };
  bestanden: { spp: string; hr: string };
  bron: 'gebundeld' | 'upload';
  peildatum: Date | null;
}

export class GeenToegangFout extends Error {
  constructor(message = 'Je hebt geen rechten voor deze gegevens.') {
    super(message);
    this.name = 'GeenToegangFout';
  }
}

/** User-facing upload error. Never contains personal data. */
export class UploadFout extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadFout';
  }
}

export interface DataSource {
  getDashboard(rollen: readonly Rol[]): Promise<DashboardData>;
  /** Null when no data set has been loaded yet. */
  getBeheer(rollen: readonly Rol[]): Promise<BeheerOverzicht | null>;
  upload(rollen: readonly Rol[], spp: File, hr: File): Promise<BeheerOverzicht>;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
