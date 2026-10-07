import { describe, expect, it } from 'vitest';
import { leesFictiefHr, leesFictiefSpp } from '../testUtils';
import type { Tabel } from '../types';
import { HR_HERKENNINGSKOP, HR_WERKBLAD, parseHr } from './hr';
import { SPP_KOLOMMEN, parseSpp } from './spp';
import { ParseFout, normaliseerNaam, normaliseerPersoneelsnummer } from './tabel';
import { leesWerkblad } from './xlsx';

describe('parseSpp', () => {
  const tabel: Tabel = [
    ['SPP-export'],
    [],
    ['Naam medewerker', 'E-mailadres', 'Personeelsnr.', 'Naam leidinggevende', 'Kwadrant', 'Opmerking'],
    ['Anna Test', ' Anna@IJK.example ', '00123', 'Bea Baas', 'Talent', 'geheime notitie'],
    [null, null, null, null, null, null],
    ['Bob Test', null, 124, 'Bea Baas', null, null],
  ];

  it('finds the header dynamically and accepts header variants', () => {
    const r = parseSpp(tabel);
    expect(r.heeftEmail && r.heeftPersoneelsnummer && r.heeftLeidinggevende).toBe(true);
    expect(r.heeftKopregel).toBe(true);
    expect(r.rijen).toEqual([
      { rijnummer: 4, naam: 'Anna Test', email: 'anna@ijk.example', personeelsnummer: '123', bedrijf: '', leidinggevende: 'Bea Baas', kwadrantRuw: 'Talent' },
      { rijnummer: 6, naam: 'Bob Test', email: null, personeelsnummer: '124', bedrijf: '', leidinggevende: 'Bea Baas', kwadrantRuw: '' },
    ]);
  });

  it('never reads other columns', () => {
    expect(JSON.stringify(parseSpp(tabel))).not.toContain('geheime notitie');
  });

  it('reads the delivered export without header row (A nr · B naam · C bedrijf · D leidinggevende · E kwadrant)', () => {
    const r = parseSpp([
      [3345, 'Jan Janssen', 'IJK B.V.', 'Piet Pietersen', 'Talent\\voorloper'],
      ['3346', 'Kees de Vries', 'IJK B.V.', 'Piet Pietersen', null],
    ]);
    expect(r.heeftKopregel).toBe(false);
    expect(r.rijen).toEqual([
      { rijnummer: 1, naam: 'Jan Janssen', email: null, personeelsnummer: '3345', bedrijf: 'IJK B.V.', leidinggevende: 'Piet Pietersen', kwadrantRuw: 'Talent\\voorloper' },
      { rijnummer: 2, naam: 'Kees de Vries', email: null, personeelsnummer: '3346', bedrijf: 'IJK B.V.', leidinggevende: 'Piet Pietersen', kwadrantRuw: '' },
    ]);
  });

  it('skips an unrecognised title/header row in the fixed layout', () => {
    const r = parseSpp([['SPP-overzicht'], ['Nr.', 'Wie', 'Waar', 'Baas', 'Plek'], [3345, 'Jan Janssen', 'IJK B.V.', 'Piet', 'Vraagteken']]);
    expect(r.rijen.map((x) => x.rijnummer)).toEqual([3]);
  });

  it('reads the delivered export with its header row (Mdw. · Mdw. · Werkgever · Naam Leidinggevende · SPP)', () => {
    const r = parseSpp([
      ['Mdw.', 'Mdw.', 'Werkgever', 'Naam Leidinggevende', 'SPP'],
      [3345, 'Jan Janssen', 'IJK B.V.', 'Piet Pietersen', 'Talent\\voorloper'],
      [3346, 'Kees de Vries', 'IJK B.V.', 'Piet Pietersen', null],
    ]);
    expect(r).toMatchObject({ heeftKopregel: true, heeftPersoneelsnummer: true, heeftLeidinggevende: true });
    expect(r.rijen).toEqual([
      { rijnummer: 2, naam: 'Jan Janssen', email: null, personeelsnummer: '3345', bedrijf: 'IJK B.V.', leidinggevende: 'Piet Pietersen', kwadrantRuw: 'Talent\\voorloper' },
      { rijnummer: 3, naam: 'Kees de Vries', email: null, personeelsnummer: '3346', bedrijf: 'IJK B.V.', leidinggevende: 'Piet Pietersen', kwadrantRuw: '' },
    ]);
  });

  it('recognises a single "Mdw." column by its values', () => {
    expect(parseSpp([['Mdw.', 'SPP'], ['Jan Janssen', 'Vraagteken']]).rijen[0]).toMatchObject({ naam: 'Jan Janssen', personeelsnummer: null });
    expect(() => parseSpp([['Mdw.', 'SPP'], [3345, 'Vraagteken']])).toThrow(/Naam/);
  });

  it('throws a clear error when the columns are not recognised', () => {
    expect(() => parseSpp([['Naam', 'E-mail'], ['Jan', 'jan@x.example']])).toThrow(/niet herkend/);
    expect(() => parseSpp([['E-mail', 'Kwadrant']])).toThrow(/Naam/);
  });
});

describe('parseHr', () => {
  const tabel: Tabel = [
    ['Lijst FvB'],
    ['Personeelsnummer', 'Naam', 'E-mail werk', 'Werkgevernaam', 'Org. eenheid omschrijving', 'Leidinggevende'],
    [1, 'Anna Test', ' ANNA@ijk.example', 'IJK B.V.', 'IJK - HR', 'Geheime Baas'],
    [2, 'Dubbel', 'anna@ijk.example', 'IJK B.V.', 'IJK - HR', 'Geheime Baas'],
    [3, 'Vreemd', 'v@vreemd.example', 'Vreemd B.V.', 'X - Y', 'Geheime Baas'],
  ];

  it('reads the required columns', () => {
    const { medewerkers } = parseHr(tabel);
    expect(medewerkers[0]).toEqual({
      rijnummer: 3,
      email: 'anna@ijk.example',
      personeelsnummer: '1',
      naam: 'Anna Test',
      werkgevernaam: 'IJK B.V.',
      bedrijfCode: 'ijk',
      afdeling: 'IJK - HR',
    });
  });

  it('never reads the HR "Leidinggevende" column', () => {
    expect(JSON.stringify(parseHr(tabel))).not.toContain('Geheime Baas');
  });

  it('reports duplicates and unknown employers', () => {
    const { medewerkers, uitzonderingen } = parseHr(tabel);
    expect(medewerkers.map((m) => m.naam)).toEqual(['Anna Test', 'Vreemd']);
    expect(uitzonderingen.map((u) => u.type).sort()).toEqual(['hr_dubbel', 'onbekend_bedrijf']);
  });
});

describe('normalisation', () => {
  it('normalises names, including "Achternaam, Voornaam"', () => {
    expect(normaliseerNaam('  Jan  van den Berg ')).toBe('jan van den berg');
    expect(normaliseerNaam('Berg, Jan van den')).toBe('jan van den berg');
    expect(normaliseerNaam('Zoë IJzerman-Lüün')).toBe('zoe ijzerman luun');
  });
  it('normalises personnel numbers', () => {
    expect(normaliseerPersoneelsnummer('00123')).toBe('123');
    expect(normaliseerPersoneelsnummer(123)).toBe('123');
    expect(normaliseerPersoneelsnummer('A-12')).toBe('a-12');
    expect(normaliseerPersoneelsnummer(null)).toBeNull();
  });
});

describe('xlsx parsing of the generated fictitious exports', () => {
  it('reads the SPP export', async () => {
    const r = parseSpp(await leesWerkblad(leesFictiefSpp(), null, SPP_KOLOMMEN.kwadrant.namen, { eersteAlsTerugval: true }));
    expect(r.heeftKopregel).toBe(true);
    expect(r.heeftPersoneelsnummer && r.heeftLeidinggevende).toBe(true);
    expect(r.rijen.length).toBe(267); // IJK only
    expect(r.rijen.every((x) => x.personeelsnummer && x.bedrijf)).toBe(true);
  });

  it('reads the HR export', async () => {
    const { medewerkers, uitzonderingen } = parseHr(await leesWerkblad(leesFictiefHr(), HR_WERKBLAD, HR_HERKENNINGSKOP));
    expect(medewerkers).toHaveLength(833);
    expect(uitzonderingen).toHaveLength(0);
    expect(new Set(medewerkers.map((m) => m.bedrijfCode)).size).toBe(14);
  });

  it('rejects a file that is not a workbook', async () => {
    await expect(leesWerkblad(new TextEncoder().encode('geen excel'), null, 'Kwadrant')).rejects.toThrow(ParseFout);
  });
});
