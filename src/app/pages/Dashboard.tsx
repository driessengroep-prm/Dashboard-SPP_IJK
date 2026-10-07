import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { perAfdeling, perBedrijf, perLeidinggevende, pct, verdeling, type Groep } from '../../core/aggregate';
import { KWADRANTEN, SPP_STATUSSEN, STATUS_LABELS, type SppStatus } from '../../core/config/kwadranten';
import { bouwGroepExport, bouwMedewerkerExport, exportBestandsnaam } from '../../core/export';
import { bedrijfSleutel, leidinggevendeVan, medewerkerId, pasFiltersToe, pasSelectieToe, type DashboardFilters } from '../../core/filters';
import type { DashboardRegel } from '../../core/types';
import { GeenToegangFout, type DashboardData } from '../../data/types';
import { useApp } from '../AppContext';
import { GeenToegang } from '../components/GeenToegang';
import { GroepKaart } from '../components/GroepKaart';
import { deel, fmt, type Basis } from '../components/Kwadrant';
import { KwadrantMatrix } from '../components/KwadrantMatrix';
import { MedewerkerTabel } from '../components/MedewerkerTabel';
import { MultiFilter } from '../components/MultiFilter';
import { Vergelijking, type Dimensie } from '../components/Vergelijking';

type FilterSleutel = 'bedrijf' | 'afdeling' | 'leidinggevende' | 'medewerker' | 'kwadrant';

const uniek = <T,>(a: T[]): T[] => [...new Set(a)];
const nl = (a: string, b: string) => a.localeCompare(b, 'nl');

/** Rows within the chosen companies / departments / managers (empty choice = all). */
function binnen(regels: readonly DashboardRegel[], bedrijven: string[], afdelingen: string[] = [], leidinggevenden: string[] = []) {
  const b = new Set(bedrijven);
  const a = new Set(afdelingen);
  const l = new Set(leidinggevenden);
  return regels.filter(
    (r) => (!b.size || b.has(bedrijfSleutel(r))) && (!a.size || a.has(r.afdeling)) && (!l.size || l.has(leidinggevendeVan(r))),
  );
}

export function Dashboard() {
  const { ds, rollen, versie } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [fout, setFout] = useState<{ toegang: boolean; tekst: string } | null>(null);
  const [params, setParams] = useSearchParams();
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let actueel = true;
    setFout(null);
    ds.getDashboard(rollen)
      .then((d) => actueel && setData(d))
      .catch((e) => {
        if (!actueel) return;
        setData(null);
        setFout({ toegang: e instanceof GeenToegangFout, tekst: e instanceof Error ? e.message : 'Onbekende fout' });
      });
    return () => {
      actueel = false;
    };
  }, [ds, rollen, versie]);

  const regels = useMemo(() => data?.regels ?? [], [data]);
  const basis: Basis = params.get('basis') === 'alle' ? 'alle' : 'gescoord';

  // Filter options cascade: company → department → manager → employee
  const opties = useMemo(() => {
    const b = params.getAll('bedrijf');
    const a = params.getAll('afdeling');
    const l = params.getAll('leidinggevende');
    const bedrijven = uniek(regels.map((r) => `${bedrijfSleutel(r)}\u0000${r.werkgevernaam}`))
      .map((s) => s.split('\u0000') as [string, string])
      .sort((x, y) => nl(x[1], y[1]));
    const afdelingen = uniek(binnen(regels, b).map((r) => r.afdeling)).sort(nl);
    const leidinggevenden = uniek(binnen(regels, b, a).map(leidinggevendeVan)).sort(nl);
    const medewerkers: [string, string, string][] = binnen(regels, b, a, l)
      .map((r): [string, string, string] => [medewerkerId(r.sleutel), r.naam, r.afdeling])
      .sort((x, y) => nl(x[1], y[1]) || nl(x[2], y[2]));
    return { bedrijven, afdelingen, leidinggevenden, medewerkers };
  }, [regels, params]);

  const filters: DashboardFilters = useMemo(() => {
    const f = (k: FilterSleutel) => params.getAll(k);
    return {
      bedrijven: f('bedrijf').filter((b) => opties.bedrijven.some(([c]) => c === b)),
      afdelingen: f('afdeling').filter((a) => opties.afdelingen.includes(a)),
      leidinggevenden: f('leidinggevende').filter((l) => opties.leidinggevenden.includes(l)),
      medewerkers: f('medewerker').filter((m) => opties.medewerkers.some(([id]) => id === m)),
      kwadranten: f('kwadrant').filter((s): s is SppStatus => (SPP_STATUSSEN as readonly string[]).includes(s)),
    };
  }, [params, opties]);

  // Charts and tiles: the population chosen with company/department/manager/employee.
  // The quadrant filter highlights quadrants there and selects the employees in the table.
  const selectie = useMemo(() => pasSelectieToe(regels, filters), [regels, filters]);
  const gefilterd = useMemo(() => pasFiltersToe(regels, filters), [regels, filters]);
  const groepen = useMemo(
    () => ({ bedrijf: perBedrijf(selectie), afdeling: perAfdeling(selectie), leidinggevende: perLeidinggevende(selectie) }),
    [selectie],
  );

  // Each filter is stored as repeated URL parameters, so a selection can be shared (names never appear: employees are opaque ids)
  const zet = (waarden: Partial<Record<FilterSleutel | 'basis', string[]>>) => {
    const p = new URLSearchParams(params);
    for (const [k, lijst] of Object.entries(waarden)) {
      p.delete(k);
      for (const v of lijst ?? []) p.append(k, v);
    }
    setParams(p, { replace: true });
  };

  // Narrowing a higher level drops lower-level choices that no longer fit
  const geldig = (b: string[], a: string[], l: string[]) => {
    const rest = binnen(regels, b, a, l);
    const ids = new Set(rest.map((r) => medewerkerId(r.sleutel)));
    return params.getAll('medewerker').filter((m) => ids.has(m));
  };
  const zetBedrijven = (b: string[]) => {
    const binnenB = binnen(regels, b);
    const afd = new Set(binnenB.map((r) => r.afdeling));
    const a = params.getAll('afdeling').filter((x) => afd.has(x));
    const ldg = new Set(binnen(regels, b, a).map(leidinggevendeVan));
    const l = params.getAll('leidinggevende').filter((x) => ldg.has(x));
    zet({ bedrijf: b, afdeling: a, leidinggevende: l, medewerker: geldig(b, a, l) });
  };
  const zetAfdelingen = (a: string[]) => {
    const b = params.getAll('bedrijf');
    const ldg = new Set(binnen(regels, b, a).map(leidinggevendeVan));
    const l = params.getAll('leidinggevende').filter((x) => ldg.has(x));
    zet({ afdeling: a, leidinggevende: l, medewerker: geldig(b, a, l) });
  };
  const zetLeidinggevenden = (l: string[]) => zet({ leidinggevende: l, medewerker: geldig(params.getAll('bedrijf'), params.getAll('afdeling'), l) });
  const wisselKwadrant = (s: SppStatus) => {
    const huidig = filters.kwadranten ?? [];
    zet({ kwadrant: huidig.includes(s) ? huidig.filter((x) => x !== s) : SPP_STATUSSEN.filter((x) => x === s || huidig.includes(x)) });
  };
  const naarDetail = () => setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  const kiesGroep = (d: Dimensie, g: Groep) => {
    if (d === 'bedrijf') zetBedrijven([g.sleutel]);
    if (d === 'afdeling') zetAfdelingen([g.sleutel]);
    if (d === 'leidinggevende') zetLeidinggevenden([g.sleutel]);
  };

  if (fout) return fout.toegang ? <GeenToegang /> : <p className="fout">{fout.tekst}</p>;
  if (!data) return <div className="laden">Gegevens laden…</div>;

  const totaal = verdeling(selectie);
  const gekozen = filters.kwadranten ?? [];
  const nFilters = Object.values(filters).filter((a) => a && a.length).length;
  const selectieOmschrijving: [string, string][] = [
    ['Bedrijf', filters.bedrijven?.length ? opties.bedrijven.filter(([c]) => filters.bedrijven!.includes(c)).map(([, n]) => n).join(', ') : 'Alle'],
    ['Afdeling/OE', filters.afdelingen?.length ? filters.afdelingen.join(', ') : 'Alle'],
    ['Leidinggevende', filters.leidinggevenden?.length ? filters.leidinggevenden.join(', ') : 'Alle'],
    ['Medewerker', filters.medewerkers?.length ? opties.medewerkers.filter(([id]) => filters.medewerkers!.includes(id)).map(([, n]) => n).join(', ') : 'Alle'],
    ['SPP-kwadrant', gekozen.length ? gekozen.map((s) => STATUS_LABELS[s]).join(', ') : 'Alle'],
  ];

  const exporteer = async (rijen: DashboardRegel[], zoekterm: string) => {
    const { downloadExcel } = await import('../excelExport');
    await downloadExcel(
      [
        bouwMedewerkerExport(rijen),
        bouwGroepExport('Per bedrijf', 'Bedrijf', groepen.bedrijf),
        bouwGroepExport('Per afdeling', 'Afdeling/OE', groepen.afdeling),
        bouwGroepExport('Per leidinggevende', 'Leidinggevende', groepen.leidinggevende),
      ],
      zoekterm ? [...selectieOmschrijving, ['Zoekterm in tabel', zoekterm]] : selectieOmschrijving,
      exportBestandsnaam(new Date()),
    );
  };

  return (
    <div className="dashboard">
      <div className="hero">
        <div>
          <h1>Dashboard strategische personeelsplanning</h1>
          <p>
            SPP-kwadranten per medewerker, bedrijf, afdeling en leidinggevende
            {data.peildatum ? ` · gegevens van ${data.peildatum.toLocaleDateString('nl-NL')}` : ''}
          </p>
        </div>
      </div>

      {regels.length > 0 && (
        <section className="tegels" aria-label="Kerncijfers">
          <div className="tegel">
            <div className="tegel-label">Medewerkers</div>
            <div className="tegel-waarde">{totaal.medewerkers}</div>
            <div className="tegel-toelichting">
              {totaal.gescoord} gescoord ({fmt(pct(totaal.gescoord, totaal.medewerkers))}%)
            </div>
          </div>
          {SPP_STATUSSEN.map((s) => (
            <button
              key={s}
              type="button"
              className={gekozen.includes(s) ? 'tegel actief' : 'tegel'}
              style={{ ['--tegel-kleur' as string]: `var(--k-${s})` }}
              aria-pressed={gekozen.includes(s)}
              onClick={() => wisselKwadrant(s)}
              title={`Klik om ${gekozen.includes(s) ? 'het filter op dit kwadrant op te heffen' : 'de medewerkers in dit kwadrant te tonen'}.`}
            >
              <span className="tegel-label">
                <span className={`hexje k-${s}`} aria-hidden />
                {STATUS_LABELS[s]}
              </span>
              <span className="tegel-waarde">{totaal.telling[s]}</span>
              <span className="tegel-toelichting">
                {s === 'niet_gescoord'
                  ? `${fmt(pct(totaal.telling[s], totaal.medewerkers))}% van alle medewerkers`
                  : `${fmt(deel(totaal, s, basis))}% van ${basis === 'gescoord' ? 'gescoorde' : 'alle'} medewerkers`}
              </span>
            </button>
          ))}
        </section>
      )}

      <section className="filters kaart" aria-label="Filters">
        <MultiFilter label="Bedrijf" waarden={filters.bedrijven ?? []} opties={opties.bedrijven.map(([c, n]) => [c, n])} onChange={zetBedrijven} />
        <MultiFilter label="Afdeling/OE" zoekbaar waarden={filters.afdelingen ?? []} opties={opties.afdelingen.map((a) => [a, a])} onChange={zetAfdelingen} />
        <MultiFilter
          label="Leidinggevende"
          zoekbaar
          waarden={filters.leidinggevenden ?? []}
          opties={opties.leidinggevenden.map((l) => [l, l])}
          onChange={zetLeidinggevenden}
        />
        <MultiFilter label="Medewerker" zoekbaar waarden={filters.medewerkers ?? []} opties={opties.medewerkers} onChange={(v) => zet({ medewerker: v })} />
        <MultiFilter
          label="SPP-kwadrant"
          waarden={gekozen}
          opties={SPP_STATUSSEN.map((s) => [s, STATUS_LABELS[s]])}
          onChange={(v) => zet({ kwadrant: v })}
          snelkeuzes={[{ label: 'Alleen gescoorde', waarden: [...KWADRANTEN] }]}
        />
        <div className="filter-acties">
          <label className="filter inline" title="Waarover worden de percentages berekend?">
            <span>Percentages van</span>
            <select value={basis} onChange={(e) => zet({ basis: e.target.value === 'alle' ? ['alle'] : [] })}>
              <option value="gescoord">gescoorde medewerkers</option>
              <option value="alle">alle medewerkers</option>
            </select>
          </label>
          <button className="knop-link" disabled={nFilters === 0} onClick={() => zet({ bedrijf: [], afdeling: [], leidinggevende: [], medewerker: [], kwadrant: [] })}>
            Filters wissen
          </button>
        </div>
      </section>

      {regels.length === 0 ? (
        <section className="kaart melding">
          {data.geenDataset ? (
            <>
              Er zijn nog geen gegevens geladen. Upload de SPP-export en de HR-export op de <Link to="/beheer">beheerpagina</Link>.
            </>
          ) : (
            'Er zijn geen gegevens beschikbaar.'
          )}
        </section>
      ) : selectie.length === 0 ? (
        <section className="kaart melding">Geen medewerkers in deze selectie.</section>
      ) : (
        <>
          <div className="raster-2">
            <section className="kaart">
              <div className="kaart-kop">
                <h2>SPP-matrix</h2>
              </div>
              <p className="subtiel klein">Aantal medewerkers per kwadrant in de selectie. Klik op een kwadrant om de medewerkers te tonen.</p>
              <KwadrantMatrix v={totaal} actief={gekozen} onKies={wisselKwadrant} />
            </section>
            <GroepKaart
              titel="Per bedrijf"
              toelichting="Verhouding van de kwadranten per bedrijf. Klik op een bedrijf om erop te filteren."
              groepen={groepen.bedrijf}
              basis={basis}
              actief={filters.bedrijven ?? []}
              onKies={(g) => zetBedrijven([g.sleutel])}
            />
          </div>

          <Vergelijking groepen={groepen} totaal={totaal} basis={basis} startKwadrant={gekozen[0] ?? 'talent'} onKies={kiesGroep} />

          <GroepKaart
            titel="Per afdeling/OE"
            toelichting="Verhouding en aantallen per afdeling/OE. Klik op een afdeling om de medewerkers te zien. Tip: filter eerst op bedrijf."
            groepen={groepen.afdeling}
            basis={basis}
            perKwadrant
            compact
            inklapbaar
            actief={filters.afdelingen ?? []}
            onKies={(g) => {
              zetAfdelingen([g.sleutel]);
              naarDetail();
            }}
          />

          <GroepKaart
            titel="Per leidinggevende"
            toelichting="Wie heeft zijn of haar medewerkers al geplot, en hoe is de verdeling per team?"
            groepen={groepen.leidinggevende}
            basis={basis}
            perKwadrant
            compact
            inklapbaar
            actief={filters.leidinggevenden ?? []}
            onKies={(g) => {
              zetLeidinggevenden([g.sleutel]);
              naarDetail();
            }}
          />

          <section ref={detailRef} className="kaart">
            <MedewerkerTabel regels={gefilterd} onExport={exporteer} />
          </section>
        </>
      )}
    </div>
  );
}
