import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { leesFictiefHr, leesFictiefSpp } from '../core/testUtils';
import { BrowserDataSource } from './BrowserDataSource';
import { GeenToegangFout, UploadFout } from './types';

const demo = () => new BrowserDataSource({ gebundeld: async () => ({ spp: leesFictiefSpp(), hr: leesFictiefHr() }), alleenFictief: true });
const alsFile = (bytes: Uint8Array, naam: string) => new File([bytes as BlobPart], naam);

async function werkboekMet(rijen: unknown[][], blad = 'Blad1'): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(blad);
  rijen.forEach((r) => ws.addRow(r));
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

const hrBestand = (email: string) =>
  werkboekMet(
    [
      ['Naam', 'E-mail werk', 'Werkgevernaam', 'Org. eenheid omschrijving'],
      ['Jan Jansen', email, 'IJK B.V.', 'IJK - Directie'],
      ['Piet Pieters', email.replace('jan', 'piet'), 'IJK B.V.', 'IJK - Directie'],
    ],
    'DG MW in dienst',
  );

describe('BrowserDataSource (demo)', () => {
  it('loads the bundled data with every edge case', async () => {
    const ds = demo();
    const d = await ds.getDashboard(['gebruiker']);
    expect(d.regels.length).toBe(835); // 836 rows minus one duplicate
    const b = (await ds.getBeheer(['beheerder']))!;
    expect(new Set(b.uitzonderingen.map((u) => u.type))).toEqual(new Set(['geen_hr_match', 'spp_dubbel', 'onbekend_kwadrant', 'naam_dubbelzinnig']));
    expect(b.samenvatting.perWijze.naam).toBeGreaterThan(10);
    // Two external rows are not in the HR list; a row without e-mail may hit a name that occurs twice
    expect(b.samenvatting.gekoppeld).toBe(b.samenvatting.medewerkers - b.uitzonderingen.filter((u) => u.type === 'geen_hr_match' || u.type === 'naam_dubbelzinnig').length);
  });

  it('denies access without role and beheer for non-beheerders', async () => {
    await expect(demo().getDashboard([])).rejects.toBeInstanceOf(GeenToegangFout);
    await expect(demo().getBeheer(['gebruiker'])).rejects.toBeInstanceOf(GeenToegangFout);
  });

  it('accepts the fictitious exports as upload', async () => {
    const b = await demo().upload(['beheerder'], alsFile(leesFictiefSpp(), 'spp.xlsx'), alsFile(leesFictiefHr(), 'hr.xlsx'));
    expect(b.bron).toBe('upload');
  });

  it('refuses real e-mail addresses without echoing them, and SPP files without e-mail column', async () => {
    const echt = await werkboekMet([['Naam', 'E-mail', 'Kwadrant'], ['Jan', 'jan@echtbedrijf.nl', 'Talent']]);
    const err = await demo().upload(['beheerder'], alsFile(echt, 'spp.xlsx'), alsFile(leesFictiefHr(), 'hr.xlsx')).catch((e) => e);
    expect(err).toBeInstanceOf(UploadFout);
    expect(err.message).not.toContain('jan@echtbedrijf.nl');
    const zonderMail = await werkboekMet([['Naam', 'Kwadrant'], ['Jan Jansen', 'Talent']]);
    await expect(demo().upload(['beheerder'], alsFile(zonderMail, 'spp.xlsx'), alsFile(leesFictiefHr(), 'hr.xlsx'))).rejects.toThrow(/e-mailkolom/);
  });

  it('refuses non-xlsx files', async () => {
    await expect(demo().upload(['beheerder'], alsFile(new Uint8Array([1]), 'a.csv'), alsFile(leesFictiefHr(), 'hr.xlsx'))).rejects.toBeInstanceOf(UploadFout);
  });
});

describe('BrowserDataSource (local build)', () => {
  it('starts empty and accepts real exports, matching on name', async () => {
    const ds = new BrowserDataSource({ alleenFictief: false });
    expect(await ds.getDashboard(['beheerder'])).toMatchObject({ regels: [], geenDataset: true });
    expect(await ds.getBeheer(['beheerder'])).toBeNull();
    const sppBestand = await werkboekMet([
      ['Medewerker', 'Leidinggevende', 'SPP-kwadrant'],
      ['Jansen, Jan', 'Bea Baas', 'Vaste waarde'],
      ['Piet Pieters', 'Bea Baas', ''],
    ]);
    const b = await ds.upload(['beheerder'], alsFile(sppBestand, 'spp.xlsx'), alsFile(await hrBestand('jan@bedrijf.nl'), 'hr.xlsx'));
    expect(b.samenvatting).toMatchObject({ medewerkers: 2, gekoppeld: 2, gescoord: 1 });
    const d = await ds.getDashboard(['gebruiker']);
    expect(d.regels.map((r) => [r.naam, r.afdeling, r.status])).toEqual([
      ['Jan Jansen', 'IJK - Directie', 'vaste_waarde'],
      ['Piet Pieters', 'IJK - Directie', 'niet_gescoord'],
    ]);
  });
});
