# Logo-Briefing: Brew Buddy

## 1. Worum es geht

**Brew Buddy** (Projektname „Barista") ist ein persönliches Dial-in-Werkzeug für Espresso, V60,
AeroPress, French Press und die Filterkaffeemaschine. Es läuft als Web-App auf dem iPhone,
vollständig offline, ohne Konto, ohne Cloud und ohne Tracking. Es gibt keine Kunden, keinen
App Store und kein Marketing. Das Logo muss niemanden überzeugen. Es soll dem einen Menschen,
der die App jeden Morgen vor der Mühle öffnet, zeigen: *Das ist mein Werkzeug.*

Leitsatz der App: **„Brew Buddy — dein Dial-in."**

Und der Satz, der sie von allen anderen unterscheidet: *Nicht noch eine Rezeptdatenbank.
Brew Buddy lernt, wie du brühst und was dir schmeckt.*

## 2. Charakter der Marke

| Ist | Ist nicht |
|---|---|
| präzise, messend, handwerklich | Labor, Technik-Dashboard, Messgerät-Optik |
| ruhig, warm, in Kaffeetönen | bunt, verspielt, Coffeeshop-Kette |
| ehrlich, zurückhaltend, begründet | laut, werblich, „Premium", Luxus |
| persönlich: *meine* Shots, *meine* Bohne | Community, Social, Rezeptportal |
| ein Werkzeug, das man in die Hand nimmt | Lifestyle-Marke, Café-Romantik |

Der wichtigste Grundsatz der App lautet **„Nie mehr als eine Empfehlung."** Sie sagt genau,
was zu ändern ist und wie stark (*„3 Klicks gröber, erwartete Zeit danach 28–29 s"*), und sie
hält den Mund, wenn Raten schädlich wäre. Das Logo darf diese Haltung tragen: ein Zeichen,
eine Aussage, nichts dazu. Keine Effekte, keine Show.

## 3. Die bestehende Gestaltung, an die das Logo anschließen muss

### Drei Darstellungen: Milchkaffee, Espresso, Organic

Die App hat drei gleichberechtigte Darstellungen, die man in den Einstellungen wählt. Alle
Farben stammen aus dem Kaffee selbst: Ausgangspunkte sind **Pantone 476 C** (Espressobraun,
`#4e3629`) und **Pantone 7401 C** (Creme, `#f5e1a4`).

| Rolle | Hell „Milchkaffee" (Standard) | Dunkel „Espresso" | „Organic" |
|---|---|---|---|
| Papier (Grund) | `#faf4ea` Milchschaum | `#1c1512` Espresso in der Tasse | `#f5ead8` |
| Karte | `#fffdf9` Porzellan | `#261d18` Röstbohne | `#f9f4ed` |
| Erhöhte Fläche | `#f3e8d6` Beige | `#33261f` feuchter Puck | `#ebddc5` |
| Tinte (Text) | `#4e3629` Pantone 476 C | `#f7efe3` Creme | `#201e1d` |
| **Akzent** („Crema") | `#8c5a2b` geröstetes Braun | `#d9a566` Crema | `#b2622d` Terracotta (nur Fläche/Icon) |
| Akzent als Text | `#8c5a2b` | `#d9a566` | `#8c491a` |
| Akzent gedämpft | `#d9b98c` | `#8a6338` | `#f6a06b` |
| Grün („im Fenster") | `#556f40` Kaffeeblatt | `#8fb36b` | `#56633f` Salbei |

Wichtig dabei:

- **Dunkel ist mitgedacht, nicht nachgereicht.** Gebrüht wird morgens in dunklen Küchen. Das
  Logo muss auf `#1c1512` mindestens so gut aussehen wie auf Milchschaum.
- **Das App-Icon kennt die gewählte Darstellung nicht.** Es gibt ein Icon für alle drei. Es
  muss deshalb neben Milchkaffee, Espresso *und* Terracotta glaubwürdig sein.
- **Jede Farbe hält WCAG AA.** Die App prüft das automatisch (`npm run kontrast`). Farben im
  Logo bitte ausschließlich aus der Tabelle oben nehmen. Terracotta `#b2622d` trägt auf Creme
  nur Flächen und Icons (3,8 : 1), keinen kleinen Text.
- **Röst- und Herkunftsfarben** (sieben Agtron-Bänder, fünf Herkunftstöne) sind Daten, keine
  Dekoration. Sie gehören nicht ins Logo.

### Schrift

- **Hell und Dunkel:** Systemschrift (-apple-system, SF Pro, Segoe UI) für alles. Überschriften
  stehen in derselben Familie, nur schwerer: Gewicht 600, Laufweite −0,02 em.
- **Organic:** **Caprasimo** (nur 400, weich, rund, mit Charakter) für Überschriften,
  **Figtree** für den Rest. Beide liegen selbst gehostet in `public/fonts/`.

### Die heutige Wortmarke

Es gibt **noch keine**. Der Name „Brew Buddy" steht nur als Titel unter dem Icon auf dem
Home-Bildschirm und im Einstellungsfuß. In der App zeigt der Kopf den jeweiligen Bildschirm
(„Heute", „Regal", „Logbuch"), nicht den Namen.

Das neue Logo darf die Wortmarke deshalb **neu setzen**. Rahmenbedingungen:

- Der Name ist **„Brew Buddy"**, zwei Wörter, englisch. Die doppelten Anfangsbuchstaben
  „B … B" und das doppelte „dd" geben dem Wort einen Rhythmus, den die Wortmarke aufnehmen darf.
  „Buddy" steht für den Begleiter an der Mühle, nicht für ein Maskottchen: Die Wortmarke soll
  freundlich wirken, aber nicht verspielt.
- Die Wortmarke muss sich **neben beide Schriftwelten** stellen können: neben die nüchterne
  Systemschrift und neben die weiche Caprasimo. Ein Vorschlag, ob sie eher der einen, der
  anderen oder keiner von beiden folgt, ist ausdrücklich erwünscht.
- „Barista" ist der Name des Repositorys, nicht der App. Er erscheint nicht im Logo.

### Icon- und Illustrationsstil

Die App hat eine eigene Familie von Strichzeichnungen, je eine pro Brühmethode: Siebträger,
V60, Kalita, Chemex, AeroPress, French Press und weitere. Die Regeln dafür sind festgelegt:

- **24er Raster**, Strichstärke **1,8**, runde Enden und Ecken, **keine Füllung**,
  `currentColor`
- Nebenlinien (Rippen, Siebkante) feiner: 1,2 bei 65 % Deckkraft
- jedes Gerät auf **das eine Merkmal** zugespitzt, das es unterscheidet (V60: Rippen und
  Spitze; Chemex: Sanduhr mit Manschette)
- **keine Emoji**. Die Designregel der App verbietet sie, weil sie auf jedem Gerät anders
  aussehen und keine Strichstärke haben.

Daneben gibt es zwei nachgebaute Mahlgradräder (der Verstellring der Mylo SG2 mit Skala,
Feinstrichen und festem Index-Dreieck; der Ring der Sage-Mühle) und Skalengrafiken für Röstgrad
und Aufbereitung.

Ein Bildzeichen, das aus derselben Hand zu stammen scheint wie die Methoden-Icons, fügt sich
am besten ein.

### Das heutige App-Icon

Das Icon ist ein Platzhalter aus dem ersten Tag, und genau so sieht es auch aus: ein Ring mit
Kern und vier Marken, gedacht als abstrahierter Verstellring der Mühle, in Creme `#f5e1a4` auf
Espressobraun `#4e3629`, gezeichnet aus Kreisen und Linien (`public/favicon.svg`,
`scripts/make-icons.mjs`). Die Idee „Mahlring" ist brauchbar. Die Umsetzung ist zu generisch
und wirkt eher wie ein Zielkreuz als wie Kaffee. Das Icon darf ersetzt werden, die Idee darf
als eine der Richtungen weiterleben.

### Allgemeiner Look

Ruhig und dicht, auf 375 px Breite gedacht. In Hell und Dunkel gibt es Karten mit 16 px Radius,
feine Sandkanten statt Schatten und keinerlei Verläufe. In Organic sind die Karten stärker
gerundet (24 px), Schaltflächen sind Pillen und der Primärknopf trägt einen weichen, warmen
Schatten. Zahlen stehen groß und in Tabellenziffern, weil man sie aus einem Meter Entfernung
von der Mühle aus liest.

## 4. Mögliche Motive als Anregung, keine Vorgabe

- **Der Mahlring:** Skala, Feinstriche und das feste Index-Dreieck. Das ist der Ort, an dem die
  App wirkt. Jede Empfehlung endet als „so viele Klicks". Ein einziger Strich oder ein Dreieck
  kann reichen.
- **Das „B" aus zwei Bögen:** Die beiden Bäuche des „B" können als zwei Kreise gelesen
  werden: Tasse von oben und Mahlring, oder zwei Tassen nebeneinander (der „Buddy"). Ein
  Einschnitt könnte zur Index-Marke werden.
- **Die Tasse von oben:** Crema-Rand, Espressokern, zwei Töne aus der Palette (Crema auf
  Espresso). Das ist ruhiger und eigener als die Tasse von der Seite.
- **Der eine Tropfen:** der erste Tropfen aus dem Siebträger oder aus der V60-Spitze. Er steht
  für „eine Empfehlung, eine Änderung".
- **Siebträger oder V60** als Silhouette im Stil der Methoden-Icons. Nur dann, wenn das Zeichen
  keine Methode bevorzugt, denn die App ist für alle da.

Bitte **vermeiden**: dampfende Tasse von der Seite mit Kringeln, Latte-Art-Herz, die generische
Kaffeebohne mit Kerbe als alleiniges Motiv, Coffeeshop- und Kettenanmutung (Kreisbadge mit
Schriftzug, Schürze, Kaffeemühle als Nostalgie-Stich), Diagramme und Kurven, KI-Funken, Emoji,
Farbverläufe, Glanz, 3D und Maskottchen. Auch kein Zielkreuz: Die App gibt keinen perfekten
Shot vor.

## 5. Anforderungen an die Technik

Das Bildzeichen muss **bei 16 × 16 px als Favicon noch erkennbar** sein. Das ist die härteste
Prüfung. Die 1,8er Linie der Methoden-Icons trägt bei dieser Größe nicht. Für kleine Größen ist
deshalb eine vereinfachte, kräftigere Variante nötig.

Die zweithärteste Prüfung ist der **iPhone-Home-Bildschirm**. Dort lebt die App fast
ausschließlich, zwischen den Icons großer Marken, mit dem Titel „Brew Buddy" darunter. Der Titel ist
mit zehn Zeichen samt Leerzeichen lang; ob iOS ihn ungekürzt zeigt, bitte am Gerät prüfen.

Gewünschte Varianten:

1. **Bildzeichen** allein, quadratisch
2. **Wortmarke** „Brew Buddy"
3. **Kombination** aus Bildzeichen und Wortmarke, waagerecht
4. je in **Farbe**, **einfarbig Tinte** (`#4e3629`) und **einfarbig hell** (`#f7efe3`, für
   den Espresso-Grund)
5. **App-Icon-Fassung:** Bildzeichen auf vollflächigem Grund (Espresso, Milchschaum oder
   Crema) mit Sicherheitsabstand. Das Icon wird zugeschnitten: bei iOS auf ein abgerundetes
   Quadrat, bei Android kreisförmig („maskable").

Dateien, die die App braucht (Vite mit `vite-plugin-pwa`, alles in `public/`):

| Datei | Größe | Zweck |
|---|---|---|
| `favicon.svg` | Vektor | Favicon für moderne Browser, idealerweise mit `prefers-color-scheme` für den Dunkelmodus |
| `apple-touch-icon.png` | 180 × 180 px | Home-Bildschirm auf dem iPhone, ohne Transparenz |
| `icon-192.png`, `icon-512.png` | 192 / 512 px | Web-App-Manifest |
| `icon-maskable-512.png` | 512 px | Android, Motiv innerhalb der inneren 80 % |
| Wortmarke / Kombination | SVG | Einstellungsfuß, Installationshinweis, Sicherungsdatei |

Das SVG soll sauber sein: keine eingebetteten Bilder, Farben möglichst als `currentColor` oder
als klar benannte Werte aus der obigen Palette. Schrift in der Wortmarke bitte in Pfade
umwandeln, denn weder SF Pro noch Caprasimo sind überall verfügbar.

Zwei Besonderheiten dieses Projekts:

- Die App muss **offline** laufen. Alles, was das Logo braucht, liegt im eigenen Ursprung. Es
  gibt keine Webfonts vom CDN und keine externen Grafiken.
- Die PNG-Icons entstehen heute mit einem eigenen Skript ohne Grafikwerkzeuge
  (`npm run icons`), weil auf dem Rechner weder ImageMagick noch rsvg-convert installiert ist.
  Entweder werden die PNGs fertig mitgeliefert, oder das Bildzeichen bleibt so geometrisch
  (Kreise, Bögen, gerade Linien), dass das Skript es zeichnen kann. Beides ist in Ordnung, bitte
  aber sagen, welcher Weg gemeint ist.

## 6. Was ich von dir erwarte

1. **Drei unterschiedliche Richtungen** für das Bildzeichen, jede mit einem Satz zur Idee.
2. Jede Richtung gezeigt als Favicon in 16 px und 32 px, als App-Icon auf dem
   iPhone-Home-Bildschirm und zusammen mit der Wortmarke, und zwar auf Milchkaffee, auf
   Espresso und auf Organic.
3. Nach meiner Auswahl: Ausarbeitung einer Richtung mit allen Varianten und Dateien aus
   Abschnitt 5.

## 7. Kurzfassung

> Ein ruhiges, präzises Zeichen für ein persönliches Kaffee-Werkzeug, das offline auf dem
> iPhone lebt. Kaffeetöne (Espressobraun Pantone 476 C, Creme 7401 C, Crema, Terracotta), ein
> Strich im Stil der hauseigenen Methoden-Icons, eine neue Wortmarke „Brew Buddy", freundlich,
> aber nicht verspielt. Die Bedeutung ist *dein Dial-in*, nicht Coffeeshop und nicht Labor. Das
> Zeichen muss als 16-px-Favicon und als App-Icon funktionieren, auf Milchkaffee, Espresso und
> Organic.
