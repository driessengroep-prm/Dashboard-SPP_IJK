# CLAUDE.md — Dashboard SPP IJK

Interne tool die de **SPP-export** (medewerker, leidinggevende, SPP-kwadrant) combineert met de **HR-export** ("Lijst FvB": bedrijf en afdeling/OE). Zelfde opzet als `driessengroep-prm/Dashboard-AI-trainingsprogramma`; zie README.md voor functionaliteit.

## Harde regels (privacy)

- SPP-scores zijn vertrouwelijke persoonsgegevens. **Nooit echte data in de repo of in een build.** Alleen `testdata/fictief/` (gegenereerd met `npm run testdata`, adressen op `.example`).
- De GitHub Pages-demo is publiek en bevat alleen fictieve data. Echte exports alleen in de lokale build (`npm run build:lokaal`, CSP zonder netwerk, alles in het geheugen).
- Geen localStorage/IndexedDB, geen netwerkverzoeken met data, geen persoonsgegevens in foutmeldingen of logs (uitzonderingenlijst alleen voor de beheerder).
- Dataminimalisatie: lees alleen de kolommen uit `src/core/parsing/spp.ts` en `hr.ts`. De kolom "Leidinggevende" van de HR-export wordt niet gelezen; de leidinggevende komt uit de SPP-export.
- Gebruik `exceljs` (niet het npm-pakket `xlsx`). Houd dependencies minimaal.

## Afspraken

- Kernlogica in `src/core/` is pure TypeScript en unit-getest; UI in `src/app/`.
- Kwadranten, labels, kleurvolgorde en matrixassen staan centraal in `src/core/config/kwadranten.ts`.
- Huisstijl IJK: Blad #50a78a, Lucht #1E0E3B, Wolk #DFE9F0, Dauw #98A8AF; secundair Water #005282, Zon #F69B37, Avondrood #D61539. Titels Riona Sans, tekst Ratio (met systeemfonts als terugval). Kleuren als tokens in `src/app/styles.css`.
- Code en commentaar in het Engels; UI-teksten, README en commitberichten in het Nederlands.
- Draai `npm test`, `npm run typecheck` en `npm run build:demo && npm run privacy-check` vóór een push.
