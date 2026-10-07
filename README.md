# Dashboard SPP IJK

Interne webtool van IJK (Driessen Groep) voor de **strategische personeelsplanning (SPP)**, alleen voor IJK. HR-collega's van IJK zien welke medewerkers door hun leidinggevende in een van de vier SPP-kwadranten zijn geplot, bij welk bedrijf en welke afdeling/OE zij werken, en wie hun leidinggevende is.

> **Demo:** https://driessengroep-prm.github.io/Dashboard-SPP_IJK/
>
> De demo bevat uitsluitend **fictieve gegevens**. Upload daar nooit echte exports; gebruik daarvoor de lokale versie (zie hieronder).

Opgezet op dezelfde manier als het dashboard AI & data trainingsprogramma, in de huisstijl van IJK (huisstijlhandboek versie 08-2025). Het logo staat in `src/app/assets/logo-ijk.png` (bijgesneden uit `Logo IJK.png`).

## Invoer

De beheerder uploadt op de beheerpagina twee Excel-exports, als **.xlsx** of **.xlsb** (binaire Excel-werkmap):

1. **SPP-export**: medewerkers, hun leidinggevende en (indien gescoord) het kwadrant. De standaardexport (.xlsb of .xlsx) heeft deze kopregel; de eerste twee kolommen heten allebei "Mdw.":

   | Mdw. | Mdw. | Werkgever | Naam Leidinggevende | SPP |
   |---|---|---|---|---|
   | *personeelsnummer* | *naam* | *bedrijf* | *leidinggevende* | *kwadrant* |
   | 3345 | Jan Janssen | IJK B.V. | Piet Pietersen | Talent\\voorloper |

   Een lege cel in de kolom SPP = niet gescoord. Kwadrantwaarden worden herkend ongeacht schrijfwijze (`\`, `/`, hoofdletters): *Talent/voorloper* (ook "Talent", "Voorloper"), *Vaste waarde/sterkhouder* (ook "Vaste waarde", "Sterkhouder"), *Vraagteken* en *Achterblijver*. Een onbekende waarde telt als niet gescoord en komt op de uitzonderingenlijst. Andere kopnamen (bijv. "Naam", "Kwadrant", "Leidinggevende", "Personeelsnummer") en een export zonder kopregel (kolommen A–E in dezelfde volgorde) worden ook herkend; zie `src/core/parsing/spp.ts`.
2. **HR-export** ("Lijst FvB", werkblad "DG MW in dienst"): exact hetzelfde bestand als bij het dashboard AI & data trainingsprogramma. Gelezen worden `Naam`, `Werkgevernaam`, `Org. eenheid omschrijving` en, als ze er zijn, `E-mail werk` en `Personeelsnummer`.

**Koppeling:** op naam (voor- en achternaam; ook "Achternaam, Voornaam"), want de HR-export heeft geen personeelsnummer. Komt een naam vaker voor in de HR-lijst, dan beslist het bedrijf uit kolom C van de SPP-export. (Bevat een export wel een personeelsnummer of e-mail, dan gaat de koppeling daar eerst op.) De SPP-export bepaalt wie er in het dashboard staat. Wie niet in de HR-lijst staat, blijft zichtbaar met het bedrijf uit de SPP-export en afdeling "Onbekend (niet in HR-lijst)" en komt op de uitzonderingenlijst, net als namen die meerdere keren in de HR-lijst voorkomen en dubbele SPP-regels.

## Wat het dashboard laat zien

Alles volgt de filters (bedrijf, afdeling/OE, leidinggevende, medewerker, SPP-kwadrant). De filters staan in de URL, zodat je een selectie kunt delen; medewerkers staan daarin als onleesbare code.

- **Kerncijfers:** aantal medewerkers, en per kwadrant het aantal en het percentage. Klik op een tegel om op dat kwadrant te filteren.
- **SPP-matrix** (2×2) volgens de potentieel- en prestatiematrix: horizontaal *prestatie* (laag → hoog), verticaal *groeiruimte* (laag boven → hoog onder). Achterblijver (eerlijke aandacht) en Vaste waarde (koesteren) boven, Vraagteken (uitdagen) en Talent (faciliteren) onder. Vastgelegd in `src/core/config/kwadranten.ts`.
- **Vergelijking tussen afdelingen of leidinggevenden:** per gekozen kwadrant het aandeel per groep, van hoog naar laag, met het gemiddelde van de selectie als stippellijn. Groepen kleiner dan 5 worden niet getoond.
- **Per afdeling/OE** en **per leidinggevende:** verdeling, aantallen of percentages per kwadrant, sorteerbaar.
- **Medewerkers:** naam, bedrijf, afdeling/OE, leidinggevende en kwadrant; zoeken, sorteren en **exporteren naar Excel** (precies de getoonde lijst, plus de tabellen per afdeling/leidinggevende en de gebruikte selectie).
- **Percentages van:** kies of percentages over alle medewerkers (standaard) of alleen over de gescoorde medewerkers gaan.

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

De fictieve testdata volgt de echte structuur van bedrijven en OE's met verzonnen namen, leidinggevenden en kwadranten; alle e-mailadressen eindigen op `.example`. De fictieve HR-lijst bevat de hele groep (833 medewerkers bij 14 bedrijven), de fictieve SPP-export alleen de medewerkers van IJK B.V. en IJK Services B.V., in hetzelfde formaat als de echte (kopregel "Mdw. · Mdw. · Werkgever · Naam Leidinggevende · SPP"). Net als de echte HR-export heeft de fictieve HR-lijst geen personeelsnummer. Bewuste randgevallen: verschillende schrijfwijzen van kwadranten, gelijke namen (onderscheiden op bedrijf), een onbekende kwadrantwaarde, een dubbele SPP-regel en twee personen die niet in de HR-lijst staan.

De map `testdata/fictief/xlsb/` bevat dezelfde fictieve exports als .xlsb, eenmalig omgezet met een los hulpmiddel (SheetJS) buiten de repo, plus een bestand met alle celtypen. De tests controleren dat .xlsb exact dezelfde tabellen oplevert als .xlsx. Het .xlsb-formaat wordt gelezen door een eigen lezer (`src/core/parsing/xlsb.ts`), zonder extra dependency.

## Publicatie (GitHub Pages)

Elke push naar `main` draait `.github/workflows/pages.yml`: tests → privacycheck → demo-build → privacycheck op de build → deploy. Faalt een stap, dan wordt er niet gedeployed. Bij een pull request draaien dezelfde controles, zonder deploy. Zet in de repo-instellingen onder *Settings → Pages* de bron op **GitHub Actions**.

De privacycheck laat de build falen bij `.xlsx`/`.xlsb`/`.xls`/`.csv` buiten `testdata/fictief/`, bij e-mailadressen die niet op `.example` eindigen in de build en bij iets dat op een sleutel of geheim lijkt. De demo-upload weigert bestanden met echte e-mailadressen en een SPP-export die niet aansluit op de fictieve HR-lijst (minder dan 90% gekoppeld).

## Structuur

```
src/core/      gedeelde, geteste kernlogica (inlezen, kwadranten, koppeling, filters, aggregaties, export)
src/data/      BrowserDataSource: gebundelde demodata of uploads, alleen in het geheugen
src/app/       React-UI (dashboard, beheer, grafieken)
scripts/       testdatagenerator, privacycheck, lokaal HTML-bestand
testdata/fictief/  gegenereerde fictieve exports
```
