# Brew Buddy — Design-System

**Brew Buddy** ist ein persönliches Dial-in-Werkzeug für Espresso, V60, AeroPress, French Press und Filterkaffeemaschine. Es läuft als PWA auf dem iPhone (Zielbreite 375 pt, iPhone 12), vollständig offline, ohne Konto, ohne Cloud, ohne Tracking. Es gibt keine Kunden und kein Marketing. Die App ist für genau einen Menschen gebaut, der sie jeden Morgen vor der Mühle öffnet.

> Nicht noch eine Rezeptdatenbank. Brew Buddy lernt, wie **du** brühst und was **dir** schmeckt.

Leitsatz: **„Nie mehr als eine Empfehlung."** · Claim im Logo: **„…dialled in!"** · Tagline im Code: „Dein Dial-in, nicht irgendeins"

## Quellen

Alle Werte stammen aus dem lokalen Repository `Barista/` (Repo-Name „Barista", App-Name „Brew Buddy", Live: brewbuddy.garciahub.de):

- `src/index.css`: alle Farb-, Schrift-, Radius- und Schatten-Tokens, drei Themen
- `src/components/ui.tsx`, `system.tsx`, `methodicons.tsx`, `SwipeReveal.tsx`: Bausteine
- `src/App.tsx`: Reiterleiste und Gerüst
- `src/screens/HeuteScreen.tsx`, `BeansScreen.tsx`, `BrewScreen.tsx`, `brewphases.tsx`, `LogScreen.tsx`: Bildschirme
- `src/config.ts`: App-Name, Tagline
- `docs/06-logo-briefing.md`, `README.md`: Marke, Charakter, Nicht-Ziele
- `public/fonts/`: Figtree (variabel) und Caprasimo 400
- Logo: Entwurf **2e „Buddies im Sefed"** aus diesem Projekt (`Brew Buddy Logo.dc.html`)

## Index

```
styles.css            Einstieg, nur @import
tokens/               colors · typography · spacing · shape · fonts · base · interaction
fonts/                figtree-var.woff2, caprasimo-400.woff2
assets/logo/          Bildmarke (3 Detailstufen × 4 Farbwelten, einfarbig), Logo quer/kurz/gestapelt, Wortmarke
assets/app-icon/      App-Icon Standard/Dunkel/Getönt, favicon.svg
assets/icons/         9 Methoden-Icons, Reiter, Logbuch, Setup, Zurück
guidelines/           22 Übersichtskarten: Farben, Typografie, Abstände, Tiefe & Form, Marke
components/           31 React-Komponenten in 7 Gruppen, je .jsx + .d.ts + .prompt.md, 1 Karte je Gruppe
ui_kits/brew-buddy/   klickbarer Nachbau: Brühen, Regal, Log, Brüh-Ablauf
SKILL.md              für Claude Code
```

**Komponenten**
- `layout/`: Screen, Header, Section, Card
- `actions/`: Button, GearButton, LogButton, Chip, FilterRow, SegmentedControl
- `inputs/`: Field, TextInput, Select, Stepper, Toggle
- `display/`: Stat, Triad, MetaRow, Empty, FreshnessRing
- `overlay/`: Sheet, InfoDot
- `feedback/`: Notice, UndoBar, UpdateToast, StorageErrorBar
- `brew/`: MethodIcon, BrewButton, TabBar, SwipeReveal
- `_lib/format.js`: `num()` (deutsches Komma), `fmtClock()` (m:ss), `mix()` (Tailwind-Deckkraft)

**Bewusste Ergänzungen:** `Notice` fasst `BackupBanner` und `SetupNudge` zusammen, die im Original am Store hängen. `Sheet`, `InfoDot`, `UndoBar` & Co. haben `inline`/`floating`-Schalter für Mockups im Gerätrahmen. `Header` hat `children` für die angeheftete Methodenreihe von „Brühen". `Card` hat `selected` statt einer Klassen-Überschreibung.

**Nicht nachgebaut** (Fachgrafiken, zu speziell für Grundbausteine): GrinderDial, SageGrindDial, beanviz, geschmackspad, lernkurve, OriginMap, vorhersage, SessionLauf, getraenke.

**Vorschau:** Karten und UI-Kit laden die `.jsx` über `components/_preview/bb-loader.js` (React, ReactDOM und Babel vom CDN). Sie müssen über einen Webserver geöffnet werden.

## Textregeln

- **Deutsch, durchgehend.** Zahlen in deutscher Schreibweise: „1:2,0", „18,0 g", „93 °C". Fachbegriffe bleiben englisch, wo die Szene sie so nennt: *Dial-in, Brew, Shot, Ratio, In/Time/Out, Grind, Bag*.
- **Du-Form**, direkt und ruhig: „Trag deine erste Bohne ein — danach steht hier jeden Morgen, was dran ist."
- **Konkret statt ungefähr.** Die Empfehlung nennt Richtung *und* Stärke: „3 Klicks gröber, erwartete Zeit danach 28–29 s." Nie „etwas feiner".
- **Begründen, nicht behaupten.** Begründungen stehen mit ▸ darunter: „▸ Die Bohne ist 14 Tage älter — einen Klick feiner."
- **Ehrlich schweigen.** Wo Raten schaden würde, gibt es keine Empfehlung, sondern einen Satz, warum nicht.
- **Knöpfe sind Verben oder das Ziel:** „V60 brühen", „Auswerten", „Jetzt sichern", „Später", „Rückgängig", „Mühle wählen". Kein „OK", kein „Weiter".
- **Überschriften kurz**, oft ein Wort: „Brühen", „Regal", „Log", „Wie war er?". Abschnittstitel in Versalien: „BREWS", „FILTER".
- **Leerzustände:** ein Titel, ein Satz, eine Aktion.
- **Keine Emoji**, keine Ausrufezeichen in der Oberfläche (Ausnahme: der Claim „…dialled in!"), kein Werbeton, kein „Premium". Zeichen wie ✓ ✕ ★ ▸ · → sind als Typografie erlaubt.

## Gestaltungsregeln

**Charakter:** präzise, handwerklich, ruhig, warm, persönlich. Ein Werkzeug, keine Lifestyle-Marke. Nicht Labor, nicht Coffeeshop-Kette.

**Farbe:** Alle Farben kommen aus dem Kaffee. Ausgangspunkte sind Pantone 476 C `#4e3629` und 7401 C `#f5e1a4`. Es gibt drei gleichberechtigte Darstellungen:
- **Milchkaffee** (hell, Standard, `:root`)
- **Espresso** (dunkel, `html.dark`). Dunkel ist mitgedacht, weil morgens in dunklen Küchen gebrüht wird.
- **Organic** (`html.organic`)

Die Oberfläche liest nur `--color-*`. Jede Textfarbe hält WCAG AA (`npm run kontrast`). Terracotta `#b2622d` ist nur Fläche und Icon, Akzent als Text ist `--color-crema-ink`. Röst- und Herkunftsfarben sind Daten und keine Dekoration, kein Thema darf sie umfärben. Signalfarben `ok/warn/bad` bedeuten gut/schlecht und werden nie zur Zierde benutzt. **Keine Verläufe.**

**Typografie:** Hell und Dunkel setzen die Systemschrift (SF Pro). Überschriften stehen in derselben Familie mit 600 und −0,02 em. Organic setzt Caprasimo 400 (nie fett) für Überschriften und Figtree für den Rest. Die Klasse `.titel` schaltet das um. Die Skala hat neun Stufen von 11 bis 34 px. Zahlen stehen groß und in Tabellenziffern (`.tnum`), weil man sie aus einem Meter Entfernung liest. Eingaben haben mindestens 16 px (kein iOS-Zoom).

**Layout:** 375 px, 16 px Rand, 24 px zwischen Abschnitten, dicht aber ruhig. Jede Trefferfläche ist 44 px (mit nassen Händen bedienbar). Der Kopf ist angeheftet (58/70 px), die Reiterleiste 46 px plus gekürzte Sicherheitszone. Die Hauptaktion schwebt über der Leiste.

**Flächen & Tiefe:** Karten haben eine 1-px-Kante und 16 px Padding. In Hell und Dunkel gibt es **keine Schatten**, die Sandkante trennt. In Organic sind Karten 24 px rund, Knöpfe Pillen, und nur der Primärknopf trägt `--shadow-soft`. Blätter tragen `--shadow-float`. Kopf, Reiterleiste und Brüh-Leiste sind aus Milchglas (Papier 90–95 % plus blur 24 px). Unter Blättern liegt Schwarz 60 % mit blur 4 px.

**Zustände:** Beim Drücken wird die Fläche dunkler (`raised`/`line`, primary 85 %), antippbare Karten skalieren auf 0,99 und der Brüh-Knopf auf 0,95. Es gibt keine Hover-Effekte, weil die App auf Touch gebaut ist. Deaktiviert = 40 % Deckkraft. Der Fokusring ist 2 px Crema mit 2 px Abstand. Übergänge dauern 150 ms (Farbe/Transform), `prefers-reduced-motion` wird respektiert. Einstellbare Zahlen tragen eine gestrichelte Akzentlinie statt eines Stift-Symbols.

**Bilder:** Die App enthält keine Fotos und keine Illustrationen außer den Strichzeichnungen. Es gibt deshalb **keine Beispielfotos** in `assets/`.

## Icons

- **Eigene Strichzeichnungen**, kein Icon-Font, keine Bibliothek. Die Regeln: 24er Raster, Strich **1,8**, runde Enden und Ecken, **keine Füllung**, `currentColor`. Nebenlinien (Rippen, Siebkante) sind 1,2 bei 65 % Deckkraft.
- Jede Methode ist auf **ein Merkmal** zugespitzt (V60: Rippen und Spitze, Chemex: Sanduhr mit Manschette, Filtermaschine: Brühkopf über dem Korb).
- Die Methoden-Icons stehen in `assets/icons/methode-*.svg` und als Komponente `MethodIcon`. Die Reiter-, Logbuch-, Setup- und Zurück-Symbole liegen in `assets/icons/`.
- Größen: 22 px im Kopf, 23 px in der Reiterleiste, 24 px in Listen, 48 px im Brüh-Knopf.
- **Keine Emoji**, weil sie auf jedem Gerät anders aussehen und keine Strichstärke haben. Unicode-Zeichen ✓ ✕ ★ ▸ sind erlaubt.
- Neue Symbole werden im selben Strich gezeichnet. Wenn eine Bibliothek nötig ist, dann Lucide mit stroke-width 1.8 (gleiche Sprache). Das ist bisher nicht im Code.

## Marke

Die **Bildmarke** zeigt zwei B aus je zwei Bohnenprofilen, leicht zueinander geneigt, auf dem Sefed (ሰፌድ), dem geflochtenen Tablett der äthiopischen Kaffeezeremonie. Brew und Buddy sind zwei, die sich anlehnen.

- **Drei Farben** je Darstellung: Tablett, Geflecht, Bohnen
- **Drei Detailstufen:** ab 64 px mit Stichen, 32–64 px eine Windung, unter 32 px nur Bohnen
- **Wortmarke** in Figtree 700, −0,035 em. Das **vollständige Logo** trägt darunter „…dialled in!" (Figtree 600, Akzentfarbe). Kurzform, Wortmarke und Icon stehen ohne Claim.
- **App-Icon** in Standard (`#4e3629`), Dunkel und Getönt. Die Marke füllt 84 % des Quadrats, iOS maskiert selbst.
- **Schutzraum:** ein Zehntel des Markendurchmessers. Nicht verändern: Neigung, Bohnenform, Reihenfolge. Keine Schatten, keine Verläufe.
- Die SVG-Lockups setzen den Text als `<text>` in Figtree. Für Druck oder Fremdsysteme müssen die Schriften in Pfade gewandelt werden.
