import { pct, type Verdeling } from '../../core/aggregate';
import { KWADRANTEN, SPP_STATUSSEN, STATUS_LABELS, type SppStatus } from '../../core/config/kwadranten';

export const fmt = (n: number) => n.toLocaleString('nl-NL', { maximumFractionDigits: 1 });

/** Basis for percentages: the scored employees only, or all employees (then "niet gescoord" is a segment too). */
export type Basis = 'gescoord' | 'alle';

export const statussenVoor = (basis: Basis): readonly SppStatus[] => (basis === 'gescoord' ? KWADRANTEN : SPP_STATUSSEN);
export const noemer = (v: Verdeling, basis: Basis) => (basis === 'gescoord' ? v.gescoord : v.medewerkers);
export const deel = (v: Verdeling, s: SppStatus, basis: Basis) => pct(v.telling[s], s === 'niet_gescoord' ? v.medewerkers : noemer(v, basis));

/** 100% stacked bar of the quadrants, with a native tooltip per segment. */
export function KwadrantBalk({ v, basis }: { v: Verdeling; basis: Basis }) {
  const statussen = statussenVoor(basis).filter((s) => v.telling[s] > 0);
  const totaal = noemer(v, basis);
  if (totaal === 0) return <div className="kwadrantbalk leeg" title="Nog niemand gescoord" />;
  return (
    <div className="kwadrantbalk" role="img" aria-label={statussen.map((s) => `${STATUS_LABELS[s]} ${v.telling[s]} (${fmt(deel(v, s, basis))}%)`).join(', ')}>
      {statussen.map((s) => (
        <span
          key={s}
          className={`segment k-${s}`}
          style={{ flexGrow: v.telling[s] }}
          title={`${STATUS_LABELS[s]}: ${v.telling[s]} van ${totaal} (${fmt(deel(v, s, basis))}%)`}
        />
      ))}
    </div>
  );
}

export function Legenda({ basis }: { basis: Basis }) {
  return (
    <ul className="legenda" aria-label="Legenda">
      {statussenVoor(basis).map((s) => (
        <li key={s}>
          <span className={`hexje k-${s}`} aria-hidden />
          {STATUS_LABELS[s]}
        </li>
      ))}
    </ul>
  );
}
