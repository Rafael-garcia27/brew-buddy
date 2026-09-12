# ROADMAP — Café

Grundlage: `docs/AUDIT.md`, 19 Befunde. Zugeschnitten auf die Antworten
vom 12.09.2026:

| Frage | Antwort | Folge für diesen Plan |
| ----- | ------- | --------------------- |
| O-1 | **privat**, kein Store | Woche 4 entfällt. Impressum, Datenschutz, Store-Assets, Monitoring-Dienst fallen weg (F-16, F-04 teilweise). |
| O-2 | **3–5 Bohnen** | Suche im Regal (F-15) ist gestrichen. Bei fünf Zeilen spart ein Suchfeld keine Sekunde. |
| O-3 | **ein iPhone, keine Synchronisation** | Das macht die Sicherung **wichtiger**, nicht unwichtiger: Es gibt keine zweite Kopie. F-08 bleibt P1 und bekommt ein eigenes Paket. |
| O-4 | offen | `drinks.json` bleibt liegen, siehe `IDEAS.md`. Kein Paket. |
| O-5 | offen | Paket 5 ist als **Entscheidung** formuliert, nicht als gesetzt. |

Aus vier Wochen werden damit **drei**. Zeitangaben sind für einen Solo-
Entwickler mit Vorwissen über diese Codebasis, in konzentrierter Arbeit.

---

## Wenn du nur eine Woche hast

Dann nur diese drei Pakete, in dieser Reihenfolge:

**P1 · P2 · P6.** Zusammen etwa ein Tag. Danach kann die App deine Daten
nicht mehr stillschweigend verlieren, ein Absturz endet nicht mehr in
einer weißen Seite, und die Barrierefreiheit springt von 86 auf ~100.

Alles andere ist Qualität und Wartbarkeit. Das hier ist der Unterschied
zwischen „kann mir meine Historie nehmen" und „kann es nicht".

---

## Woche 1 — Stabilisieren

> Ziel: Die App kann unter keinen Umständen stillschweigend Daten
> verlieren, und kein Fehler endet mehr unsichtbar.

### P1 — Der Datenverlust-Pfad (F-01, F-02) · **P0** · ~3 h

**Problem.** Schlägt das Laden fehl, liefert `loadState()` einen leeren
Zustand (`persist.ts:44–52`). `hydrate()` sieht `grinders.length === 0`,
hält das für einen Erststart und schreibt (`store/index.ts:96–111`).
300 ms später ist die echte Historie überschrieben. Schreibfehler
wiederum landen nur in der Konsole (`persist.ts:69–74`).

**Umfang.**
- `loadState()` unterscheidet „leer" von „kaputt" und gibt das nach außen.
- `hydrate()` schreibt nach einem Ladefehler **nicht** und setzt einen
  Fehlerzustand im Store.
- Schreibfehler erreicht den Store und wird als anhaltende Warnleiste
  gezeigt, mit dem Angebot, sofort zu sichern.
- Vorher ein Test, der den Überschreib-Pfad reproduziert.

**Risiko.** Gering, aber im empfindlichsten Modul der App. Deshalb Test
zuerst.

**Abnahme.**
```bash
npm test            # neuer Test „überschreibt nach Ladefehler nichts" grün
npm run build
```
Manuell: In den DevTools `IDBDatabase` sperren, App neu laden — es muss
eine Fehlermeldung kommen und die Daten müssen nach dem Entsperren noch
da sein.

---

### P2 — ErrorBoundary (F-03) · **P0** · ~2 h

**Problem.** Kein ErrorBoundary. Ein Renderfehler entlädt den Baum; in
der Standalone-PWA gibt es keine Adresszeile und keinen Neu-laden-Knopf.

**Umfang.** Eine Fehlergrenze um `<App/>` mit drei Dingen: verständlicher
Satz, Knopf „Neu starten", Knopf „Sicherung herunterladen" — damit man
seine Daten auch dann noch herausbekommt, wenn die Oberfläche kaputt ist.

**Risiko.** Gering. Rein additiv.

**Abnahme.**
```bash
npm run build
```
Manuell: In einer Komponente probeweise `throw new Error('test')` — es
muss der Fehlerbildschirm erscheinen, nicht Weiß. Danach zurücknehmen.

---

### P3 — Version und Update-Hinweis (F-04, F-07) · P1 · ~1,5 h

**Problem.** `UpdateToast` ist fertig gebaut und wird nirgends gerendert
(`system.tsx:193`). Der Service Worker tauscht bei `autoUpdate` still
aus. Eine Versionsnummer gibt es in der ganzen Oberfläche nicht.

**Umfang.** `UpdateToast` in `App.tsx` einhängen; Version aus
`package.json` über `import.meta.env` ins Setup, zusammen mit dem
Build-Datum.

**Risiko.** Gering.

**Abnahme.**
```bash
npm run build
grep -rn "UpdateToast" src/App.tsx     # muss treffen
```
Manuell: Setup öffnen — unten steht eine Version.

---

### P4 — Sicherung vor dem Import (F-08) · P1 · ~2 h

**Problem.** `replaceState` ersetzt den gesamten Zustand
(`store/index.ts:288`). Ob vorher gewarnt wird, ist **nicht
verifiziert** — zuerst `SetupScreen.tsx:516–525` lesen. Bei einem Gerät
ohne Synchronisation ist ein falscher Import der zweite Weg, alles zu
verlieren.

**Umfang.** Vor dem Ersetzen automatisch den bisherigen Zustand als Datei
anbieten; Bestätigungsdialog, der nennt, was ersetzt wird („4 Bohnen,
3 Protokolle werden durch 12 Bohnen, 40 Protokolle ersetzt").

**Risiko.** Gering.

**Abnahme.** Manuell: Sicherung importieren — es muss eine Rückfrage mit
konkreten Zahlen kommen.

---

### P5 — `npm audit fix` (F-12) · P2 · ~15 min

**Problem.** Ein High-CVE in `fast-uri`, gezogen über
`vite-plugin-pwa → workbox-build → ajv`. Läuft nur im Build, nie im
Browser — deshalb P2 und nicht P0.

**Abnahme.**
```bash
npm audit          # 0 high/critical
npm run build && npm test
```

---

### P6 — Kontraste und Zoom (F-05, F-06) · P1 · ~2 h

Steht bewusst in Woche 1 statt in Woche 3 („Erlebnis"): Es sind zwei
Quick Wins mit der größten messbaren Wirkung im ganzen Plan.

**Problem.** Vier Farbtoken unter WCAG AA (hell: `mute` 4,27, `faint`
4,26, `ok` 4,39, `warn` 4,34 auf `paper`; dunkel: `faint` 2,87–3,54).
`maximum-scale=1.0` in `index.html:11` sperrt das Zoomen.

**Umfang.** Vier Hexwerte in `src/index.css` nachziehen, bis alle
Kombinationen ≥ 4,5:1 liegen; `maximum-scale` streichen. Gegen den
iOS-Auto-Zoom bei Eingabefeldern ist bereits eine 16-px-Regel in
`index.css` vorhanden — die muss vorher geprüft werden.

**Risiko.** Gering, aber sichtbar: Die Palette wird an vier Stellen
minimal dunkler. Vorher/nachher-Screenshot.

**Abnahme.**
```bash
npx lighthouse https://cafe.garciahub.de/ --quiet --output json \
  --output-path ./docs/lighthouse-after-p6.json \
  --chrome-flags="--headless=new"
# Accessibility ≥ 95 (Baseline: 86)
```
Dazu die Kontrastmatrix aus `docs/AUDIT.md` §6.2 erneut rechnen: kein
`!` mehr.

---

## Woche 2 — Aufräumen

> Ziel: Der Code bleibt in sechs Monaten änderbar, ohne dass jede
> Änderung ein Risiko ist.

### P7 — Linter (F-10) · P2 · ~2 h · **Entscheidung offen**

Siehe Erklärung unten (§ „Was ist ein Linter?"). Ich setze das **nicht**
um, bevor du zustimmst — es wäre eine neue Abhängigkeit.

**Umfang bei Zustimmung.** ESLint mit `typescript-eslint` und
`eslint-plugin-react-hooks`, als Skript und als CI-Schritt.
Nur dev-Abhängigkeiten, kein Byte im Bundle.

**Abnahme.**
```bash
npm run lint       # 0 Fehler
```

---

### P8 — `BeansScreen.tsx` zerlegen (F-09) · P2 · ~4 h

**Problem.** 1429 Zeilen, zugleich Änderungs-Hotspot (11 Commits).
Enthält: Regalliste, Bohnenkarte, Profilansicht, Bohnenformular,
Tütenformular, Herkunftsauswahl.

**Umfang.** Drei Dateien statt einer: `BeansScreen.tsx` (Liste),
`BeanDetail.tsx` (Profil), `BeanForms.tsx` (die zwei Formulare).
**Keine Verhaltensänderung**, reines Verschieben.

**Risiko.** Mittel — große Verschiebung ohne Testnetz für die Oberfläche.
Deshalb **nach** P10, nicht davor. Oder P10 vorziehen.

**Abnahme.**
```bash
npm run build && npm test
wc -l src/screens/BeansScreen.tsx    # < 600
```
Manuell: Regal, Profil, Bohne anlegen, Bohne bearbeiten durchklicken.

---

### P9 — `BrewScreen.tsx` zerlegen (F-09) · P2 · ~4 h

Wie P8, fünf Phasen (Startpunkt, Erfassen, Laufkontrolle, Verkosten,
Ergebnis) in eigene Dateien.

**Abnahme.**
```bash
npm run build && npm test
wc -l src/screens/BrewScreen.tsx     # < 600
```

---

### P10 — Tests für den Kernpfad (F-14) · P2 · ~5 h

**Problem.** 379 Tests, keiner davon berührt die Oberfläche oder
`hydrate()`. Der Datenverlust-Pfad aus P1 wäre mit einem
`hydrate()`-Test sofort aufgefallen.

**Umfang.** Nicht alles testen. Drei Dinge:
1. `hydrate()` in allen Varianten (leer, gefüllt, Ladefehler) — deckt P1 ab
2. Der Weg „Bohne anlegen → brühen → protokollieren" auf Store-Ebene
3. Import/Export-Rundlauf mit echtem Zustand

Braucht eine Testumgebung mit DOM **nur**, wenn Komponenten getestet
werden. Die drei Punkte oben gehen ohne — das ist Absicht.

**Abnahme.**
```bash
npm test           # > 385 Tests grün
```

---

### P11 — Kleinkram (F-13, F-19) · P3 · ~1,5 h

- Setup filtert Mühlen nach `grindersForMethod` wie der Brühbildschirm
  (`SetupScreen.tsx:119` vs. `BrewScreen.tsx:134`)
- Wisch-Hinweis „Loslassen zum Löschen" bekommt `aria-hidden`

**Abnahme.** `npm run build && npm test`

---

## Woche 3 — Erlebnis

> Ziel: Die App sieht aus wie eine Entscheidung, nicht wie eine Abfolge
> von Entscheidungen.

### P12 — Schriftskala (F-11) · P2 · ~4 h

**Problem.** 17 verschiedene Schriftgrößen als Tailwind-Einzelwerte.
13px kommt 61× vor, 26px genau einmal, 23px genau einmal — der lange
Schwanz sind Zufallsentscheidungen.

**Umfang.** Sechs bis sieben Stufen als Tokens in `@theme`, dann alle
`text-[NNpx]` darauf abbilden. Die Ausreißer (23, 26, 28, 29, 30, 34)
zur nächsten Stufe ziehen.

**Risiko.** Mittel — betrifft jede Datei mit Text, also fast alle.
Kleine Commits pro Bildschirm.

**Abnahme.**
```bash
grep -roh "text-\[[0-9]*px\]" --include="*.tsx" src | sort -u | wc -l
# Ziel: ≤ 2 (nur begründete Ausnahmen)
```

---

### P13 — Fehlerzustände je Ansicht (aus Audit §6.4) · P2 · ~3 h

P2 liefert die globale Fehlergrenze. Hier geht es um die lokalen: Was
passiert, wenn die Karte nicht lädt, wenn ein Protokoll fehlt, wenn die
Mühle gelöscht wurde, während man brüht.

**Abnahme.** Tabelle in `docs/AUDIT.md` §6.4 hat keine „fehlt"-Zelle mehr.

---

### P14 — README und CHANGELOG (F-16 reduziert) · P3 · ~2 h

Kein Impressum, keine Datenschutzerklärung — die App bleibt privat.
Aber: `CHANGELOG.md` existiert nicht, und das README beschreibt die App
von vor drei Wochen (es nennt drei Methoden, es sind fünf).

**Abnahme.**
```bash
ls CHANGELOG.md
grep -c "Filterkaffeemaschine" README.md   # > 0
```

---

## Übersicht

| Paket | Befunde | Schwere | Aufwand | Woche |
| ----- | ------- | ------- | ------- | ----- |
| P1 Datenverlust-Pfad | F-01, F-02 | **P0** | 3 h | 1 |
| P2 ErrorBoundary | F-03 | **P0** | 2 h | 1 |
| P3 Version + Update | F-04, F-07 | P1 | 1,5 h | 1 |
| P4 Sicherung vor Import | F-08 | P1 | 2 h | 1 |
| P5 `npm audit fix` | F-12 | P2 | 15 min | 1 |
| P6 Kontrast + Zoom | F-05, F-06 | P1 | 2 h | 1 |
| P7 Linter | F-10 | P2 | 2 h | 2 · offen |
| P8 BeansScreen zerlegen | F-09 | P2 | 4 h | 2 |
| P9 BrewScreen zerlegen | F-09 | P2 | 4 h | 2 |
| P10 Tests Kernpfad | F-14 | P2 | 5 h | 2 |
| P11 Kleinkram | F-13, F-19 | P3 | 1,5 h | 2 |
| P12 Schriftskala | F-11 | P2 | 4 h | 3 |
| P13 Fehlerzustände | §6.4 | P2 | 3 h | 3 |
| P14 README + CHANGELOG | F-16 | P3 | 2 h | 3 |

**Summe:** rund 36 Stunden. Woche 1 allein: 11 Stunden — und die
enthält alles, was die App vor Datenverlust schützt.

**Gestrichen:** F-15 (Suche, bei 3–5 Bohnen sinnlos), F-16 teilweise
(Impressum/Datenschutz, privat), F-17 (`drinks.json` bleibt, siehe
`IDEAS.md`), F-18 (53× `as unknown as` — der Aufwand für generierte Typen
steht in keinem Verhältnis, solange die Tests die Datendateien prüfen).

---

## Was ist ein Linter? (Antwort auf O-5)

Ein Linter ist ein Programm, das deinen Code liest, **ohne ihn
auszuführen**, und auf Muster hinweist, die erfahrungsgemäß schiefgehen.
Nicht Geschmack — Fehlerklassen.

Der Unterschied zu dem, was du schon hast:

| Werkzeug | prüft | findet |
| -------- | ----- | ------ |
| TypeScript (`npm run typecheck`) | Typen | „Diese Zahl ist ein String" |
| Vitest (`npm test`) | Verhalten | „Die Funktion gibt das Falsche zurück" |
| **Linter** | Muster | „Dieser `useMemo` hängt von etwas ab, das du nicht aufgeführt hast" |

Das konkrete Beispiel aus **dieser** Codebasis: Diese App hatte
mindestens zweimal das Problem, dass ein Zustand-Selektor bei jedem
Rendern ein neues Array zurückgab und die App in eine Endlosschleife
schickte. TypeScript sieht das nicht (die Typen stimmen). Tests sehen es
nicht (es gibt keine Oberflächentests). `eslint-plugin-react-hooks` sieht
genau das und sagt es beim Tippen.

**Kosten:** drei bis vier Pakete, alle nur `devDependencies` — sie landen
nie im Bundle, der Nutzer lädt kein Byte mehr. Die Einrichtung ist etwa
zwei Stunden, davon eine für das Abarbeiten der Meldungen, die er beim
ersten Lauf über 17.753 Zeilen ausspuckt.

**Die ehrliche Gegenrede:** Bei einem Solo-Projekt, bei dem eine einzige
Person alles schreibt und liest, ist ein Linter weniger wert als in einem
Team. Sein Hauptnutzen — allen dasselbe beibringen, ohne es zu
diskutieren — entfällt. Was bleibt, ist die Hook-Prüfung, und die ist bei
einer React-App mit 24 Komponenten trotzdem ihr Geld wert.

**Meine Empfehlung:** ja, aber nur mit `react-hooks` und
`typescript-eslint` in der empfohlenen Grundeinstellung. Keine
Stilregeln, kein Prettier — deine Formatierung ist durchgehend
einheitlich, dafür braucht es kein Werkzeug.

Sag einfach ja oder nein; ohne ein Ja lasse ich P7 aus.
