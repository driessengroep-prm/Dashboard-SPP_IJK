import { describe, expect, it } from 'vitest';
import { aandeel, perBedrijf, perLeidinggevende, verdeling } from './aggregate';
import { bouwGroepExport, bouwMedewerkerExport } from './export';
import { medewerkerId, pasFiltersToe, pasSelectieToe } from './filters';
import { regel } from './testUtils';

const regels = [
  regel('a', 'talent'),
  regel('b', 'vaste_waarde'),
  regel('c', 'vaste_waarde', { leidinggevende: '' }),
  regel('d', 'niet_gescoord', { bedrijfCode: 'driessen', werkgevernaam: 'Driessen B.V.', afdeling: 'DR - X' }),
  regel('e', 'achterblijver', { bedrijfCode: null, werkgevernaam: 'Onbekend', inHr: false }),
];

describe('aggregation', () => {
  it('counts per status; quadrant shares are of the scored employees', () => {
    const v = verdeling(regels);
    expect(v).toMatchObject({ medewerkers: 5, gescoord: 4 });
    expect(v.telling).toEqual({ talent: 1, vaste_waarde: 2, vraagteken: 0, achterblijver: 1, niet_gescoord: 1 });
    expect(aandeel(v, 'vaste_waarde')).toBe(50);
    expect(aandeel(v, 'niet_gescoord')).toBe(20);
  });

  it('groups per company (unknown separately) and per manager', () => {
    expect(perBedrijf(regels).map((g) => [g.sleutel, g.medewerkers])).toEqual([
      ['driessen', 1],
      ['ijk', 3],
      ['onbekend', 1],
    ]);
    expect(perLeidinggevende(regels).map((g) => g.label)).toEqual(['(geen leidinggevende)', 'Baas']);
  });
});

describe('filters', () => {
  it('selection filters exclude the quadrant filter; all filters include it', () => {
    const f = { bedrijven: ['ijk', 'onbekend'], kwadranten: ['vaste_waarde' as const] };
    expect(pasSelectieToe(regels, f).map((r) => r.sleutel)).toEqual(['a', 'b', 'c', 'e']);
    expect(pasFiltersToe(regels, f).map((r) => r.sleutel)).toEqual(['b', 'c']);
  });

  it('filters on manager and opaque employee id', () => {
    expect(pasSelectieToe(regels, { leidinggevenden: ['(geen leidinggevende)'] }).map((r) => r.sleutel)).toEqual(['c']);
    expect(pasSelectieToe(regels, { medewerkers: [medewerkerId('d')] }).map((r) => r.sleutel)).toEqual(['d']);
    expect(medewerkerId('d')).not.toContain('d@');
  });
});

describe('export', () => {
  it('exports employees with labels and groups with fractions', () => {
    expect(bouwMedewerkerExport([regels[0]]).rijen).toEqual([['Persoon a', 'IJK B.V.', 'IJK - Afd', 'Baas', 'Talent/voorloper']]);
    const g = bouwGroepExport('Per bedrijf', 'Bedrijf', perBedrijf(regels)).rijen.find((r) => r[0] === 'IJK B.V.')!;
    expect(g.slice(0, 8)).toEqual(['IJK B.V.', 3, 3, 0, 1, 1 / 3, 2, 2 / 3]);
  });
});
