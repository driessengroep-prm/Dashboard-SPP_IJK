import { useState } from 'react';
import { pct, type Groep } from '../../core/aggregate';
import { KORTE_LABELS, STATUS_LABELS, type SppStatus } from '../../core/config/kwadranten';
import { KwadrantBalk, Legenda, deel, fmt, noemer, statussenVoor, type Basis } from './Kwadrant';

const COMPACT_AANTAL = 15;
type Sortering = 'naam' | 'grootte' | `hoog:${SppStatus}`;

/**
 * Group table: per company / department / manager the number of employees, a 100% stacked
 * bar and (optionally) the count and share per quadrant. Clicking a name filters on it.
 */
export function GroepKaart(props: {
  titel: string;
  toelichting?: string;
  groepen: Groep[];
  basis: Basis;
  actief: string[];
  onKies: (g: Groep) => void;
  /** Show a column per quadrant (wide cards). */
  perKwadrant?: boolean;
  /** Long lists: sortable and initially limited to COMPACT_AANTAL rows. */
  compact?: boolean;
  inklapbaar?: boolean;
}) {
  const { basis } = props;
  const [open, setOpen] = useState(!props.inklapbaar);
  const [sortering, setSortering] = useState<Sortering>('naam');
  const [alles, setAlles] = useState(false);
  const [weergave, setWeergave] = useState<'aantal' | 'pct'>('aantal');
  const statussen = statussenVoor(basis);

  const gesorteerd = [...props.groepen];
  if (sortering === 'grootte') gesorteerd.sort((a, b) => b.medewerkers - a.medewerkers || a.label.localeCompare(b.label, 'nl'));
  if (sortering.startsWith('hoog:')) {
    const s = sortering.slice(5) as SppStatus;
    gesorteerd.sort((a, b) => deel(b, s, basis) - deel(a, s, basis) || b.medewerkers - a.medewerkers);
  }
  const zichtbaar = props.compact && !alles ? gesorteerd.slice(0, COMPACT_AANTAL) : gesorteerd;

  return (
    <section className="kaart">
      <div className="kaart-kop">
        {props.inklapbaar ? (
          <h2>
            <button className="uitklap" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              <span className="chevron" aria-hidden>
                ▸
              </span>
              {props.titel}
              <span className="uitklap-aantal">({props.groepen.length})</span>
            </button>
          </h2>
        ) : (
          <h2>{props.titel}</h2>
        )}
        {open ? (
          <Legenda basis={basis} />
        ) : (
          <button className="knop-link klein-link" onClick={() => setOpen(true)}>
            Uitklappen
          </button>
        )}
      </div>
      {open && (
        <>
          {props.toelichting && <p className="subtiel klein">{props.toelichting}</p>}
          <div className="tabel-scroll">
            <table className="groeptabel">
              <thead>
                <tr>
                  <th scope="col">Naam</th>
                  <th scope="col" className="num" title="Medewerkers in de SPP-export">
                    Mdw.
                  </th>
                  <th scope="col" className="balk-kolom">
                    Verdeling
                  </th>
                  {props.perKwadrant ? (
                    statussen.map((s) => (
                      <th key={s} scope="col" className="num" title={STATUS_LABELS[s]}>
                        <span className="th-kwadrant">
                          <span className={`hexje k-${s}`} aria-hidden />
                          {KORTE_LABELS[s]}
                        </span>
                      </th>
                    ))
                  ) : (
                    <th scope="col" className="num" title="Percentage van de medewerkers met een kwadrant">
                      Gescoord
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {zichtbaar.map((g) => (
                  <tr key={g.sleutel} className={props.actief.includes(g.sleutel) ? 'actief' : undefined}>
                    <td>
                      <button className="knop-link" onClick={() => props.onKies(g)}>
                        {g.label}
                      </button>
                    </td>
                    <td className="num">{g.medewerkers}</td>
                    <td className="balk-kolom">
                      <KwadrantBalk v={g} basis={basis} />
                    </td>
                    {props.perKwadrant ? (
                      statussen.map((s) => (
                        <td key={s} className="num" title={`${STATUS_LABELS[s]}: ${g.telling[s]} (${fmt(deel(g, s, basis))}%)`}>
                          {weergave === 'aantal' ? g.telling[s] : noemer(g, basis) || s === 'niet_gescoord' ? `${fmt(deel(g, s, basis))}%` : '—'}
                        </td>
                      ))
                    ) : (
                      <td className="num" title={`${g.gescoord} van ${g.medewerkers} gescoord`}>
                        {fmt(pct(g.gescoord, g.medewerkers))}%
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(props.compact || props.perKwadrant) && (
            <div className="kaart-voet">
              {props.perKwadrant && (
                <div className="segment-keuze" role="group" aria-label="Weergave">
                  <button type="button" aria-pressed={weergave === 'aantal'} onClick={() => setWeergave('aantal')}>
                    Aantallen
                  </button>
                  <button type="button" aria-pressed={weergave === 'pct'} onClick={() => setWeergave('pct')}>
                    Percentages
                  </button>
                </div>
              )}
              {props.compact && (
                <label className="filter inline">
                  <span>Sorteer</span>
                  <select value={sortering} onChange={(e) => setSortering(e.target.value as Sortering)}>
                    <option value="naam">Op naam</option>
                    <option value="grootte">Meeste medewerkers eerst</option>
                    {statussen.map((s) => (
                      <option key={s} value={`hoog:${s}`}>
                        Hoogste % {STATUS_LABELS[s].toLowerCase()} eerst
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {props.compact && props.groepen.length > COMPACT_AANTAL && (
                <button className="knop" onClick={() => setAlles((a) => !a)}>
                  {alles ? `Toon eerste ${COMPACT_AANTAL}` : `Toon alle ${props.groepen.length}`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
