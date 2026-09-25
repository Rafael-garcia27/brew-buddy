# Solution Design

Antwort des Entwicklerteams auf `01-briefing.md`.
Erstellt **vor** Sichtung der bestehenden `barista-pwa` (Briefing F5).

---

## 1. Produktname

**Dialed** — Barista-Jargon für den Zustand, in dem eine Bohne perfekt läuft
(„the grinder is dialed in"). Genau das ist der Zweck der App.

Umbenennen jederzeit an einer Stelle möglich (`src/config.ts`).

> **Nachtrag 26.08.2026:** Umbenannt in **Café**, erreichbar unter
> `cafe.garciahub.de`. Grund: Der Auftraggeber wollte einen klaren, sofort
> verständlichen Namen statt eines Fachbegriffs. Die älteren Dokumente in
> `docs/` sprechen weiterhin von „Dialed" — sie sind Momentaufnahmen und
> werden bewusst nicht rückwirkend umgeschrieben.
>
> Der Name der IndexedDB-Datenbank bleibt ebenfalls `dialed`. Er ist ein
> interner Schlüssel: Eine Umbenennung würde alle gespeicherten Daten
> verwaisen lassen.
>
> **Nachtrag 24.09.2026:** Umbenannt in **Brew Buddy**, erreichbar unter
> `brewbuddy.garciahub.de`. Der Datenbankname `dialed` bleibt. Weil die
> Daten im Browser an die Domain gebunden sind, startet die App unter der
> neuen Adresse leer: Umzug per Sicherung aus der alten Adresse.
> Sicherungsdateien tragen jetzt die Kennung `brew-buddy`, ältere mit `cafe`
> oder `dialed` werden weiter angenommen.

---

## 2. Leitentscheidungen

| # | Entscheidung | Begründung |
|---|---|---|
| E1 | **Deterministische Regel-Engine, kein LLM zur Laufzeit** | Briefing B8: „reproduzierbar". Zusätzlich: offline, kostenlos, sofort, nachvollziehbar |
| E2 | **Fachwissen als Daten, nicht als Code** | `data/*.json` ist die Quelle der Wahrheit. Der Code interpretiert sie. Fachliche Änderung = Datenänderung, kein Deploy-Risiko |
| E3 | **Engine ohne UI testbar, rein funktional** | Jede Regel bekommt einen Test gegen die Abnahmeszenarien G1–G12 |
| E4 | **Gesamter Zustand als ein JSON-Blob in IndexedDB** | Datenmenge ist winzig (< 500 KB bei 1000 Brews). Vorteil: Lesen ist synchron aus dem Speicher, Export ist trivial, keine Migrationshölle |
| E5 | **Genau eine Empfehlung pro Durchgang** | Briefing E. Zwei Änderungen machen das Ergebnis uninterpretierbar |
| E6 | **Progressive Disclosure statt Einstellungsflut** | Briefing B6. Drei Sichtbarkeitsstufen aus `data/glossary.json` |
| E7 | **Keine Fremd-UI-Bibliothek** | Ein natives iOS-Gefühl entsteht durch Systemschriften, Safe Areas und 60 fps — nicht durch Material Design |

---

## 3. Tech-Stack

| Schicht | Wahl | Warum, und warum nicht anders |
|---|---|---|
| Build | **Vite 6** | Schnell, PWA-Plugin ausgereift, dem Auftraggeber vertraut |
| Sprache | **TypeScript, strict** | Der Domain-Layer existiert bereits typisiert |
| UI | **React 19** | Vertraut aus `barista-pwa` |
| Styling | **Tailwind 4** | Vertraut; erzwingt Konsistenz; kein CSS-Wildwuchs |
| State | **Zustand** | ~1 KB, kein Boilerplate. Redux wäre für diese Größe Overhead |
| Persistenz | **IndexedDB via `idb`** | localStorage ist synchron und auf 5 MB begrenzt |
| Routing | **eigener Mini-Router (~50 Zeilen)** | react-router kostet ~15 KB für eine 4-Tab-App. Eigene Lösung nutzt `history.pushState`, damit die **iOS-Zurück-Wischgeste** funktioniert |
| PWA | **vite-plugin-pwa (Workbox)** | Precaching aller Assets → vollständig offline |
| Icons | **Inline-SVG** | Keine Icon-Library, kein Netzabruf, volle Kontrolle |
| Schrift | **System-Stack (SF Pro auf iOS)** | Null Ladezeit, native Wirkung |
| Tests | **Vitest** | Engine-Tests laufen headless in CI |

**Bewusst nicht dabei:** kein Backend, kein Account, keine Analytics, kein
Sentry, keine Cloud, keine Fremdschriften. Die App macht keine einzige
Netzwerkanfrage nach dem ersten Laden.

---

## 4. Architektur

```
┌─────────────────────────────────────────────────────────┐
│  UI  (React)                                            │
│  Screens · Komponenten · keine Fachlogik                │
└───────────────┬─────────────────────────────────────────┘
                │ liest/schreibt
┌───────────────▼─────────────────────────────────────────┐
│  STORE  (Zustand)                                       │
│  Ein Zustandsobjekt · Actions · Selektoren              │
└───────────────┬──────────────────────┬──────────────────┘
                │                      │
┌───────────────▼──────────┐  ┌────────▼──────────────────┐
│  ENGINE (rein funktional)│  │  PERSISTENZ (IndexedDB)   │
│  ├ calc/     Formeln     │  │  Debounced Blob-Write     │
│  ├ starting/ Startpunkt  │  │  Export / Import          │
│  ├ diagnose/ Gates+Regeln│  └───────────────────────────┘
│  ├ learn/    2 Modelle   │
│  └ grinder/  Kalibrierung│
└───────────────┬──────────┘
                │ liest
┌───────────────▼─────────────────────────────────────────┐
│  WISSENSBASIS  (data/*.json — statisch importiert)      │
│  formulas · methods · variables · diagnostics ·         │
│  drinks · origins · grinders · glossary                 │
└─────────────────────────────────────────────────────────┘
```

**Regel:** Die UI kennt keine Kaffeelogik. Sie ruft `engine.*` auf und rendert
das Ergebnis. Damit ist die gesamte Fachlogik ohne Browser testbar.

---

## 5. Datenmodell (Speicherform)

```ts
interface AppState {
  schemaVersion: number
  beans:     Bean[]
  bags:      Bag[]
  brews:     Brew[]
  grinders:  Grinder[]
  setups:    EquipmentSet[]
  waters:    Water[]
  settings:  Settings
  learned:   LearnedModels      // abgeleitet, aber gecacht
}

interface Settings {
  activeSetupId?: string
  activeWaterId?: string
  expertLevel: 'basis' | 'advanced' | 'expert'
  showMeasurements: boolean      // TDS/EY-Felder — Standard: aus
  targetCorridor: {              // personalisierbar (Briefing B1)
    ey: [number, number]
    source: 'standard' | 'learned'
  }
  lastBackupAt?: string
}
```

Typen aus `types/domain.ts` wandern nach `src/domain/` und bleiben die
verbindliche Definition.

---

## 6. Die Engine

### 6.1 Startpunkt

```
startingPoint(bean, bag, method, setup, history) → StartingPoint
```

Prioritätskette:

```
1. Eigene Referenz für DIESE Bohne + Methode (rating ≥ 4)
   └→ + Frische-Korrektur (Briefing C4)
2. Transfer von einer ÄHNLICHEN Bohne (Ähnlichkeitsscore ≥ 5)
   └→ + Herkunfts-/Aufbereitungs-Anpassung
3. Röster-Empfehlung von der Tüte (niedrige Gewichtung, Briefing C7)
4. Methodendefault nach Röstgrad
   └→ + Modifikatoren: Höhe, Dichte, Aufbereitung, Decaf, Tiefkühlung
   └→ + persönlicher Bias aus dem Präferenzmodell
```

Jede Stufe liefert eine **sichtbare Begründung** mit. Der Nutzer sieht immer,
woher der Vorschlag kommt — das ist die Vertrauensbasis (Briefing B3).

### 6.2 Diagnose — vier Stufen

```
STUFE 0  GATES         Ist das Ergebnis überhaupt interpretierbar?
                       Kanalbildung · sauer+bitter · zu frisch · zu alt ·
                       Messfehler · Wasserverdacht · Röstungsverdacht ·
                       Streuung
                       → feuert eine: ABBRUCH, keine Parameterempfehlung
STUFE 1  OBJEKTIV      nur mit TDS-Messung: Position im Zielraster
STUFE 2  SENSORISCH    Fehlerachse × Methode × Röstgrad × Ratio
STUFE 3  AUSGABE       genau eine Korrektur, fünfteilig
```

Ausgabeformat — **alle fünf Teile sind Pflicht**:

```
WAS          „3 Klicks gröber (≈ +40 µm)"
WARUM        „Dein Shot lief 35 s statt 28 s — das Bett ist zu dicht."
ERWARTUNG    „Danach: 28–29 s, spürbar weniger Bitterkeit."
KONFIDENZ    sicher / wahrscheinlich / Versuch
ALTERNATIVE  „Falls das nicht hilft: Temperatur auf 91 °C."
```

Das Feld **ERWARTUNG** ist der Vertrauensmechanismus der App: eine überprüfbare
Vorhersage. Trifft die Zeit ein, glaubt der Nutzer auch der Geschmacksaussage.

### 6.3 Die zwei Lernmodelle (Briefing B5)

```ts
interface LearnedModels {
  process: {                          // „wie ich brühe"
    [method]: {
      timeBias: number                // Ist minus Vorhersage, gleitender Median
      consistencyS: number            // Streuung der Shotzeiten
      sampleSize: number
    }
  }
  preference: {                       // „was mir schmeckt"
    ratioBias: number                 // z. B. −0,3 = mag es enger als Standard
    tempBias: number
    grindBias: number
    confidence: number                // 0–1, wächst mit der Datenmenge
    sampleSize: number
    statement?: string                // „Du bevorzugst 0,3 engere Ratios."
  }
  perBean: {
    [beanId_method]: {
      bestBrewId: string
      medianParams: BrewActual
      sampleSize: number
    }
  }
}
```

**Lernschwellen:**

| Auslöser | Wirkung |
|---|---|
| 3 Brews mit Rating ≥ 4 für (Bohne, Methode) | persönlicher Startpunkt ersetzt den Default |
| 12 Brews über alle Bohnen einer Methode | systematischer Bias wird berechnet und angewendet |
| 20 Brews | Bias wird dem Nutzer als Aussage gezeigt |

**Unantastbar:** Werte mit Konfidenz „gesichert" (Milch ≤ 70 °C, Extraktion
≤ 30 %, Wassertemperatur ≤ 100 °C) werden nie überschrieben — sie sind
Validierungsgrenzen, keine Vorlieben.

### 6.4 Mühlen-Kalibrierung

Ohne sie ist „wie stark" unbeantwortbar (Briefing C1).

- Mühle aus Katalog wählen → Startwert für die Schrittweite
- **Kalibrier-Assistent:** zwei Shots mit 4 Schritten Abstand → aus dem
  Zeitverhältnis wird die tatsächliche Schrittweite berechnet
- Danach sind alle Empfehlungen in **Klicks** statt in Prozent

---

## 7. Informationsarchitektur

Vier Tabs. Mehr nicht.

```
┌──────────┬──────────┬──────────┬──────────┐
│  BRÜHEN  │  REGAL   │ LOGBUCH  │  SETUP   │
└──────────┴──────────┴──────────┴──────────┘
```

### Tab 1 · BRÜHEN — der Kernloop

```
   Bohne + Methode wählen  (letzte Auswahl vorbelegt)
              ↓
   ┌────────────────────────────────┐
   │  STARTPUNKT                    │
   │  18,0 g → 36,0 g · 1:2,0       │
   │  93 °C · Mahlgrad 22           │
   │  ────────────────────────────  │
   │  „Aus deinem besten Shot vom   │
   │   12.08., 1 Klick feiner —     │
   │   die Bohne ist 14 Tage älter." │
   │                    [ BRÜHEN ]  │
   └────────────────────────────────┘
              ↓
   ┌────────────────────────────────┐
   │        0:23                    │   ← ein großer Timer
   │        Ziel 28 s               │      Vollbild, Tap = Stopp
   │                                │      Blindbedienbar (C9)
   └────────────────────────────────┘
              ↓
   Ausbringung eintragen · Fluss/Puck antippen
              ↓
   Geschmack: Fehler-Chips + Charakter-Chips
              ↓
   ┌────────────────────────────────┐
   │  EMPFEHLUNG                    │
   │  3 Klicks gröber               │
   │  weil …                        │
   │  Erwartung: 28–29 s            │
   │  [Übernehmen]  [Als Referenz]  │
   └────────────────────────────────┘
```

**Interaktionsbudget: 3 Pflicht-Taps** (Start → Stopp → Bewerten).
Alles andere ist optional und vorbelegt (Briefing G10).

### Tab 2 · REGAL

Bohnenliste mit Frische-Ring pro Tüte. Detailseite: Herkunft, Farm, Varietät,
Aufbereitung, Höhe, Röstdatum, Röster-Empfehlung, Restmenge, eigene
Bestleistung je Methode.

Zusatzfunktion aus Briefing D: **„Welche Bohne heute?"** — sortiert nach
Frischefenster und Restmenge.

### Tab 3 · LOGBUCH

Chronologisch, filterbar nach Bohne und Methode. Bestleistungen markiert.
Detailansicht zeigt Soll/Ist, Beobachtungen, Geschmack und die damals gegebene
Empfehlung — inklusive der Frage, ob sie eingetroffen ist.

### Tab 4 · SETUP

Mühle (+ Kalibrier-Assistent), Sieb, Dripper, Filter, Wasser, Expertenlevel,
**Datensicherung**, Glossar.

---

## 8. UI-Prinzipien

1. **Eine Sache pro Bildschirm.** Kein Screen stellt zwei Fragen gleichzeitig.
2. **Zahlen groß, Text klein.** Ablesbar aus 50 cm, mit nassen Händen.
3. **Daumenzone.** Alle primären Aktionen im unteren Drittel.
4. **Fachbegriffe nie nackt.** Jeder Begriff aus `glossary.json` bekommt ein
   Info-Icon; im Basis-Modus erscheinen fortgeschrittene Begriffe gar nicht.
5. **Zeit ist Anzeige, nie Regler** (Briefing C2).
6. **Dark Mode zuerst.** Es wird morgens in dunklen Küchen gebrüht.
7. **Keine Modal-Kaskaden.** Maximal eine Ebene tief.
8. **Kein leerer Zustand ohne Weg.** Jede leere Liste bietet die nächste Aktion an.

---

## 9. iOS-/iPhone-12-Spezifika

| Thema | Umsetzung |
|---|---|
| Viewport | 390 × 844 als Referenz; `viewport-fit=cover` |
| Notch / Home-Indicator | `env(safe-area-inset-*)` auf Header und Tab-Bar |
| `100vh` kaputt in Safari | durchgehend `100dvh` / `100svh` |
| Installation | kein `beforeinstallprompt` in iOS → **Anleitung im Setup-Tab** mit Screenshot-Beschreibung |
| Statusleiste | `apple-mobile-web-app-status-bar-style: black-translucent` |
| Icons | 180 × 180 Apple-Touch-Icon + Maskable-Icons |
| Zoom beim Tippen | alle Eingabefelder ≥ 16 px Schriftgröße |
| Gummiband-Scrollen | `overscroll-behavior: none` am Wurzelelement |
| **IndexedDB-Löschung nach 7 Tagen** | `navigator.storage.persist()` + Backup-Erinnerung + Auto-Export |
| Datei-Export in Standalone | Web Share API mit Datei; Fallback Zwischenablage |
| Kein Web Bluetooth | Brüh-Screen blindbedienbar, Waage manuell |
| Touchziele | ≥ 44 pt |
| Haptik | Nicht verfügbar in iOS-PWA → visuelles und akustisches Feedback stattdessen |

---

## 10. Iterationsplan

| Iteration | Inhalt | Abnahme |
|---|---|---|
| **1** | Scaffold, Domain, Persistenz, Engine (Startpunkt + Gates + sensorische Diagnose), Screens Brühen/Regal/Logbuch, Mühlenkatalog | G1, G2, G3, G5, G9 |
| **Zwischenschritt** | `barista-pwa` analysieren, Best-of dokumentieren | `03-vergleich-barista-pwa.md` |
| **2** | Beide Lernmodelle, Frische-Drift, Kalibrier-Assistent, „Welche Bohne heute?", Wasser-Gate, UX-Verdichtung | G4, G6, G7, G8 |
| **3** | iOS-Härtung, Offline, Export/Import, Dark Mode, Barrierefreiheit, Performance, Glossar-Tooltips | G10, G11, G12 |
| **Release** | Repo, CI, GitHub Pages, README mit iOS-Installationsanleitung | – |

---

## 11. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| **Datenverlust durch Safari-Eviction** | `persist()`, Backup-Erinnerung ab 14 Tagen, Auto-Export-Vorschlag |
| **Nutzer misst Mühle nie ein** → Empfehlungen in Prozent statt Klicks | Kalibrierung im Onboarding anbieten, aber nie erzwingen; ohne sie fallweise auf Prozentangaben ausweichen |
| **Zu wenige Daten für Personalisierung** | Bis zur Schwelle offen kommunizieren: „Noch 2 gute Shots, dann kenne ich deinen Geschmack" |
| **Engine wirkt bevormundend** | Jede Empfehlung ist ein Vorschlag mit „Übernehmen"/„Ignorieren". Ignorieren wird gelernt. |
| **Feature-Kriechen** | Nicht-Ziele aus Briefing Teil E sind bindend |
| **Fachliche Fehler** | Alle Zahlen stammen aus `kb/`; `types/domain.test.ts` prüft die Rechenkette |

---

## 12. Nachträge

### 12.1 Ein Schalter statt drei Stufen (ersetzt §6/§8.4)

Die ursprünglich geplanten drei Sichtbarkeitsstufen (`basis` / `advanced` /
`expert`) waren selbst schon eine Komplexität — der Nutzer musste eine
Abstufung verstehen, bevor er Kaffee kochen konnte.

**Ersetzt durch einen Schalter ganz oben in den Einstellungen:**

| | Basis | Pro |
|---|---|---|
| Regal, Brühen, Logbuch, Diagnose | ✅ | ✅ |
| Mühle inkl. Einmessen | ✅ | ✅ |
| Datensicherung | ✅ | ✅ |
| **Refraktometer** (TDS/EY) | – | ✅ |
| **Wasserhärte** (GH/KH) | – | ✅ |
| **Glossar** | – | ✅ |
| Puck-Zustand, Drawdown | – | ✅ |
| Parameter anpassen | eingeklappt | offen |

Der Basis-Modus verliert **keine** Diagnosefähigkeit: Alle Gates aus kb/14
laufen weiter, nur ihre Eingaben sind reduziert. Info-Icons für Begriffe der
Stufe „basis" bleiben auch im Basis-Modus sichtbar — sie reduzieren
Verwirrung, statt sie zu erzeugen.

Zurückschalten löscht nichts: erfasste Wasserwerte und Messungen bleiben
gespeichert und werden nur ausgeblendet.

Bestandsdaten aus der Vorversion migrieren beim Laden
(`expertLevel: 'basis'` → Basis, alles andere → Pro).

### 12.2 Mahlgrad-Ring statt Zahlenfeld

Die Mühle des Nutzers (**Mylo SG2**, 38 mm Kegel, 20 µm Auflösung) ist
voreingestellt. Ihre werkseitigen Empfehlungen sind hinterlegt und schlagen
die Rückrechnung aus Mikrometern — der Hersteller kennt den Nullpunkt seiner
Skala, wir schätzen ihn nur:

| Aufdruck | Skala | intern (Klicks) |
|---|---|---|
| ESPRESSO 2-3 | 2–3 | 20–30 |
| MOKAPOT 3-4 | 3–4 | 30–40 |
| POUR OVER 5-8 | 5–8 | 50–80 |
| FRENCH PRESS 8-9 | 8–9 | 80–90 |

AeroPress ist auf der Mühle nicht notiert und aus den Nachbarwerten
abgeleitet — in der Oberfläche als „abgeleitet" gekennzeichnet.

**Bedienung:** Der Verstellring ist als Grafik nachgebildet — gerändelter
Ringkörper, weiße Zahlenskala (0 links … 10 rechts), aufgedruckte
Methodenbezeichnungen, darunter das weiße Dreieck als fester Index.
Zahlen und Aufdruck laufen mit dem Ring, das Dreieck steht still.
Zylinderprojektion (`sin`/`cos`) staucht und dunkelt die Skala zu den
Rändern — wie an einem echten Ring.

Intern wird in **Klicks** gerechnet (10 je Skalenzahl), angezeigt wird die
Zahl, die auf der Mühle steht: 24 Klicks = „2,4". Feinkorrektur über
±1-Klick-Tasten, weil Ziehen allein nicht klickgenau ist.

Technische Daten der Mühle (Mahlwerksgröße, Material, Kapazität) liegen als
Referenz in `data/grinders.json` unter `_specs` und werden in der Oberfläche
bewusst **nicht** angezeigt.
