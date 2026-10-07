import { describe, expect, it } from 'vitest';
import { mapKwadrant } from './kwadranten';

describe('mapKwadrant', () => {
  it('recognises all quadrants regardless of spelling', () => {
    expect(mapKwadrant('Talent/voorloper')).toBe('talent');
    expect(mapKwadrant('Talent / Voorloper')).toBe('talent');
    expect(mapKwadrant('Talent\\voorloper')).toBe('talent');
    expect(mapKwadrant('Vaste waarde\\sterkhouder')).toBe('vaste_waarde');
    expect(mapKwadrant('voorloper')).toBe('talent');
    expect(mapKwadrant('Vaste waarde/sterkhouder')).toBe('vaste_waarde');
    expect(mapKwadrant('Sterkhouders')).toBe('vaste_waarde');
    expect(mapKwadrant('VRAAGTEKEN')).toBe('vraagteken');
    expect(mapKwadrant('Kwadrant: Achterblijver')).toBe('achterblijver');
  });

  it('treats empty and "not scored" values as niet_gescoord', () => {
    expect(mapKwadrant('')).toBe('niet_gescoord');
    expect(mapKwadrant('  ')).toBe('niet_gescoord');
    expect(mapKwadrant('Niet gescoord')).toBe('niet_gescoord');
    expect(mapKwadrant('n.v.t.')).toBe('niet_gescoord');
  });

  it('returns null for unknown or ambiguous values', () => {
    expect(mapKwadrant('Ster')).toBeNull();
    expect(mapKwadrant('Talent of vraagteken')).toBeNull();
  });
});
