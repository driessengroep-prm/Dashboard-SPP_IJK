import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HR_HERKENNINGSKOP, HR_WERKBLAD, parseHr } from './hr';
import { SPP_KOLOMMEN, parseSpp } from './spp';
import { ParseFout } from './tabel';
import { rk } from './xlsb';
import { leesWerkblad, leesWerkboek } from './xlsx';

// Fictitious .xlsb files, written by an independent tool (SheetJS) from the fictitious .xlsx exports
const XLSB = join(__dirname, '..', '..', '..', 'testdata', 'fictief', 'xlsb');
const FICTIEF = join(XLSB, '..');
const lees = (map: string, naam: string) => new Uint8Array(readFileSync(join(map, naam)));

describe('xlsb reader', () => {
  it('decodes RK numbers (integer, ×100 and truncated double)', () => {
    expect(rk((3345 << 2) | 2)).toBe(3345);
    expect(rk((-7 << 2) | 2)).toBe(-7);
    expect(rk((1250 << 2) | 3)).toBe(12.5);
    expect(rk(0x3fe00000)).toBe(0.5);
  });

  it('reads all worksheets and cell types', async () => {
    const bladen = await leesWerkboek(lees(XLSB, 'typen.xlsb'));
    expect(bladen.map((b) => b.naam)).toEqual(['Voorblad', 'Typen']);
    expect(bladen[1].tabel).toEqual([
      ['Tekst', 'Geheel', 'Decimaal', 'Negatief', 'Groot', 'Waar'],
      ['Zoë IJzerman-Lüün', 3345, 12.5, -7, 123456789, true],
      [null, 0, 0.01, -0.5, 2147483648, false],
      ['Talent\\voorloper', null, 0.001, null, 42000000000],
    ]);
  });

  it('gives exactly the same tables as the .xlsx originals', async () => {
    // Trailing empty cells may differ per writer; the content must not
    const zonderLegeStaart = (t: unknown[][]) =>
      t.map((r) => {
        const x = [...r];
        while (x.length && x[x.length - 1] === null) x.pop();
        return x;
      });
    for (const naam of ['SPP_export_IJK_20261001', 'Lijst_FvB_20261001']) {
      const [a] = await leesWerkboek(lees(FICTIEF, `${naam}.xlsx`));
      const [b] = await leesWerkboek(lees(XLSB, `${naam}.xlsb`));
      expect(b.naam).toBe(a.naam);
      expect(zonderLegeStaart(b.tabel)).toEqual(zonderLegeStaart(a.tabel));
    }
  });

  it('feeds the SPP and HR parsers', async () => {
    const spp = parseSpp(await leesWerkblad(lees(XLSB, 'SPP_export_IJK_20261001.xlsb'), null, SPP_KOLOMMEN.kwadrant.namen, { eersteAlsTerugval: true }));
    expect(spp.rijen).toHaveLength(267);
    const hr = parseHr(await leesWerkblad(lees(XLSB, 'Lijst_FvB_20261001.xlsb'), HR_WERKBLAD, HR_HERKENNINGSKOP));
    expect(hr.medewerkers).toHaveLength(833);
  });

  it('refuses files that are no workbook', async () => {
    await expect(leesWerkboek(new TextEncoder().encode('geen excel'))).rejects.toThrow(ParseFout);
    const kapot = lees(XLSB, 'typen.xlsb').slice(0, 2000);
    await expect(leesWerkboek(kapot)).rejects.toThrow(ParseFout);
  });
});
