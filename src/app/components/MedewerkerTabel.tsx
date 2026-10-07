import { useMemo, useState } from 'react';
import { SPP_STATUSSEN, STATUS_LABELS } from '../../core/config/kwadranten';
import type { DashboardRegel } from '../../core/types';

const PAGINA = 50;
type Kolom = 'naam' | 'werkgevernaam' | 'afdeling' | 'leidinggevende' | 'status';
const KOLOMMEN: [Kolom, string][] = [
  ['naam', 'Medewerker'],
  ['werkgevernaam', 'Bedrijf'],
  ['afdeling', 'Afdeling/OE'],
  ['leidinggevende', 'Leidinggevende'],
  ['status', 'SPP-kwadrant'],
];

/** Employee table (all filters applied) with search, sorting and export to Excel. */
export function MedewerkerTabel({ regels, onExport }: { regels: DashboardRegel[]; onExport: (rijen: DashboardRegel[], zoekterm: string) => Promise<void> }) {
  const [zoek, setZoek] = useState('');
  const [sort, setSort] = useState<{ kolom: Kolom; op: boolean }>({ kolom: 'naam', op: true });
  const [aantal, setAantal] = useState(PAGINA);
  const [exporteren, setExporteren] = useState(false);
  const [exportFout, setExportFout] = useState<string | null>(null);

  const rijen = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    const gevonden = z
      ? regels.filter((r) => [r.naam, r.afdeling, r.leidinggevende, r.werkgevernaam].some((t) => t.toLowerCase().includes(z)))
      : [...regels];
    const waarde = (r: DashboardRegel) => (sort.kolom === 'status' ? String(SPP_STATUSSEN.indexOf(r.status)) : r[sort.kolom]);
    return gevonden.sort((a, b) => (sort.op ? 1 : -1) * waarde(a).localeCompare(waarde(b), 'nl') || a.naam.localeCompare(b.naam, 'nl'));
  }, [regels, zoek, sort]);

  const exporteer = async () => {
    setExporteren(true);
    setExportFout(null);
    try {
      await onExport(rijen, zoek.trim());
    } catch {
      setExportFout('Exporteren is niet gelukt. Probeer het opnieuw.');
    } finally {
      setExporteren(false);
    }
  };

  return (
    <>
      <div className="kaart-kop">
        <h2>Medewerkers</h2>
        <div className="kaart-acties">
          <input
            className="zoek"
            type="search"
            placeholder="Zoek op naam, afdeling of leidinggevende"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            aria-label="Zoek medewerker"
          />
          <button className="knop" onClick={exporteer} disabled={exporteren || rijen.length === 0}>
            {exporteren ? 'Exporteren…' : 'Exporteren naar Excel'}
          </button>
        </div>
      </div>
      {exportFout && <p className="fout">{exportFout}</p>}
      <p className="subtiel klein">
        {rijen.length} medewerker{rijen.length === 1 ? '' : 's'} in de huidige selectie. De export bevat precies deze lijst, plus de tabellen per bedrijf,
        afdeling en leidinggevende.
      </p>
      <div className="tabel-scroll">
        <table className="matrix">
          <thead>
            <tr>
              {KOLOMMEN.map(([k, label]) => (
                <th key={k} scope="col" aria-sort={sort.kolom === k ? (sort.op ? 'ascending' : 'descending') : undefined}>
                  <button className="sorteer" onClick={() => setSort((s) => ({ kolom: k, op: s.kolom === k ? !s.op : true }))}>
                    {label}
                    {sort.kolom === k ? (sort.op ? ' ▲' : ' ▼') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rijen.slice(0, aantal).map((r) => (
              <tr key={r.sleutel}>
                <td>{r.naam}</td>
                <td>{r.werkgevernaam}</td>
                <td>{r.afdeling}</td>
                <td>{r.leidinggevende || <span className="subtiel">—</span>}</td>
                <td>
                  <span className="chip">
                    <span className={`hexje k-${r.status}`} aria-hidden />
                    {STATUS_LABELS[r.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rijen.length > aantal && (
        <div className="kaart-voet">
          <button className="knop" onClick={() => setAantal((a) => a + PAGINA)}>
            Toon meer ({rijen.length - aantal} resterend)
          </button>
        </div>
      )}
    </>
  );
}
