import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import type { Rol } from '../core/roles';
import { IS_DEMO, IS_LOKAAL, maakDataSource } from '../data';
import type { DataSource } from '../data/types';
import { AppContext, type AppState } from './AppContext';
import { RolKiezer } from './components/RolKiezer';
import { Beheer } from './pages/Beheer';
import { Dashboard } from './pages/Dashboard';
import logo from './assets/logo-ijk.png';

export function App() {
  const [ds, setDs] = useState<DataSource | null>(null);
  // The local build starts as beheerder: the first step there is uploading the exports.
  const [rollen, setRollen] = useState<Rol[]>(IS_LOKAAL ? ['beheerder'] : ['gebruiker']);
  const [versie, setVersie] = useState(0);

  useEffect(() => {
    maakDataSource().then(setDs);
  }, []);

  if (!ds) return <div className="laden">Laden…</div>;

  const state: AppState = { ds, rollen, setRollen, versie, verhoogVersie: () => setVersie((v) => v + 1) };

  return (
    <AppContext.Provider value={state}>
      <HashRouter>
        {IS_LOKAAL && (
          <div className="lokaal-banner" role="note">
            <strong>LOKAAL</strong> — gegevens worden alleen in deze browser verwerkt; niets wordt opgeslagen of verstuurd. Sluit het tabblad om ze te
            wissen.
          </div>
        )}
        <header className="kop">
          <div className="kop-inner">
            <NavLink to="/" className="kop-merk" aria-label="IJK – Dashboard SPP">
              <img src={logo} alt="IJK" width={249} height={167} />
              <span className="kop-merk-tekst">
                Dashboard SPP
                <small>Strategische personeelsplanning</small>
              </span>
            </NavLink>
            <nav className="kop-nav" aria-label="Hoofdmenu">
              <NavLink to="/" end>
                Dashboard
              </NavLink>
              <NavLink to="/beheer">Beheer</NavLink>
            </nav>
            <RolKiezer />
          </div>
        </header>
        <main className="inhoud">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/beheer" element={<Beheer />} />
            <Route path="*" element={<p>Pagina niet gevonden.</p>} />
          </Routes>
        </main>
        <footer className="voet">
          Interne tool IJK · Driessen Groep
          {IS_DEMO ? ' · demo-omgeving met uitsluitend fictieve gegevens' : ''}
          {IS_LOKAAL ? ' · lokale versie: gegevens blijven in deze browser en worden nergens opgeslagen' : ''}
        </footer>
      </HashRouter>
    </AppContext.Provider>
  );
}
