import type { Rol } from '../../core/roles';
import { IS_DEMO } from '../../data';
import { useApp } from '../AppContext';

const OPTIES: { label: string; rollen: Rol[] }[] = [
  { label: 'Beheerder', rollen: ['beheerder'] },
  { label: 'Gebruiker (HR IJK)', rollen: ['gebruiker'] },
];

/** Simulated role (demo and local build). Clearly marked: it is not an access control. */
export function RolKiezer() {
  const { rollen, setRollen } = useApp();
  const huidig = OPTIES.findIndex((o) => o.rollen.join('|') === rollen.join('|'));
  return (
    <label className="rolkiezer">
      <span className="demo-label">{IS_DEMO ? 'DEMO' : 'TEST'}</span>
      <span>Gesimuleerde rol</span>
      <select value={huidig} onChange={(e) => setRollen(OPTIES[Number(e.target.value)].rollen)}>
        {OPTIES.map((o, i) => (
          <option key={o.label} value={i}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
