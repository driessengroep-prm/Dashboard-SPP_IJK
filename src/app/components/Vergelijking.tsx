import { useState } from 'react';
import type { Groep, Verdeling } from '../../core/aggregate';
import { KWADRANTEN, MATRIX_VOLGORDE, STATUS_LABELS, type SppStatus } from '../../core/config/kwadranten';
import { STANDAARD_MIN_GROEPSGROOTTE } from '../../core/config/instellingen';
import { deel, fmt, noemer, statussenVoor, type Basis } from './Kwadrant';

/** IJK only: groups are compared per department or per manager (not per company). */
export type Dimensie = 'afdeling' | 'leidinggevende';

const DIMENSIE_LABELS: Record<Dimensie, string> = { afdeling: 'Afdelingen/OE', leidinggevende: 'Leidinggevenden' };
const DIMENSIE_TITELS: Record<Dimensie, string> = { afdeling: 'afdelingen/OE', leidinggevende: 'leidinggevenden' };
const MAX_RIJEN = 20;

/**
 * Ranked comparison between groups: the share of one quadrant per group, sorted from high
 * to low, with the average of the whole selection as a dashed reference line.
 */
export function Vergelijking(props: {
  groepen: Record<Dimensie, Groep[]>;
  totaal: Verdeling;
  basis: Basis;
  startKwadrant: SppStatus;
  onKies: (dimensie: Dimensie, g: Groep) => void;
}) {
  const { groepen, totaal, basis } = props;
  const [dimensie, setDimensie] = useState<Dimensie>('afdeling');
  const [gekozen, setKwadrant] = useState<SppStatus | null>(null);
  const [alles, setAlles] = useState(false);
  const opties = statussenVoor(basis);
  const kwadrant = gekozen && opties.includes(gekozen) ? gekozen : opties.includes(props.startKwadrant) ? props.startKwadrant : KWADRANTEN[0];

  const groot = (g: Groep) => noemer(g, basis) >= STANDAARD_MIN_GROEPSGROOTTE;
  const kandidaten = groepen[dimensie].filter((g) => noemer(g, basis) > 0);
  // Groups smaller than the minimum are left out: their percentages say little
  const getoond = kandidaten.filter(groot).sort(
    (a, b) => deel(b, kwadrant, basis) - deel(a, kwadrant, basis) || noemer(b, basis) - noemer(a, basis) || a.label.localeCompare(b.label, 'nl'),
  );
  const verborgen = kandidaten.length - getoond.length;
  const zichtbaar = alles ? getoond : getoond.slice(0, MAX_RIJEN);
  const gemiddeld = deel(totaal, kwadrant, basis);
  // Scale: the largest share rounded up to a multiple of 10 (at least the average), so the bars use the width
  const max = Math.max(10, Math.ceil(Math.max(gemiddeld, ...zichtbaar.map((g) => deel(g, kwadrant, basis))) / 10) * 10);
  const basisTekst = kwadrant === 'niet_gescoord' || basis === 'alle' ? 'medewerkers' : 'gescoorde medewerkers';

  return (
    <section className="kaart">
      <div className="kaart-kop">
        <h2>Vergelijking tussen {DIMENSIE_TITELS[dimensie]}</h2>
        <div className="segment-keuze" role="group" aria-label="Vergelijk">
          {(Object.keys(DIMENSIE_LABELS) as Dimensie[]).map((d) => (
            <button key={d} type="button" aria-pressed={d === dimensie} onClick={() => setDimensie(d)}>
              {DIMENSIE_LABELS[d]}
            </button>
          ))}
        </div>
      </div>
      <div className="vergelijk-bediening">
        <div className="segment-keuze kwadrant-keuze" role="group" aria-label="Kwadrant">
          {MATRIX_VOLGORDE.filter((s) => opties.includes(s)).map((s) => (
            <button key={s} type="button" aria-pressed={s === kwadrant} onClick={() => setKwadrant(s)}>
              <span className={`hexje k-${s}`} aria-hidden />
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
      <p className="subtiel klein">
        Aandeel {STATUS_LABELS[kwadrant]} per groep, als percentage van de {basisTekst} in die groep; van hoog naar laag. De stippellijn is het
        gemiddelde van de hele selectie ({fmt(gemiddeld)}%). Klik op een naam om erop te filteren.
        {verborgen > 0 && ` Groepen kleiner dan ${STANDAARD_MIN_GROEPSGROOTTE} worden niet getoond.`}
      </p>
      {zichtbaar.length === 0 ? (
        <p className="melding">Geen groepen om te vergelijken in deze selectie.</p>
      ) : (
        <ul className={alles ? "vergelijk scrollbaar" : "vergelijk"} aria-label={`Aandeel ${STATUS_LABELS[kwadrant]} per groep`}>
          <li className="vergelijk-kop" aria-hidden>
            <span />
            <span className="vergelijk-spoor">
              <span className="gemiddelde-label" style={{ left: `${(gemiddeld / max) * 100}%` }}>
                gem. {fmt(gemiddeld)}%
              </span>
            </span>
          </li>
          {zichtbaar.map((g) => {
            const p = deel(g, kwadrant, basis);
            const n = kwadrant === 'niet_gescoord' ? g.medewerkers : noemer(g, basis);
            return (
              <li key={g.sleutel}>
                <button className="knop-link vergelijk-naam" title={g.label} onClick={() => props.onKies(dimensie, g)}>
                  {g.label}
                </button>
                <span className="vergelijk-spoor">
                  <span className="gemiddelde-lijn" style={{ left: `${(gemiddeld / max) * 100}%` }} />
                  <span
                    className={`vergelijk-balk k-${kwadrant}`}
                    style={{ width: `${(p / max) * 100}%` }}
                    title={`${g.label}: ${g.telling[kwadrant]} van ${n} (${fmt(p)}%)`}
                  />
                  <span className="vergelijk-waarde">
                    <strong>{fmt(p)}%</strong> · {g.telling[kwadrant]} van {n}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {getoond.length > MAX_RIJEN && (
        <div className="kaart-voet">
          <button className="knop" onClick={() => setAlles((a) => !a)}>
            {alles ? `Toon eerste ${MAX_RIJEN}` : `Toon alle ${getoond.length}`}
          </button>
        </div>
      )}
    </section>
  );
}
