import { pct, type Verdeling } from '../../core/aggregate';
import { KWADRANTEN, MATRIX_ASSEN, MATRIX_POSITIE, STATUS_LABELS, type SppStatus } from '../../core/config/kwadranten';
import { fmt } from './Kwadrant';

// Blad and Zon are too light for white numbers; they get dark (Lucht) text instead
const DONKERE_TEKST = new Set<SppStatus>(['talent', 'vraagteken', 'niet_gescoord']);

/**
 * The 2×2 SPP matrix: number of employees per quadrant and their share of the scored
 * employees. Clicking a quadrant toggles the quadrant filter.
 */
export function KwadrantMatrix({ v, actief, onKies }: { v: Verdeling; actief: SppStatus[]; onKies: (s: SppStatus) => void }) {
  return (
    <>
      <div className="matrix-wrap">
        <div className="matrix-as-y" aria-hidden>
          {MATRIX_ASSEN.y} →
        </div>
        <div className="spp-matrix">
          {KWADRANTEN.map((k) => {
            const pos = MATRIX_POSITIE[k];
            const klassen = ['matrix-cel', actief.includes(k) ? 'actief' : '', actief.length && !actief.includes(k) ? 'gedimd' : ''].join(' ');
            return (
              <button
                key={k}
                type="button"
                className={klassen}
                aria-pressed={actief.includes(k)}
                style={{ gridRow: pos.rij, gridColumn: pos.kolom, ['--cel-kleur' as string]: `var(--k-${k})` }}
                onClick={() => onKies(k)}
                title={`${STATUS_LABELS[k]}: ${v.telling[k]} van ${v.gescoord} gescoorde medewerkers. Klik om op dit kwadrant te filteren.`}
              >
                <span className={DONKERE_TEKST.has(k) ? 'hexagon donkere-tekst' : 'hexagon'}>{v.telling[k]}</span>
                <span className="matrix-tekst">
                  <span className="matrix-label">{STATUS_LABELS[k]}</span>
                  <span className="matrix-pct">{fmt(pct(v.telling[k], v.gescoord))}% van gescoord</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="matrix-as-x" aria-hidden>
          {MATRIX_ASSEN.x} →
        </div>
      </div>
      <div className="matrix-voet">
        <span>
          {v.gescoord} van {v.medewerkers} medewerkers gescoord ({fmt(pct(v.gescoord, v.medewerkers))}%)
        </span>
        <button
          type="button"
          className={actief.includes('niet_gescoord') ? 'knop-link actief' : 'knop-link'}
          onClick={() => onKies('niet_gescoord')}
          aria-pressed={actief.includes('niet_gescoord')}
        >
          <span className="hexje k-niet_gescoord" aria-hidden /> {v.telling.niet_gescoord} niet gescoord
        </button>
      </div>
    </>
  );
}
