import { describe, expect, it } from 'vitest';
import { koppel } from './matching';
import { hr, spp } from './testUtils';

describe('koppel', () => {
  it('matches on personnel number, then e-mail, then name', () => {
    const h = [
      hr('Anna Test', { personeelsnummer: '1', afdeling: 'IJK - A' }),
      hr('Bob Test', { email: 'bob@ijk.example', afdeling: 'IJK - B' }),
      hr('Jan van den Berg', { afdeling: 'IJK - C', bedrijfCode: 'driessen', werkgevernaam: 'Driessen B.V.' }),
    ];
    const r = koppel(
      [
        spp('A. Test', 'Talent', { personeelsnummer: '1' }),
        spp('B. Test', 'Vraagteken', { email: 'bob@ijk.example' }),
        spp('Berg, Jan van den', 'Sterkhouder'),
      ],
      h,
    );
    expect(r.regels.map((x) => [x.naam, x.afdeling, x.status])).toEqual([
      ['Anna Test', 'IJK - A', 'talent'],
      ['Bob Test', 'IJK - B', 'vraagteken'],
      ['Jan van den Berg', 'IJK - C', 'vaste_waarde'],
    ]);
    expect(r.samenvatting.perWijze).toEqual({ personeelsnummer: 1, email: 1, naam: 1 });
    expect(r.uitzonderingen).toEqual([]);
  });

  it('keeps unmatched SPP rows with an unknown company and reports them', () => {
    const r = koppel([spp('Onbekend Iemand', 'Achterblijver')], [hr('Ander')]);
    expect(r.regels[0]).toMatchObject({ bedrijfCode: null, inHr: false, status: 'achterblijver' });
    expect(r.uitzonderingen.map((u) => u.type)).toEqual(['geen_hr_match']);
    expect(r.samenvatting).toMatchObject({ medewerkers: 1, nietGekoppeld: 1, hrNietInSpp: 1 });
  });

  it('does not match an ambiguous name', () => {
    const r = koppel([spp('Kim Jansma', 'Talent')], [hr('Kim Jansma'), hr('Kim Jansma')]);
    expect(r.regels[0].inHr).toBe(false);
    expect(r.uitzonderingen[0].type).toBe('naam_dubbelzinnig');
  });

  it('counts an unknown quadrant as niet gescoord and reports it', () => {
    const r = koppel([spp('Anna', 'Ster')], [hr('Anna')]);
    expect(r.regels[0].status).toBe('niet_gescoord');
    expect(r.uitzonderingen[0]).toMatchObject({ type: 'onbekend_kwadrant' });
  });

  it('handles duplicate SPP rows: the last scored row counts', () => {
    const h = [hr('Anna')];
    expect(koppel([spp('Anna', 'Talent'), spp('Anna', 'Vraagteken')], h).regels.map((x) => x.status)).toEqual(['vraagteken']);
    const r = koppel([spp('Anna', 'Talent'), spp('Anna', '')], h);
    expect(r.regels.map((x) => x.status)).toEqual(['talent']);
    expect(r.uitzonderingen.map((u) => u.type)).toEqual(['spp_dubbel']);
  });
});
