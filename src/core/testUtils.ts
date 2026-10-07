// Test-only helpers (never imported by application code).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEMO_HR_BESTAND, DEMO_SPP_BESTAND } from '../data/demoConfig';
import type { SppStatus } from './config/kwadranten';
import type { DashboardRegel, HrMedewerker, SppRij } from './types';

const FICTIEF = join(__dirname, '..', '..', 'testdata', 'fictief');
export const leesFictiefSpp = () => new Uint8Array(readFileSync(join(FICTIEF, DEMO_SPP_BESTAND)));
export const leesFictiefHr = () => new Uint8Array(readFileSync(join(FICTIEF, DEMO_HR_BESTAND)));

let rijnr = 1;
export const hr = (naam: string, extra: Partial<HrMedewerker> = {}): HrMedewerker => ({
  rijnummer: ++rijnr,
  email: null,
  personeelsnummer: null,
  naam,
  werkgevernaam: 'IJK B.V.',
  bedrijfCode: 'ijk',
  afdeling: 'IJK - Afd',
  ...extra,
});

export const spp = (naam: string, kwadrantRuw: string, extra: Partial<SppRij> = {}): SppRij => ({
  rijnummer: ++rijnr,
  naam,
  email: null,
  personeelsnummer: null,
  leidinggevende: 'Baas',
  kwadrantRuw,
  ...extra,
});

export const regel = (sleutel: string, status: SppStatus, extra: Partial<DashboardRegel> = {}): DashboardRegel => ({
  sleutel,
  naam: `Persoon ${sleutel}`,
  leidinggevende: 'Baas',
  bedrijfCode: 'ijk',
  werkgevernaam: 'IJK B.V.',
  afdeling: 'IJK - Afd',
  status,
  inHr: true,
  ...extra,
});
