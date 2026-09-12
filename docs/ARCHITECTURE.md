# ARCHITECTURE — Café

Stand: Commit `2f153e0`, 11.09.2026. Jede Aussage verweist auf eine Datei,
die für dieses Dokument tatsächlich gelesen wurde. Wo etwas nur vermutet
ist, steht **(nicht verifiziert)** dabei.

---

## 1. Was das Ding ist

Eine reine Client-PWA ohne Backend. Sie berechnet Brüh-Startpunkte für
fünf Zubereitungsmethoden, protokolliert Durchgänge und leitet aus dem
Protokoll persönliche Korrekturen ab.

`package.json:5` — `"private": true`, Version `0.1.0`, keine Runtime-
Abhängigkeit außer React, Zustand und `idb`:

```
"dependencies": { "idb", "react", "react-dom", "zustand" }
```

Kein HTTP-Client, kein Auth-SDK, kein Analytics-Paket. Das ist eine
bewusste Eigenschaft, keine Lücke — siehe §6.

---

## 2. Laufzeitgerüst

| Schicht | Datei | Bemerkung |
| ------- | ----- | --------- |
| Einstieg | `src/main.tsx:1–16` | `createRoot` + `StrictMode`, dazu zwei Seiteneffekte vor dem Rendern |
| Shell | `index.html:1–33` | `viewport-fit=cover`, zwei `theme-color`, iOS-Standalone-Metas |
| Build | `vite.config.ts:1–63` | Vite 8, React-Plugin, Tailwind-v4-Plugin, `vite-plugin-pwa` |
| Aliase | `vite.config.ts:16–21` | `@` → `src`, `@domain` → `types/domain.ts`, `@data` → `data` |

`src/main.tsx:7–9` ruft vor dem ersten Render zwei Dinge auf:

```ts
installFlushHandlers()
// Ohne dauerhaften Speicher räumt Safari nach 7 Tagen Inaktivität auf.
void requestPersistence()
```

Das ist die erste architektonische Aussage der App: Der Datenbestand ist
das Produkt, und die Plattform ist ihm gegenüber feindlich.

---

## 3. Zustand und Datenfluss

### 3.1 Ein Store, ein Blob

`src/store/index.ts:88` — ein einziger Zustand-Store (`zustand`), der den
gesamten `AppState` plus ein `ready`-Flag hält. Kein Context, kein
Reducer-Baum, kein Server-State-Cache.

Die Aktionsfläche ist flach und vollständig in `src/store/index.ts:32–62`
deklariert: `addBean`, `updateBean`, `deleteBean`, `restoreBean`, `addBag`,
`updateBag`, `deleteBag`, `addBrew`, `updateBrew`, `deleteBrew`,
`setBestBrew`, `addGrinder`, `updateGrinder`, `deleteGrinder`,
`upsertWater`, `setSettings`, `setMode`, `setTheme`, `replaceState`,
`resetAll`, `hydrate`.

### 3.2 Der Commit-Pfad

`src/store/index.ts:67–86` — jede Datenänderung läuft durch `commit()`:

```ts
function commit(set, relearn = true) {
  set((s) => {
    const learned = relearn ? recompute(s.brews, s.beans, s.bags, new Date()) : s.learned
    const next: AppState = { …alle Felder… }
    saveState(next)
    return { learned }
  })
}
```

Zwei Dinge passieren hier gekoppelt: **Neuberechnung der Lernmodelle** und
**Persistierung**. Das ist der zentrale Datenfluss der App — es gibt keinen
zweiten Weg, auf dem Daten in die Datenbank kommen.

`relearn = false` wird bewusst beim reinen Anlegen gesetzt
(`src/store/index.ts:121`, `164`, `232`): Eine neue Bohne ohne Protokoll
ändert am Gelernten nichts.

### 3.3 Persistenz

`src/store/persist.ts` — **ein JSON-Blob in IndexedDB**, Datenbank
`dialed`, Store `state`, Schlüssel `app` (`persist.ts:28–31`).

Der Kommentar darüber (`persist.ts:24–27`) ist eine harte Warnung: Der
Datenbankname darf nie geändert werden, sonst verwaisen alle Daten. Die
App heißt seit einer Umbenennung Café, die Datenbank weiter `dialed`.

Schreiben ist entprellt (`persist.ts:69–74`, 300 ms) mit `flush()` auf
`pagehide` und `visibilitychange` (`persist.ts:90–97`).

`requestPersistence()` (`persist.ts:103–112`) markiert den Speicher als
dauerhaft — der dokumentierte Grund ist die 7-Tage-Räumung in Safari.

### 3.4 Migration

`src/store/migrate.ts`, eingebunden in `persist.ts:53` beim Laden.
`SCHEMA_VERSION = 3` (`src/config.ts:3`). Abgedeckt von
`src/store/migrate.test.ts`.

### 3.5 Export/Import

`persist.ts:150–178` — `shareBackup()` mit dreistufigem Rückfall:
Web-Share-API → `<a download>` → Zwischenablage. Der Kommentar nennt den
Grund: In der iOS-Standalone-PWA sind Download-Links unzuverlässig.

Import über `parseBackup` + `replaceState` **(nicht verifiziert — die
Aufrufstelle in `SetupScreen.tsx` wurde für dieses Dokument nicht
gelesen)**.

---

## 4. Fachlogik: Daten statt Code

Der auffälligste Zug der Architektur. `src/kb/index.ts:1–9` formuliert ihn
selbst:

> Leitentscheidung E2 aus dem Solution Design: Fachwissen liegt in
> `data/*.json`, NICHT im Code. Dieses Modul ist der einzige Ort, an dem
> die JSON-Dateien gelesen werden.

Elf Datendateien (`data/`), zusammen 344 KB, davon `worldmap.json` allein
99 KB. Menschenlesbare Quelle dazu in `kb/` (308 KB Markdown, 20 Kapitel).

Die Engine besteht aus sieben Modulen in `src/engine/`:

| Modul | Aufgabe |
| ----- | ------- |
| `starting.ts` (542) | Startpunkt: Vorgaben + Bohnen-, Herkunfts-, Frischemodifikatoren |
| `runcheck.ts` (810) | Stufe 0.5 — Urteil aus Zeit/Fluss, **vor** der Verkostung |
| `diagnose.ts` (846) | Stufe 2 — Urteil aus Geschmack, versöhnt mit Stufe 0.5 |
| `suitability.ts` (447) | Eignung Bohne ↔ Methode, in beide Richtungen |
| `freshness.ts` | Ruhefenster, methodenabhängig |
| `grinder.ts` (386) | Klicks ↔ Mikrometer, Kalibrierung |
| `learn.ts` | Lernmodelle aus der Protokollhistorie |

`src/engine/` enthält 9 Testdateien; insgesamt 379 Tests
(`npm test`, Ausgabe siehe `docs/AUDIT.md`).

---

## 5. Oberfläche

### 5.1 Routing

`src/router.tsx:1–7` — **eigener Mini-Router** über die History-API,
begründet mit der iOS-Zurück-Wischgeste. Fünf Ziele
(`router.tsx:26`): `coffee | brew | profile | log | setup`.

Die Bedeutung von `id` und `detail` hängt am Reiter und ist in einer
Tabelle im Code festgehalten (`router.tsx:29–45`) — `brew` trägt in `id`
die **Methode** und in `detail` die Bohne, alle anderen in `id` die Bohne.

`src/App.tsx:114–149` verteilt darauf die Bildschirme; Brew ist
dreistufig (Methode → Bohne → Durchgang).

### 5.2 Bildschirme

| Datei | Zeilen | Rolle |
| ----- | ------ | ----- |
| `screens/BeansScreen.tsx` | 1429 | Regal + Bohnenprofil + Formulare |
| `screens/BrewScreen.tsx` | 1296 | Startpunkt → Erfassen → Laufkontrolle → Verkosten → Ergebnis |
| `screens/SetupScreen.tsx` | 545 | Modus, Mühlen, Wasser, Sicherung |
| `screens/LogScreen.tsx` | 351 | Protokollliste + Detail |
| `screens/MethodPicker.tsx` | 297 | Methodenkatalog, dreistufig |
| `screens/BeanPicker.tsx` | 161 | Bohnenempfehlung je Methode |

Zwei Dateien über 1200 Zeilen sind der offensichtliche Strukturbefund —
Details in `docs/AUDIT.md`.

### 5.3 Design

`src/index.css:40–115` — Design-Tokens als CSS-Variablen, zwei Paletten
(`:root` hell, `html.dark` dunkel), über `@theme inline`
(`index.css:8–27`) an Tailwind v4 angebunden.

Gemeinsame Bausteine in `src/components/ui.tsx` (986 Zeilen): `Screen`,
`Header`, `Section`, `Card`, `Button`, `Chip`, `SegmentedControl`,
`Field`, `TextInput`, `Select`, `Stepper`, `Toggle`, `InfoDot`, `Sheet`,
`Stat`, `Triad`, `MetaRow`, `Empty`, `FreshnessRing`, `FilterRow`.

Grafische Sonderbauteile: `OriginMap` (Weltkarte, lazy),
`GrinderDial`/`SageGrindDial` (zwei Mühlenbilder), `beanviz`
(Röstskala, Aufbereitung, Bohne im Ring), `methodicons` (9 Methodensymbole),
`SwipeReveal`.

---

## 6. Externe Dienste

**Keine.** Kein Netzwerkaufruf zur Laufzeit — `vite.config.ts:55–57`
sagt es ausdrücklich:

```
// Die App macht keine Netzwerkanfragen zur Laufzeit —
// alles wird beim ersten Laden gecacht.
```

Konsequenz: kein Login, keine Synchronisation zwischen Geräten, kein
serverseitiges Backup, kein Fehler-Monitoring. Alles davon ist ein
Produktbefund, kein Bug — siehe `docs/AUDIT.md`.

---

## 7. Auslieferung

Bundle nach `npm run build` (Messung 11.09.2026):

```
dist/assets/index-*.css      33.78 kB │ gzip:  6.73 kB
dist/assets/index-*.js      512.77 kB │ gzip: 163.95 kB
```

Dazu ein lazy geladener Kartenbrocken (`OriginMap`, rund 38 kB gzipped).

Service Worker über `vite-plugin-pwa`, `registerType: 'autoUpdate'`
(`vite.config.ts:27`), `generateSW`, Precache aller Assets
(`vite.config.ts:53`).

Deploy: GitHub Actions auf Push nach `main` → GitHub Pages, eigene Domain
über `public/CNAME`. Zwei Notfallskripte in `scripts/`
(`deploy-direct.sh`, `deploy-restore.sh`) **(nicht verifiziert — Inhalt
für dieses Dokument nicht gelesen)**.

---

## 8. Erststart-Verhalten (funktional geprüft)

Mit geleertem Speicher im Vorschau-Browser durchgeklickt:

- `#/coffee` → Leerzustand mit einer Handlung („Erste Bohne anlegen")
- `#/brew` → voller Methodenkatalog, auch ohne eine einzige Bohne
- `#/brew/v60` → Leerzustand mit Weg zum Anlegen
- `#/log` → Leerzustand mit Weg zum Anlegen
- `#/setup` → zeigt **bereits eine Mühle**: „Mylo SG2 · selbst eingemessen"

Der letzte Punkt kommt aus `src/store/index.ts:96–111`: Beim Erststart
legt `hydrate()` ungefragt zwei Mühlen an — eine Handmühle als aktive und
die im Siebträger verbaute. Der Codekommentar begründet es damit, dass
Empfehlungen „sofort in echten Klicks" kommen sollen. Das ist eine
Annahme über die Ausstattung des Nutzers und gehört als Befund nach
`docs/AUDIT.md`.

---

## 9. Was dieses Dokument nicht abdeckt

- `SetupScreen.tsx` wurde nur überflogen; Import-Pfad und Wasser-Verwaltung
  sind nicht im Detail geprüft.
- `scripts/*.sh` sind nicht gelesen.
- Die CI-Definition unter `.github/workflows/` ist nicht gelesen.
- Kein Lighthouse-Lauf — der gehört in Phase 1.6.
