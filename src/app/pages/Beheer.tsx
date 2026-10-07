import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SPP_KOLOMMEN } from '../../core/parsing/spp';
import { magBeheren } from '../../core/roles';
import type { UitzonderingType } from '../../core/types';
import { GeenToegangFout, type BeheerOverzicht } from '../../data/types';
import { useApp } from '../AppContext';
import { GeenToegang } from '../components/GeenToegang';

const TYPE_LABELS: Record<UitzonderingType, string> = {
  geen_hr_match: 'Niet in HR-lijst',
  naam_dubbelzinnig: 'Naam niet eenduidig',
  onbekend_kwadrant: 'Onbekend kwadrant',
  spp_dubbel: 'Dubbel in SPP-export',
  hr_dubbel: 'Dubbel in HR-lijst',
  onbekend_bedrijf: 'Onbekend bedrijf',
};

const kolomNamen = (k: keyof typeof SPP_KOLOMMEN) => SPP_KOLOMMEN[k].namen.map((n) => `"${n}"`).join(', ');

export function Beheer() {
  const { ds, rollen, versie, verhoogVersie } = useApp();
  // undefined = loading, null = no data set loaded yet
  const [overzicht, setOverzicht] = useState<BeheerOverzicht | null | undefined>(undefined);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (!magBeheren(rollen)) return;
    let actueel = true;
    setFout(null);
    ds.getBeheer(rollen)
      .then((o) => actueel && setOverzicht(o))
      .catch((e) => actueel && setFout(e instanceof GeenToegangFout ? 'geen-toegang' : e instanceof Error ? e.message : 'Onbekende fout'));
    return () => {
      actueel = false;
    };
  }, [ds, rollen, versie]);

  if (!magBeheren(rollen) || fout === 'geen-toegang') {
    return <GeenToegang melding='Alleen de beheerder heeft toegang tot het beheerdersportaal. Kies rechtsboven de gesimuleerde rol "Beheerder".' />;
  }
  if (fout) return <p className="fout">{fout}</p>;
  if (overzicht === undefined) return <div className="laden">Laden…</div>;

  const bijgewerkt = (o: BeheerOverzicht) => {
    setOverzicht(o);
    verhoogVersie();
  };

  return (
    <div className="beheer">
      <div className="pagina-kop">
        <h1>Beheer</h1>
        <p className="subtiel">
          {overzicht === null
            ? 'Er zijn nog geen gegevens geladen. Upload de SPP-export en de HR-export om het dashboard te vullen.'
            : `Huidige dataset: ${overzicht.bron === 'gebundeld' ? 'gebundelde fictieve demodata' : 'geüploade bestanden'} (${overzicht.bestanden.spp}, ${overzicht.bestanden.hr})` +
              (overzicht.peildatum
                ? overzicht.bron === 'gebundeld'
                  ? ` · peildatum ${overzicht.peildatum.toLocaleDateString('nl-NL')}`
                  : ` · verwerkt op ${overzicht.peildatum.toLocaleString('nl-NL')}`
                : '')}
        </p>
      </div>

      <Upload onKlaar={bijgewerkt} />

      {overzicht && (
        <>
          <section className="tegels" aria-label="Samenvatting koppeling">
            <Tegel label="Medewerkers in SPP-export" waarde={overzicht.samenvatting.medewerkers} />
            <Tegel label="Gescoord" waarde={overzicht.samenvatting.gescoord} toelichting={`${overzicht.samenvatting.nietGescoord} niet gescoord`} />
            <Tegel
              label="Gekoppeld aan HR-lijst"
              waarde={overzicht.samenvatting.gekoppeld}
              toelichting={`${overzicht.samenvatting.perWijze.personeelsnummer} op personeelsnummer · ${overzicht.samenvatting.perWijze.email} op e-mail · ${overzicht.samenvatting.perWijze.naam} op naam`}
            />
            <Tegel label="Niet gekoppeld" waarde={overzicht.samenvatting.nietGekoppeld} toelichting="getoond met onbekende afdeling (bedrijf uit de SPP-export)" />
            <Tegel
              label="HR-medewerkers niet in SPP-export"
              waarde={overzicht.samenvatting.hrNietInSpp}
              toelichting={`van ${overzicht.samenvatting.hrMedewerkers} in de HR-lijst; niet in het dashboard`}
            />
          </section>
          {!overzicht.sppKolommen.kopregel && (
            <p className="subtiel klein">
              De SPP-export heeft geen (herkende) kopregel; de vaste indeling is gebruikt: A personeelsnummer, B naam, C bedrijf, D leidinggevende, E
              kwadrant.
            </p>
          )}
          {!overzicht.sppKolommen.leidinggevende && (
            <p className="waarschuwing">De SPP-export heeft geen kolom voor de leidinggevende ({kolomNamen('leidinggevende')}).</p>
          )}
          <p className="subtiel klein">
            Klaar? Bekijk het <Link to="/">dashboard</Link>.
          </p>
          <Uitzonderingen overzicht={overzicht} />
        </>
      )}
    </div>
  );
}

function Tegel({ label, waarde, toelichting }: { label: string; waarde: number; toelichting?: string }) {
  return (
    <div className="tegel">
      <div className="tegel-label">{label}</div>
      <div className="tegel-waarde">{waarde}</div>
      {toelichting && <div className="tegel-toelichting">{toelichting}</div>}
    </div>
  );
}

function Upload({ onKlaar }: { onKlaar: (o: BeheerOverzicht) => void }) {
  const { ds, rollen } = useApp();
  const [spp, setSpp] = useState<File | null>(null);
  const [hr, setHr] = useState<File | null>(null);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);
  const [formKey, setFormKey] = useState(0);

  const verstuur = async (e: FormEvent) => {
    e.preventDefault();
    if (!spp || !hr) return;
    setBezig(true);
    setMelding(null);
    try {
      const o = await ds.upload(rollen, spp, hr);
      onKlaar(o);
      setMelding({ ok: true, tekst: `Bestanden verwerkt: ${o.samenvatting.medewerkers} medewerkers, waarvan ${o.samenvatting.gescoord} gescoord.` });
      setSpp(null);
      setHr(null);
      setFormKey((k) => k + 1);
    } catch (err) {
      setMelding({ ok: false, tekst: err instanceof Error ? err.message : 'Uploaden mislukt.' });
    } finally {
      setBezig(false);
    }
  };

  const accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return (
    <section className="kaart">
      <h2>Exports uploaden</h2>
      <form key={formKey} className="upload" onSubmit={verstuur}>
        <label>
          <span>1. SPP-export (medewerkers, leidinggevenden en kwadrant, .xlsx)</span>
          <input type="file" accept={accept} onChange={(e) => setSpp(e.target.files?.[0] ?? null)} />
        </label>
        <label>
          <span>2. HR-export (Lijst FvB, .xlsx)</span>
          <input type="file" accept={accept} onChange={(e) => setHr(e.target.files?.[0] ?? null)} />
        </label>
        <button className="knop primair" type="submit" disabled={!spp || !hr || bezig}>
          {bezig ? 'Verwerken…' : 'Verwerken'}
        </button>
      </form>
      {melding && (
        <p className={melding.ok ? 'succes' : 'fout'} role={melding.ok ? 'status' : 'alert'}>
          {melding.tekst}
        </p>
      )}
      <details className="klein" style={{ marginTop: 12 }}>
        <summary>Welke kolommen worden gelezen?</summary>
        <p className="subtiel klein">Alleen deze kolommen worden ingelezen; alle andere kolommen worden genegeerd. Hoofdletters en spaties maken niet uit.</p>
        <ul className="kolomlijst">
          <li>
            SPP-export zonder kopregel (zoals de standaardexport): A personeelsnummer, B naam, C bedrijf, D leidinggevende, E kwadrant. De koppeling met
            de HR-export gaat op naam (voor- en achternaam); komt een naam vaker voor, dan beslist het bedrijf uit kolom C.
          </li>
          <li>SPP-export mét kopregel, naam medewerker (verplicht): {kolomNamen('naam')}</li>
          <li>SPP-export mét kopregel, kwadrant (verplicht): {kolomNamen('kwadrant')}. Leeg = niet gescoord.</li>
          <li>SPP-export mét kopregel, bedrijf: {kolomNamen('bedrijf')}; leidinggevende: {kolomNamen('leidinggevende')}</li>
          <li>SPP-export mét kopregel, voor de koppeling (aanbevolen): {kolomNamen('personeelsnummer')} of {kolomNamen('email')}</li>
          <li>HR-export (werkblad "DG MW in dienst"): "Naam", "E-mail werk", "Personeelsnummer", "Werkgevernaam", "Org. eenheid omschrijving"</li>
        </ul>
      </details>
    </section>
  );
}

function Uitzonderingen({ overzicht }: { overzicht: BeheerOverzicht }) {
  const [type, setType] = useState<UitzonderingType | ''>('');
  const telling = useMemo(() => {
    const t = new Map<UitzonderingType, number>();
    for (const u of overzicht.uitzonderingen) t.set(u.type, (t.get(u.type) ?? 0) + 1);
    return t;
  }, [overzicht]);
  const lijst = type ? overzicht.uitzonderingen.filter((u) => u.type === type) : overzicht.uitzonderingen;

  return (
    <section className="kaart">
      <div className="kaart-kop">
        <h2>Uitzonderingenlijst</h2>
        <label className="filter inline">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as UitzonderingType | '')}>
            <option value="">Alle ({overzicht.uitzonderingen.length})</option>
            {[...telling.entries()].map(([t, n]) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]} ({n})
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="subtiel klein">Bevat persoonsgegevens en is alleen zichtbaar voor de beheerder.</p>
      {lijst.length === 0 ? (
        <p>Geen uitzonderingen.</p>
      ) : (
        <div className="tabel-scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Bron</th>
                <th scope="col" className="num">
                  Rij
                </th>
                <th scope="col">Naam</th>
                <th scope="col">Toelichting</th>
              </tr>
            </thead>
            <tbody>
              {lijst.map((u, i) => (
                <tr key={i}>
                  <td>{TYPE_LABELS[u.type]}</td>
                  <td>{u.bron === 'hr' ? 'HR' : 'SPP'}</td>
                  <td className="num">{u.rijnummer ?? '—'}</td>
                  <td>{u.naam || '—'}</td>
                  <td style={{ whiteSpace: 'normal' }}>{u.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
