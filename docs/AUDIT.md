# AUDIT — Café

Stand: Commit `2f153e0`, 11.09.2026. Jeder Befund verweist auf Datei:Zeile
oder auf eine Kommando-Ausgabe. Was ich nicht prüfen konnte, ist als
**nicht verifiziert** markiert.

---

## 1. Executive Summary

Das hier ist nicht die übliche Wochenend-PWA. Die Fachlogik ist ernsthaft
gebaut: 379 grüne Tests, Domänenwissen in Daten statt im Code, vier
Laufzeit-Abhängigkeiten, Lighthouse-Performance 98 auf der echten Domain.
Wer den Code liest, sieht jemanden, der weiß, was er tut.

Der Abstand zu „ernstzunehmendes Produkt" liegt woanders — und er ist
größer, als die Zahlen vermuten lassen. Die App hat **keine einzige
Fehlerbehandlung, die beim Nutzer ankommt**. Kein ErrorBoundary, kein
Monitoring, keine Versionsnummer, und der gebaute Update-Hinweis wird nie
gerendert (`system.tsx:193`, nirgends eingebunden). Schlimmer: Wenn das
Laden der Datenbank einmal fehlschlägt, überschreibt die App den
Datenbestand 300 ms später mit einem leeren (`store/index.ts:96–111`).
Bei einer App ohne Server ist das nicht ein Bug unter vielen — das ist
der Totalverlust.

Dazu kommt ein Barrierefreiheitsproblem, das kein Detail ist: Vier von
sieben Textfarben liegen in der hellen Palette unter WCAG AA, und
`maximum-scale=1.0` in `index.html:11` verbietet das Zoomen. Das kostet
10 Lighthouse-Punkte und schließt Leute aus.

Kurz: gebautes Handwerk auf Produktniveau, Betriebsverhalten auf
Prototypniveau.

---

## 2. Die fünf größten Hebel

1. **Datenverlust unmöglich machen.** Der Überschreib-Pfad nach einem
   fehlgeschlagenen Laden ist die einzige Stelle, die einen Nutzer
   endgültig verliert. (F-01, F-02)
2. **Fehler sichtbar machen.** ErrorBoundary + ein Ort, an dem ein
   Schreibfehler auftaucht. Ohne das merkt niemand etwas — auch du nicht.
   (F-03, F-04)
3. **Kontraste und Zoom.** Vier Farbtoken unter AA, Zoom gesperrt. Beides
   ist in einer Stunde behoben und hebt Accessibility von 86 auf ~100.
   (F-05, F-06)
4. **Die zwei 1300-Zeilen-Dateien zerlegen.** Sie sind zugleich die
   Hotspots der Historie — jede Änderung passiert dort. (F-09)
5. **Eine Schriftskala.** 17 verschiedene Pixelgrößen als
   Tailwind-Einzelwerte sind der sichtbarste Grund, warum es „selbstgebaut"
   wirkt. (F-11)

---

## 3. Befunde

| ID | Dimension | Befund | Beleg | Schwere | Aufwand | Wirkung | Empfehlung |
| -- | --------- | ------ | ----- | ------- | ------- | ------- | ---------- |
| F-01 | Code | **Fehlgeschlagenes Laden überschreibt echte Daten.** `loadState()` fängt jeden Fehler und gibt `emptyState()` zurück. `hydrate()` prüft dann `grinders.length === 0` — bei `emptyState` immer wahr — und ruft `saveState(s)`. 300 ms später überschreibt `flush()` den echten Blob mit dem leeren. | `store/persist.ts:44–52`, `store/index.ts:96–111`, `domain/index.ts:174–186` (`grinders: []`) | **P0** | S | 5 | Beim Ladefehler in einen expliziten Fehlerzustand gehen und **nicht** schreiben |
| F-02 | Code | **Schreibfehler bleibt unsichtbar.** `flush()` fängt den Fehler und schreibt nur in die Konsole. Quota voll, privater Modus, defekte DB — die App tut so, als sei gespeichert. | `store/persist.ts:69–74` | **P0** | S | 5 | Fehler in den Store hochreichen und als anhaltende Warnleiste zeigen |
| F-03 | Code | **Kein ErrorBoundary.** Ein Renderfehler entlädt den Baum → weiße Seite. In der Standalone-PWA gibt es keine Adresszeile und keinen Neu-laden-Knopf. | `grep -rn "ErrorBoundary" src` → keine Treffer | **P0** | S | 5 | ErrorBoundary um `<App/>` mit Neustart- und Sicherungs-Knopf |
| F-04 | Reife | **Kein Fehler-Monitoring, keine Versionsnummer.** Du erfährst von keinem Absturz, und der Nutzer kann nicht sagen, welche Version er hat. | `find -iname "*sentry*"` → leer; `grep -rn "version" src/screens src/components` → leer | P1 | S | 4 | Version aus `package.json` ins Setup; Monitoring erst, wenn die App fremde Nutzer hat |
| F-05 | Design/A11y | **Vier Textfarben unter WCAG AA.** Hell: `--c-mute` 4,27 · `--c-faint` 4,26 · `--c-ok` 4,39 · `--c-warn` 4,34 auf `paper`; auf `raised` alle unter 4,0. Dunkel: `--c-faint` 3,54/3,24/2,87. | Kontrastmatrix (Kommando-Ausgabe unten §6.2); Lighthouse `color-contrast` nennt `#8a6f58` und `#807263` | P1 | S | 4 | Vier Tokens nachziehen; `--c-faint` wird bei 10–12 px benutzt und ist der schlimmste Fall |
| F-06 | A11y | **Zoom gesperrt.** `maximum-scale=1.0` verhindert Vergrößern. Lighthouse zieht dafür 10 von 100 Punkten ab. | `index.html:9–12`; Lighthouse-Audit `[user-scalable="no"]`, Gewicht 10 | P1 | S | 4 | `maximum-scale` streichen; gegen iOS-Auto-Zoom hilft `font-size: 16px` auf Eingabefeldern (steht schon in `index.css`) |
| F-07 | PWA | **Der Update-Hinweis ist toter Code.** `UpdateToast` ist gebaut und exportiert, wird aber nirgends gerendert. Bei `registerType: 'autoUpdate'` tauscht der Service Worker still aus. | `components/system.tsx:193–209`; `grep -rn "UpdateToast" src` → nur die Definition | P1 | S | 4 | In `App.tsx` einhängen — oder löschen und ehrlich sein |
| F-08 | Funktion | **Import ohne Sicherheitsnetz.** `replaceState` ersetzt den gesamten Zustand. Ob davor gewarnt oder gesichert wird, ist **nicht verifiziert** (`SetupScreen.tsx:516–525` nur überflogen). | `store/index.ts:288`, `SetupScreen.tsx:516–525` | P1 | S | 4 | Vor dem Import automatisch eine Sicherung des alten Zustands anbieten |
| F-09 | Code | **Zwei Dateien über 1200 Zeilen**, zugleich die Änderungs-Hotspots. `BeansScreen.tsx` 1429 (Liste + Profil + zwei Formulare + Kartenlegende), `BrewScreen.tsx` 1296 (fünf Phasen). | `wc -l`-Ausgabe §6.1; `git log --name-only`: 19 bzw. 11 Änderungen | P2 | L | 4 | Je Datei die klar abtrennbaren Teile herauslösen (Profil, Formulare; Phasen) |
| F-10 | Code | **Kein Linter, kein Formatter.** Keine `.eslintrc`, keine `.prettierrc`, keine `biome.json`. Die CI baut und testet, prüft aber keinen Stil. | `ls -a \| grep -i "eslint\|prettier\|biome"` → leer; `.github/workflows/deploy.yml` einziger Workflow | P2 | S | 3 | ESLint mit `react-hooks` — der fängt genau die Fehlerklasse, die diese App schon zweimal hatte (Endlosschleifen durch Selektoren) |
| F-11 | Design | **17 verschiedene Schriftgrößen**, alle als Einzelwerte `text-[NNpx]`, keine Skala. Häufigkeiten: 13px (61×), 12px (43×), 14px (32×), 15px (29px), dann ein langer Schwanz mit je 1–5 Vorkommen (10, 16, 19, 20, 22, 23, 26, 28, 29, 30, 34). | `grep -roh "text-\[[0-9]*px\]"` §6.3 | P2 | M | 4 | Auf 6–7 Stufen als Tokens reduzieren; der Schwanz ist reiner Zufall |
| F-12 | Code | **1 CVE (high) über eine Build-Abhängigkeit.** `fast-uri` über `vite-plugin-pwa → workbox-build → ajv`. Läuft nur im Build, nicht im Browser. | `npm audit`; `npm ls fast-uri` | P2 | S | 2 | `npm audit fix` mitnehmen; Risiko für diese App gering, aber es steht im Report |
| F-13 | Funktion | **Barista Express als Hauptmühle zeigt falsche Werte.** Das Setup rechnet Mahlgrade für alle fünf Methoden, obwohl `data/grinders.json` sie auf `["espresso"]` beschränkt. Der Brühbildschirm respektiert die Beschränkung, das Setup nicht. | `SetupScreen.tsx:119–128` (`METHODS.map` ohne Filter) vs. `BrewScreen.tsx:134` (`grindersForMethod`); Auswahlfeld warnt nur per Text (`SetupScreen.tsx:352`) | P2 | S | 3 | Im Setup dieselbe Filterung anwenden |
| F-14 | Code | **Keine Tests für Komponenten oder Bildschirme.** 379 Tests, alle in `engine/`, `kb/`, `store/`, `router`. Die gesamte Oberfläche ist ungetestet. | `ls src/components/*.test.*` → keine Treffer | P2 | M | 3 | Nicht alles testen — aber den Kernpfad „Bohne anlegen → brühen → protokollieren" |
| F-15 | Funktion | **Keine Suche im Regal.** Ab etwa 15 Bohnen wird die Liste unbedienbar; es gibt nur Filter nach Aufbereitung und Eignung. | `grep -rn "Suche\|search" BeansScreen.tsx` → leer | P2 | S | 3 | Textsuche in die vorhandene Filterzeile |
| F-16 | Reife | **Kein CHANGELOG, kein Impressum, keine Datenschutzerklärung.** | `ls CHANGELOG.md` → existiert nicht; `grep -rln "Impressum\|Datenschutz"` → leer | P2 | S | 2 | Für privat egal, für den Store Pflicht — siehe offene Frage O-1 |
| F-17 | Code | **`drinks.json` (15,7 KB) wird nirgends importiert.** Liegt tot im Repository. Nicht im Bundle (Vite bündelt nur Importiertes). | Schleife über `data/*.json` → `drinks.json → 0 Importstellen` | P3 | S | 1 | Löschen oder benutzen |
| F-18 | Code | **53× `as unknown as`.** Der Preis der Daten-im-JSON-Architektur: Jeder Zugriff auf eine Wissensdatei hebelt den Typ aus. `: any` dagegen: 0×. | `grep -rn "as unknown as" src types \| wc -l` → 53 | P3 | M | 2 | Ein generierter Typ je Datendatei (z. B. aus JSON Schema) würde alle auf einmal beseitigen |
| F-19 | A11y | **Die Wisch-Aktionen stehen dauerhaft im Textfluss.** Jede Bohnenzeile liefert „Edit / Löschen / Loslassen zum Löschen", auch ungewischt. Für Screenreader dreifaches Rauschen je Zeile. | Durchklick-Protokoll `#/coffee` (§6.4); `SwipeReveal.tsx` rendert Aktionen und Hinweis immer | P3 | S | 2 | Hinweis `aria-hidden`, Aktionen behalten (sie sind der Tastaturweg) |

---

## 4. Quick Wins (Wirkung hoch, Aufwand S)

| ID | Was | Warum jetzt |
| -- | --- | ----------- |
| F-01 | Beim Ladefehler nicht schreiben | Verhindert den einzigen Totalverlust-Pfad. Zwei Zeilen. |
| F-03 | ErrorBoundary um `<App/>` | Verwandelt die weiße Seite in einen Bildschirm mit Ausweg. |
| F-06 | `maximum-scale=1.0` streichen | +10 Lighthouse-Accessibility, ein Attribut. |
| F-05 | Vier Farbtoken nachziehen | +7 Lighthouse-Accessibility, vier Hexwerte. |
| F-07 | `UpdateToast` einhängen | Der Code existiert bereits vollständig. |
| F-12 | `npm audit fix` | Ein Kommando. |
| F-17 | `drinks.json` löschen | Ein Kommando. |

---

## 5. Was schon gut ist

Ernst gemeint, und für eine Solo-PWA ungewöhnlich:

**Die Daten-statt-Code-Entscheidung wird tatsächlich durchgehalten.**
`src/kb/index.ts` ist der einzige Ort, der `data/*.json` liest — das ist
in 946 Zeilen konsequent geblieben. Deshalb sind fachliche Änderungen
Datenänderungen, und deshalb lassen sich 379 Tests auf Fachaussagen
schreiben statt auf Implementierungsdetails.

**Vier Laufzeit-Abhängigkeiten.** React, ReactDOM, Zustand, idb. Kein
Router (50 eigene Zeilen), kein Datums-Paket, kein UI-Kit. Das ist keine
Sparsamkeit um ihrer selbst willen: Es ist der Grund, warum 164 KB
gzipped für eine App dieser fachlichen Tiefe überhaupt möglich sind.

**Die Tests prüfen Aussagen, nicht Zeilen.** „Nennt in keiner Begründung
eine fremde Methode", „die lange Form ist die kurze mit der Zahl davor" —
solche Tests überleben Refactorings und fangen genau die Fehler, die
diese App wirklich hatte.

**Leerzustände sind durchgehend vorhanden** und haben eine Handlung,
nicht nur einen Satz. Vier geprüfte Bildschirme, vier Ausgänge.

**Die Kommentare erklären Entscheidungen, nicht Code.** In sechs Monaten
wirst du wissen, warum der Datenbankname `dialed` heißt und nicht `cafe`
(`persist.ts:24–27`). Das ist selten.

**Lighthouse Best Practices 100, SEO 100, Performance 98** auf der echten
Domain, ohne dass dafür optimiert wurde.

---

## 6. Belege (Kommando-Ausgaben)

### 6.1 Lighthouse-Baseline

Zwei Läufe, weil der erste irreführend war.

**Gegen den Dev-Server** (`http://localhost:5173`, Vite transpiliert zur
Laufzeit) — **nicht als Baseline verwendbar**:

```
Performance 55 · Accessibility 86 · Best Practices 100 · SEO 91
FCP 17.2 s · LCP 32.7 s
```

**Gegen die echte Auslieferung** (`https://cafe.garciahub.de/`,
LH 12.8.2, mobile, simuliertes Throttling) — **das ist die Baseline**,
gespeichert in `docs/lighthouse-before.json`:

```
Performance      98
Accessibility    86
Best Practices  100
SEO             100

First Contentful Paint     1.9 s
Largest Contentful Paint   1.9 s
Total Blocking Time          0 ms
Cumulative Layout Shift      0
Speed Index                2.1 s
```

Durchgefallene gewichtete Audits: FCP, LCP, Speed Index (Performance —
alle knapp), `color-contrast` (Gewicht 7), `[user-scalable="no"]`
(Gewicht 10).

**Hinweis:** Lighthouse 12 hat die PWA-Kategorie entfernt. Eine
Installierbarkeits-Punktzahl gibt es nicht mehr; Manifest, Service Worker
und maskable Icon sind vorhanden und geprüft (§6.5).

### 6.2 Kontrastmatrix (selbst gerechnet aus `src/index.css`)

```
=== HELL ===                paper      card    raised
--c-ink                     10.19     10.97      9.20
--c-mute                     4.27!     4.60      3.85!
--c-faint                    4.26!     4.59      3.85!
--c-crema                    5.31      5.72      4.80
--c-ok                       4.39!     4.73      3.97!
--c-warn                     4.34!     4.68      3.92!
--c-bad                      5.65      6.09      5.10

=== DUNKEL ===              paper      card    raised
--c-faint                    3.54!     3.24!     2.87!
--c-bad                      5.27      4.83      4.27!
(übrige Tokens ≥ 4.8)
! = unter 4,5:1
```

### 6.3 Design-Zählungen

```
Hexwerte gesamt:                     65
davon in index.css (Tokens):         46
davon hart im Code:                  22  → 19 in GrinderDial/SageGrindDial
                                          (Gerätedarstellungen, bewusst),
                                          2 in einem Kommentar, 1 in einem Test
Schriftgrößen (text-[Npx]):          17 verschiedene
Radien:                               6 verschiedene (rounded-xl 17×,
                                        2xl 15×, full 14×, [20px] 2×,
                                        t 1×, [3px] 1×)
Dark-Mode-Tokens:              25 hell / 25 dunkel — vollständig
```

Das Farbsystem ist also **sauber** — die harten Werte sitzen dort, wo
echte Geräte abgebildet werden, und sind keine Palettenlecks. Der
Schriftgrößen-Wildwuchs ist der eigentliche Befund.

### 6.4 Funktionaler Durchlauf

Sieben Routen im Vorschau-Browser bei 375×812, einmal mit vier Bohnen und
drei Protokollen, einmal mit geleertem Speicher. Protokoll der sichtbaren
Texte liegt im Sitzungsverlauf; die vier Zustände je Bildschirm:

| Bildschirm | Leer | Lädt | Fehler | Voll |
| ---------- | ---- | ---- | ------ | ---- |
| Coffee | ✓ mit Handlung | ✓ global (`App.tsx:86`) | **fehlt** | ✓ |
| Brew (Katalog) | entfällt | entfällt | **fehlt** | ✓ |
| Brew (Bohnenwahl) | ✓ mit Handlung | entfällt | **fehlt** | ✓ |
| Brew (Durchgang) | entfällt | entfällt | **fehlt** | ✓ |
| Profil | Bohne weg → zurück zur Liste | ✓ Karte lazy (`BeansScreen.tsx:751`) | **fehlt** | ✓ |
| Log | ✓ mit Handlung | entfällt | **fehlt** | ✓ |
| Setup | entfällt | entfällt | **fehlt** | ✓ |

Der Fehlerzustand fehlt überall — das ist F-03.

### 6.5 PWA

```
manifest.webmanifest: name, short_name, description, lang, scope,
  start_url, display=standalone, orientation=portrait,
  theme_color, background_color, 3 Icons (192, 512, 512 maskable)
  → FEHLT: id, categories
Service Worker: dist/sw.js + workbox, registerType autoUpdate
Icons: 192/512/maskable-512/apple-touch/favicon.svg — vollständig
iOS: viewport-fit=cover, apple-mobile-web-app-capable,
  status-bar-style black-translucent, apple-touch-icon ✓
```

### 6.6 Bundle

```
index.js   512.77 kB │ gzip: 163.95 kB
index.css   33.88 kB │ gzip:   6.77 kB
OriginMap  104.59 kB │ gzip:  37.91 kB  (lazy, aber precached)
```

---

## 7. Was ein Nutzer nach 30 Sekunden denkt

> Okay, hübsch. Warmes Braun, keine Neon-Kacheln, nicht das übliche
> Bootstrap-Grau. Sieht aus, als hätte da jemand nachgedacht.
>
> „Noch keine Bohne." Gut, ich trag mal was ein. — Moment. Röstdatum,
> Höhe in Metern, Aufbereitung, Varietät, Agtron? Ich hab einen Beutel
> vom Supermarkt. Da steht „Arabica" drauf. Was jetzt?
>
> Ich klick mal auf Brew. Fünf Methoden mit schönen kleinen Zeichnungen.
> Chemex, Kalita, Mokkakanne — „noch nicht eingemessen". Warum stehen die
> dann da? Ach, unten steht's erklärt. Ehrlich immerhin.
>
> V60. „Für eine Empfehlung braucht ich mindestens eine Bohne im Regal."
> Also doch erst das Formular. Na gut.
>
> Jetzt hab ich eine Zahl: 18 g, 2:57, 288 g. Und darunter irgendwas mit
> Agtron und einer Weltkarte. Ich wollte eigentlich nur wissen, wie fein
> ich mahlen soll. — Ah, da: 5,2. Und das Rad sieht aus wie meine Mühle.
> Okay, das ist tatsächlich cool.
>
> Wo kommen meine Daten hin? Steht nirgends. Was, wenn ich das Handy
> wechsle? Steht auch nirgends. Welche Version ist das überhaupt?
>
> Wer hat das gebaut? Kein Impressum, keine Kontaktmöglichkeit. Wenn das
> hier meine Daten frisst, kann ich niemandem schreiben.

Der harte Teil daran: Die App ist fachlich besser als 95 % dessen, was im
Store steht — und kommuniziert es in den ersten 30 Sekunden nicht.

---

## 8. Woran man sieht, dass das jemand nebenbei gebaut hat

Nicht am Code. An dem, was **um** den Code herum fehlt.

**Kein Linter, kein Formatter** (`ls -a | grep eslint` → leer). Bei
17.753 Zeilen ist das keine Stilfrage mehr. Ein Team hätte das am ersten
Tag aufgesetzt, weil sonst niemand den Diff des anderen lesen kann.

**Die CI baut und testet, aber prüft nichts.** `.github/workflows/`
enthält genau eine Datei, und die heißt `deploy.yml`. Es gibt keinen
Lauf, der einen kaputten Zustand verhindert, bevor er live geht.

**Kein CHANGELOG** (`ls CHANGELOG.md` → existiert nicht), während die
Commit-Nachrichten fünfzig Zeilen lang und sorgfältig geschrieben sind.
Die Sorgfalt geht ins Erzählen, nicht ins Festhalten — ein typisches
Zeichen für „einer arbeitet allein und weiß ja, was er getan hat".

**Toter Code, der aussieht wie ein Feature.** `UpdateToast` ist fertig
gebaut, kommentiert und exportiert — und wird nirgends gerendert. Das
passiert, wenn niemand den eigenen Diff nochmal von außen anschaut.

**Zwei Dateien mit 1429 und 1296 Zeilen**, beide zugleich die
Hotspots der Historie. Niemand plant das. Das wächst, wenn man „schnell
noch das eine dazu" macht und es nie jemanden gibt, den der Diff stört.

**17 Schriftgrößen als Einzelwerte** (`text-[13px]` 61×, `text-[26px]`
1×, `text-[23px]` 1×). Ein Designsystem hätte sechs Stufen. Der lange
Schwanz mit je einem Vorkommen sind Entscheidungen, die im Moment des
Bauens getroffen und nie zusammengeführt wurden.

**Und der verräterischste:** 379 Tests für die Engine, null für die
Oberfläche. Getestet wurde, was Spaß macht und was prüfbar ist — nicht
das, was kaputtgeht. Der Datenverlust-Pfad aus F-01 hätte in einem Test
über `hydrate()` sofort wehgetan.

---

## 9. Offene Fragen

| ID | Frage | Warum sie den Plan ändert |
| -- | ----- | ------------------------- |
| O-1 | **Bleibt die App privat, oder soll sie in den Store?** Du hast zur Mylo gesagt „erstmal privat". Für privat sind F-16 (Impressum, Datenschutz) und F-04 (Monitoring) irrelevant. Für den Store sind sie Pflicht und Woche 4 ist real. | Entscheidet, ob die Roadmap drei oder vier Wochen hat |
| O-2 | **Wie viele Bohnen hast du gleichzeitig im Regal?** F-15 (Suche) ist bei fünf Bohnen sinnlos und bei zwanzig dringend. | Priorität von F-15 |
| O-3 | **Nutzt du die App auf mehr als einem Gerät?** Es gibt keine Synchronisation. Wenn ja, ist der Export/Import-Weg dein einziger Umzugspfad — und F-08 wird P0 statt P1. | Priorität von F-08 |
| O-4 | **Darf ich `drinks.json` löschen** (F-17), oder war da etwas geplant? | Ein Kommando oder ein Arbeitspaket |
| O-5 | **Soll ich einen Linter einführen?** Das ist streng genommen eine neue Abhängigkeit (ESLint + Plugins, nur dev). Ich frage, wie vereinbart. | F-10 |

---

## 10. Was ich nicht geprüft habe

- `SetupScreen.tsx` nur überflogen — der Import-Pfad (F-08) ist deshalb
  als **nicht verifiziert** markiert.
- `scripts/*.sh` nicht gelesen.
- `.github/workflows/deploy.yml` nur dem Namen nach.
- Kein echtes Gerät: Alle Aussagen zum iPhone stammen aus dem
  Vorschau-Browser mit 375×812, nicht aus einer installierten PWA.
- Offline-Verhalten nicht im DevTools-Offline-Modus getestet.
- Keine Messung des Bundles nach Modulen (`vite-bundle-visualizer` würde
  eine neue Abhängigkeit bedeuten — ich frage vorher).
