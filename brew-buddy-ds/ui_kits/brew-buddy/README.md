# UI-Kit: Brew Buddy (iPhone-PWA)

Klickbarer Nachbau der Hauptbildschirme, zusammengesetzt aus `components/`.

- **Brühen** (`HeuteScreen.jsx`) — Methodenreihe im angehefteten Kopf, Bohnenliste nach Eignung, schwebender Brüh-Knopf. Quelle: `src/screens/HeuteScreen.tsx`.
- **Regal** (`RegalScreen.jsx`) — Bohnen nach Frische, einklappbarer Filter, „+ Bohne" als Blatt. Quelle: `src/screens/BeansScreen.tsx`.
- **Log** (`LogScreen.jsx`) — Brews mit Methodenzeichen, REFERENZ, Sternen. Quelle: `src/screens/LogScreen.tsx`.
- **Brüh-Ablauf** (`BrewScreen.jsx`) — Startpunkt (Triad, MetaRow, BrewButton) → Timer → „Wie war er?" → eine Empfehlung. Quelle: `src/screens/BrewScreen.tsx`, `brewphases.tsx`.

Oben umschaltbar: Milchkaffee · Espresso · Organic. Daten in `data.js` sind Beispiele.

**Vereinfacht:** Timer- und Ergebnisbildschirm sind nur angedeutet (die Originale enthalten Laufkontrolle, Mahlgradrad und Lernkurve, die hier nicht nachgebaut sind). Wischen zum Löschen, Glossar-Blätter und das Blatt „Neue Bohne" funktionieren.

Öffnen über einen Webserver (die Komponenten werden per `fetch` geladen).
