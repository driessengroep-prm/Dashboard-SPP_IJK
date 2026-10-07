import { telNietToegestaneEmails } from '../core/demoGuard';
import { koppel, type KoppelResultaat } from '../core/matching';
import { HR_HERKENNINGSKOP, HR_WERKBLAD, parseHr } from '../core/parsing/hr';
import { SPP_KOLOMMEN, parseSpp, type SppResultaat } from '../core/parsing/spp';
import { ParseFout } from '../core/parsing/tabel';
import { leesAlleTabellen, leesWerkblad } from '../core/parsing/xlsx';
import { heeftToegang, magBeheren, type Rol } from '../core/roles';
import { DEMO_HR_BESTAND, DEMO_SPP_BESTAND } from './demoConfig';
import { GeenToegangFout, MAX_UPLOAD_BYTES, UploadFout, type BeheerOverzicht, type DashboardData, type DataSource } from './types';

type Bytes = ArrayBuffer | Uint8Array;

interface Staat {
  spp: SppResultaat;
  resultaat: KoppelResultaat;
  bestanden: { spp: string; hr: string };
  bron: 'gebundeld' | 'upload';
  peildatum: Date | null;
}

export interface BrowserDataOpties {
  /** Loader for bundled data (demo). Without it the source starts empty until an upload. */
  gebundeld?: () => Promise<{ spp: Bytes; hr: Bytes }>;
  /**
   * Demo guard: refuse files containing an e-mail address that does not end in `.example`, and
   * SPP files without an e-mail column (the fictitious data is recognisable by its addresses).
   * Default true; only the local offline build (which has no network access) turns it off.
   */
  alleenFictief?: boolean;
}

async function verwerk(sppBytes: Bytes, hrBytes: Bytes) {
  const [sppTabel, hrTabel] = await Promise.all([
    leesWerkblad(sppBytes, null, SPP_KOLOMMEN.kwadrant.namen),
    leesWerkblad(hrBytes, HR_WERKBLAD, HR_HERKENNINGSKOP),
  ]);
  const spp = parseSpp(sppTabel);
  const hr = parseHr(hrTabel);
  return { spp, resultaat: koppel(spp.rijen, hr.medewerkers, hr.uitzonderingen) };
}

/**
 * Browser data source for the demo and the local offline build: optional bundled
 * fictitious data plus uploads processed in the browser. Everything lives in memory
 * only — no localStorage, no IndexedDB, no network requests with data.
 */
export class BrowserDataSource implements DataSource {
  private staat: Promise<Staat | null> | null = null;
  private readonly alleenFictief: boolean;

  constructor(private readonly opties: BrowserDataOpties = {}) {
    this.alleenFictief = opties.alleenFictief ?? true;
  }

  private laad(): Promise<Staat | null> {
    if (!this.staat) {
      const gebundeld = this.opties.gebundeld;
      if (!gebundeld) return Promise.resolve(null);
      this.staat = (async () => {
        const { spp, hr } = await gebundeld();
        return {
          ...(await verwerk(spp, hr)),
          bestanden: { spp: DEMO_SPP_BESTAND, hr: DEMO_HR_BESTAND },
          bron: 'gebundeld' as const,
          peildatum: new Date(Date.UTC(2026, 9, 1)),
        };
      })();
      this.staat.catch(() => (this.staat = null));
    }
    return this.staat;
  }

  async getDashboard(rollen: readonly Rol[]): Promise<DashboardData> {
    if (!heeftToegang(rollen)) throw new GeenToegangFout();
    const s = await this.laad();
    if (!s) return { regels: [], peildatum: null, geenDataset: true };
    return { regels: s.resultaat.regels, peildatum: s.peildatum };
  }

  async getBeheer(rollen: readonly Rol[]): Promise<BeheerOverzicht | null> {
    if (!magBeheren(rollen)) throw new GeenToegangFout('Alleen de beheerder heeft toegang tot het beheerdersportaal.');
    const s = await this.laad();
    return s ? overzicht(s) : null;
  }

  async upload(rollen: readonly Rol[], spp: File, hr: File): Promise<BeheerOverzicht> {
    if (!magBeheren(rollen)) throw new GeenToegangFout();
    for (const f of [spp, hr]) {
      if (!f.name.toLowerCase().endsWith('.xlsx')) throw new UploadFout(`"${f.name}" is geen .xlsx-bestand.`);
      if (f.size > MAX_UPLOAD_BYTES) throw new UploadFout(`"${f.name}" is groter dan 10 MB.`);
    }
    const [sppBytes, hrBytes] = await Promise.all([spp.arrayBuffer(), hr.arrayBuffer()]);

    // Demo guard: refuse as soon as one e-mail address does not end in .example
    for (const [f, bytes] of this.alleenFictief ? ([[spp, sppBytes], [hr, hrBytes]] as const) : []) {
      let aantal: number;
      try {
        aantal = telNietToegestaneEmails(await leesAlleTabellen(bytes));
      } catch (e) {
        throw new UploadFout(e instanceof ParseFout ? `${f.name}: ${e.message}` : `"${f.name}" kon niet worden gelezen.`);
      }
      if (aantal > 0) {
        throw new UploadFout(
          `"${f.name}" is geweigerd: het bevat ${aantal} e-mailadres(sen) die niet op ".example" eindigen. ` +
            'Deze demo accepteert uitsluitend fictieve gegevens. Gebruik voor echte exports de lokale versie.',
        );
      }
    }

    let data: Awaited<ReturnType<typeof verwerk>>;
    try {
      data = await verwerk(sppBytes, hrBytes);
    } catch (e) {
      throw new UploadFout(e instanceof ParseFout ? e.message : 'De bestanden konden niet worden verwerkt.');
    }
    if (this.alleenFictief && !data.spp.heeftEmail) {
      throw new UploadFout(
        `"${spp.name}" is geweigerd: de demo herkent fictieve gegevens aan e-mailadressen op ".example", en dit bestand heeft geen e-mailkolom. ` +
          'Gebruik voor echte exports de lokale versie.',
      );
    }
    const nieuw: Staat = { ...data, bestanden: { spp: spp.name, hr: hr.name }, bron: 'upload', peildatum: new Date() };
    this.staat = Promise.resolve(nieuw);
    return overzicht(nieuw);
  }
}

function overzicht(s: Staat): BeheerOverzicht {
  return {
    samenvatting: s.resultaat.samenvatting,
    uitzonderingen: s.resultaat.uitzonderingen,
    sppKolommen: { email: s.spp.heeftEmail, personeelsnummer: s.spp.heeftPersoneelsnummer, leidinggevende: s.spp.heeftLeidinggevende },
    bestanden: s.bestanden,
    bron: s.bron,
    peildatum: s.peildatum,
  };
}
