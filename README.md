# Dashboard SPP IJK

Interne webtool van IJK (Driessen Groep) voor de **strategische personeelsplanning (SPP)**. HR-collega's van IJK zien welke medewerkers door hun leidinggevende in een van de vier SPP-kwadranten zijn geplot, bij welk bedrijf en welke afdeling/OE zij werken, en wie hun leidinggevende is.

> **Demo:** https://driessengroep-prm.github.io/Dashboard-SPP_IJK/
>
> De demo bevat uitsluitend **fictieve gegevens**. Upload daar nooit echte exports; gebruik daarvoor de lokale versie (zie hieronder).

Opgezet op dezelfde manier als het dashboard AI & data trainingsprogramma, in de huisstijl van IJK (huisstijlhandboek versie 08-2025).

## Invoer

De beheerder uploadt op de beheerpagina twee Excel-exports:

1. **SPP-export**: medewerkers, hun leidinggevende en (indien gescoord) het kwadrant. De kopnamen mogen variëren; deze worden herkend (hoofdletters/spaties maken niet uit):
   - naam (verplicht): `Naam`, `Naam medewerker`, `Medewerker`, `Werknemer`, …
   - kwadrant (verplicht): `SPP-kwadrant`, `Kwadrant`, `SPP`, `Score`, `Positie`, … Een lege cel = niet gescoord;
   - leidinggevende: `Leidinggevende`, `Naam leidinggevende`, `Manager`;
   - voor de koppeling (aanbevolen): `Personeelsnummer` en/of `E-mail`.

   Kwadrantwaarden worden herkend ongeacht schrijfwijze: *Talent/voorloper* (ook "Talent", "Voorloper"), *Vaste waarde/sterkhouder* (ook "Vaste waarde", "Sterkhouder"), *Vraagteken* en *Achterblijver*. Een onbekende waarde telt als niet gescoord en komt op de uitzonderingenlijst. De volledige lijst met kopnamen staat in `src/core/parsing/spp.ts`.
2. **HR-export** ("Lijst FvB", werkblad "DG MW in dienst"): exact hetzelfde bestand als bij het dashboard AI & data trainingsprogramma. Gelezen worden `Naam`, `E-mail werk`, `Personeelsnummer`, `Werkgevernaam` en `Org. eenheid omschrijving`.

**Koppeling:** per SPP-regel op personeelsnummer, anders op e-mail, anders op naam (ook "Achternaam, Voornaam"). De SPP-export bepaalt wie er in het dashboard staat. Wie niet in de HR-lijst staat, blijft zichtbaar als "Onbekend (niet in HR-lijst)" en komt op de uitzonderingenlijst, net als namen die meerdere keren in de HR-lijst voorkomen en dubbele SPP-regels.

## Wat het dashboard laat zien

Alles volgt de filters (bedrijf, afdeling/OE, leidinggevende, medewerker, SPP-kwadrant). De filters staan in de URL, zodat je een selectie kunt delen; medewerkers staan daarin als onleesbare code.

- **Kerncijfers:** aantal medewerkers, en per kwadrant het aantal en het percentage. Klik op een tegel om op dat kwadrant te filteren.
- **SPP-matrix** (2×2): aantallen per kwadrant. Aanname voor de assen: horizontaal *functioneren*, verticaal *potentieel* (aan te passen in `src/core/config/kwadranten.ts`).
- **Per bedrijf:** verhouding van de kwadranten per bedrijf (100%-balken).
- **Vergelijking tussen bedrijven, afdelingen of leidinggevenden:** per gekozen kwadrant het aandeel per groep, van hoog naar laag, met het gemiddelde van de selectie als stippellijn. Groepen kleiner dan 5 zijn standaard verborgen.
- **Per afdeling/OE** en **per leidinggevende:** verdeling, aantallen of percentages per kwadrant, sorteerbaar.
- **Medewerkers:** naam, bedrijf, afdeling/OE, leidinggevende en kwadrant; zoeken, sorteren en **exporteren naar Excel** (precies de getoonde lijst, plus de tabellen per bedrijf/afdeling/leidinggevende en de gebruikte selectie).
- **Percentages van:** kies of percentages over de gescoorde medewerkers (standaard) of over alle medewerkers gaan.

## Lokaal gebruiken met echte exports

```bash
npm install
npm run build:lokaal
# → dist-lokaal/dashboard-spp-ijk-lokaal.html
```

Open dat ene HTML-bestand door erop te dubbelklikken. Je start als beheerder: upload de twee exports en het dashboard vult zich.

- **Niets verlaat je computer.** Een strikte Content-Security-Policy (`connect-src 'none'`) blokkeert elk netwerkverzoek. Gegevens staan alleen in het geheugen van dat tabblad; sluiten wist ze.
- **Het bestand zelf bevat geen gegevens** en mag dus gedeeld worden. De Excel-bestanden, exports en schermafdrukken met echte gegevens natuurlijk niet: SPP-scores zijn vertrouwelijk.
- `dist-lokaal/` staat in `.gitignore` en wordt nooit gepubliceerd.

## Ontwikkelen

Vereist: Node.js 20 of hoger (CI gebruikt 22).

| Commando | Wat |
|---|---|
| `npm run dev` | Demo starten op http://localhost:5173/Dashboard-SPP_IJK/ |
| `npm test` | Unit-tests (Vitest) |
| `npm run typecheck` | TypeScript-controle |
| `npm run build:demo` | Demo-build naar `dist/` |
| `npm run build:lokaal` | Eén offline HTML-bestand (zie hierboven) |
| `npm run privacy-check` | Privacycheck op de repo en `dist/` |
| `npm run testdata` | Fictieve testdata opnieuw genereren in `testdata/fictief/` |

De fictieve testdata volgt de echte structuur van bedrijven en OE's (833 medewerkers bij 14 bedrijven) met verzonnen namen, leidinggevenden en kwadranten; alle e-mailadressen eindigen op `.example`. Bewuste randgevallen: verschillende schrijfwijzen van kwadranten, SPP-regels zonder e-mail (koppeling op naam), dubbele namen, een onbekende kwadrantwaarde, een dubbele SPP-regel en twee personen die niet in de HR-lijst staan.

## Publicatie (GitHub Pages)

Elke push naar `main` draait `.github/workflows/pages.yml`: tests → privacycheck → demo-build → privacycheck op de build → deploy. Faalt een stap, dan wordt er niet gedeployed. Zet in de repo-instellingen onder *Settings → Pages* de bron op **GitHub Actions**.

De privacycheck laat de build falen bij `.xlsx`/`.xls`/`.csv` buiten `testdata/fictief/`, bij e-mailadressen die niet op `.example` eindigen in de build en bij iets dat op een sleutel of geheim lijkt. De demo-upload weigert bestanden met echte e-mailadressen en SPP-bestanden zonder e-mailkolom.

## Structuur

```
src/core/      gedeelde, geteste kernlogica (inlezen, kwadranten, koppeling, filters, aggregaties, export)
src/data/      BrowserDataSource: gebundelde demodata of uploads, alleen in het geheugen
src/app/       React-UI (dashboard, beheer, grafieken)
scripts/       testdatagenerator, privacycheck, lokaal HTML-bestand
testdata/fictief/  gegenereerde fictieve exports
```
