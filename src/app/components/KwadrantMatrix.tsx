import { pct, type Verdeling } from '../../core/aggregate';
import { KWADRANTEN, KWADRANT_ACTIE, MATRIX_ASSEN, MATRIX_POSITIE, STATUS_LABELS, type SppStatus } from '../../core/config/kwadranten';
import { fmt } from './Kwadrant';

// Blad and Zon are too light for white numbers; they get dark (Lucht) text instead
const DONKERE_TEKST = new Set<SppStatus>(['talent', 'vraagteken', 'niet_gescoord']);

/**
 * The 2×2 SPP matrix (prestatie × groeiruimte): number of employees per quadrant and their
 * share of the scored employees. Clicking a quadrant toggles the quadrant filter.
 */
export function KwadrantMatrix({ v, actief, onKies }: { v: Verdeling; actief: SppStatus[]; onKies: (s: SppStatus) => void }) {
  return (
    <>
      <div className="matrix-raster">
        <div className="matrix-as-titel x">
          {MATRIX_ASSEN.x.titel} <span>({MATRIX_ASSEN.x.toelichting})</span>
        </div>
        <div className="matrix-as-niveau" style={{ gridRow: 2, gridColumn: 3 }}>
          Laag
        </div>
        <div className="matrix-as-niveau" style={{ gridRow: 2, gridColumn: 4 }}>
          Hoog
        </div>
        <div className="matrix-as-titel y">
          {MATRIX_ASSEN.y.titel} <span>({MATRIX_ASSEN.y.toelichting})</span>
        </div>
        <div className="matrix-as-niveau rij" style={{ gridRow: 3, gridColumn: 2 }}>
          Laag
        </div>
        <div className="matrix-as-niveau rij" style={{ gridRow: 4, gridColumn: 2 }}>
          Hoog
        </div>
        {KWADRANTEN.map((k) => {
          const pos = MATRIX_POSITIE[k];
          const klassen = ['matrix-cel', actief.includes(k) ? 'actief' : '', actief.length && !actief.includes(k) ? 'gedimd' : ''].join(' ');
          return (
            <button
              key={k}
              type="button"
              className={klassen}
              aria-pressed={actief.includes(k)}
              style={{ gridRow: pos.rij + 2, gridColumn: pos.kolom + 2, ['--cel-kleur' as string]: `var(--k-${k})` }}
              onClick={() => onKies(k)}
              title={`${STATUS_LABELS[k]}: ${v.telling[k]} van ${v.gescoord} gescoorde medewerkers. Klik om op dit kwadrant te filteren.`}
            >
              <span className={DONKERE_TEKST.has(k) ? 'hexagon donkere-tekst' : 'hexagon'}>{v.telling[k]}</span>
              <span className="matrix-tekst">
                <span className="matrix-label">
                  {/* Allow a line break after the slash ("Vaste waarde/ sterkhouder") instead of mid-word */}
                  {STATUS_LABELS[k].split('/').map((deel, i) => (
                    <span key={i}>
                      {i > 0 && '/'}
                      {i > 0 && <wbr />}
                      {deel}
                    </span>
                  ))}
                </span>
                <span className="matrix-actie">({KWADRANT_ACTIE[k]})</span>
                <span className="matrix-pct">{fmt(pct(v.telling[k], v.gescoord))}% van gescoord</span>
              </span>
            </button>
          );
        })}
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
