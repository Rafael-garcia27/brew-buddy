# PROGRESS — Audit und Produktreife

Gedächtnis für diesen Auftrag. Wird nach **jedem** Teilschritt aktualisiert,
nicht erst am Phasenende.

## Aktuelle Phase
Phase 3 — Umsetzung. **Woche 1 und 2 vollständig** (P1–P11). Als Nächstes Woche 3.

## Zuletzt geprüft
**Woche 2 fertig.** P10 (18 Tests für `hydrate()`, den Kernpfad und den
Sicherungs-Rundlauf, ohne DOM-Umgebung; per Mutation gegengeprüft),
P11 (F-13, F-19), P8 (`BeansScreen` 1429 → 572 + 417 + 490),
P9 (`BrewScreen` 1304 → 838 + 488 + 297).

**P9 erfüllt sein Abnahmekriterium nicht** (838 statt < 600) — bewusst.
Startpunkt und Erfassen hängen an 40 bzw. 34 Namen aus der Komponente;
sie als Komponenten herauszuziehen hieße, vierzig Werte durchzureichen.
Begründung im Commit `aef5171`.

**Woche 1 fertig.** P5 (`fast-uri` 3.1.5 → 3.1.7, 0 Schwachstellen),
P3 (Version `0.1.0 · <commit> · <datum>` im Setup, `UpdateToast`
eingehängt und gegen einen echten Service-Worker-Wechsel geprüft),
P4 (Import in zwei Schritten mit Zahlen und Sicherung vorweg, 10 Tests).

**P6 erledigt.** Sechs Tokens nachgezogen (OKLCH, Farbton und Buntheit
unangetastet), `maximum-scale` gestrichen. Gemessen mit demselben Weg
vorher und nachher gegen den Produktions-Build: Accessibility **86 → 100**,
durchgefallen waren genau `color-contrast` (Gewicht 7) und `meta-viewport`
(Gewicht 10). Kontrastmatrix ohne `!`. Als `npm run kontrast` in der CI
festgenagelt, Wächter gegengeprüft (alter Wert → exit 1).

**P7 erledigt — aber anders als geplant.** ESLint ist an TypeScript 7
nicht möglich (`typescript` exportiert nur noch `version`), belegt in
`docs/ROADMAP.md` § P7. Stattdessen oxlint, eine dev-Abhängigkeit, null
Byte im Bundle. Erster Lauf: zwei echte Fehler (Hooks nach Frühausstieg
in `BrewScreen`, Ref beim Rendern in `SwipeReveal`) plus ein Test, der
nichts prüfte. Alle drei behoben. `npm run lint` → 0 Fehler, 14
Warnungen, auch als CI-Schritt.

**P2 erledigt.** F-03 zuerst im Browser belegt (`root.innerHTML.length
=== 0`, null Knöpfe), dann Fehlergrenze um `<App/>`. Rettungsweg geht
bewusst am Store und an `migrate()` vorbei — beide können die Ursache
sein. 13 Tests für `rescue.ts`, im Browser beide Pfade ausgelöst.

**P1 erledigt** (Commits `e3f2963`, `91e3d71`). Drei Schritte: Startlogik
aus `hydrate()` herausgelöst (reines Verschieben), Test geschrieben —
5 von 12 rot —, dann behoben. Im Browser mit einem echten Lesefehler
gegengeprüft: Der Bestand überlebt, die Warnung erscheint.

Linter ist zugesagt (P7) und auf Woche 1 vorgezogen.

## Nächster Schritt
**Woche 3 — Erlebnis.** P12 (Schriftskala, F-11), P13 (Fehlerzustände je
Ansicht), P14 (README + CHANGELOG, F-16).

## Phasen
- [x] **Phase 0 — Recon** (nur lesen) → Lagebild + `docs/ARCHITECTURE.md`
- [x] **Phase 1 — Audit** (nur lesen) → `docs/AUDIT.md`
- [x] **Phase 2 — Roadmap** → `docs/ROADMAP.md`
- [ ] **Phase 3…N — Umsetzung**

## Offene Teilaufgaben Phase 0
- [x] Struktur & Größe — 118 Dateien, 17.753 Zeilen TS/TSX
- [x] Abhängigkeiten & Skripte — 4 Runtime-Deps, 10 Dev-Deps
- [x] Git-Historie — 50 Commits über 10 Arbeitstage
- [x] App lokal starten und durchklicken — leer und gefüllt
- [x] `docs/ARCHITECTURE.md`

## Erledigte Notizen aus Phase 0
- Mylo-Standard: vom Auftraggeber als gewollt bestätigt (privat) — kein Befund.
- Barista Express zeigt im Setup alle Methoden → **F-13** (P2, belegt).
- Zwei Dateien über 1200 Zeilen → **F-09** (P2, belegt).
- Kein Monitoring, keine Version → **F-04** (P1, belegt).

## Die drei P0 aus Phase 1
- **F-01** Fehlgeschlagenes Laden überschreibt echte Daten
  (`store/persist.ts:44–52` + `store/index.ts:96–111`)
- **F-02** Schreibfehler bleibt unsichtbar (`store/persist.ts:69–74`)
- **F-03** Kein ErrorBoundary → weiße Seite ohne Ausweg

## Offene Fragen — beantwortet am 12.09.2026
- **O-1 privat**, kein Store → Woche 4 gestrichen
- **O-2 3–5 Bohnen** → F-15 (Suche) gestrichen
- **O-3 ein iPhone** → F-08 (Sicherung vor Import) bleibt P1, eigenes Paket
- **O-4 `drinks.json`** → beantwortet in `IDEAS.md`: 35 fertige Getränke­
  rezepturen, nicht im Bundle, bleibt liegen
- **O-5 Linter** → zugesagt und umgesetzt; ESLint war nicht möglich,
  Ersatz und Begründung in `docs/ROADMAP.md` § P7

## Arbeitspakete (Phase 3+)

### Woche 1 — Stabilisieren (11 h)
- [x] **P1** Datenverlust-Pfad (F-01, F-02) — **P0** · erledigt, 391 Tests grün
- [x] **P2** ErrorBoundary (F-03) — **P0** · erledigt, 404 Tests grün
- [x] **P3** Version + Update-Hinweis (F-04, F-07) — P1 · erledigt
- [x] **P4** Sicherung vor Import (F-08) — P1 · erledigt, 10 Tests
- [x] **P5** `npm audit fix` (F-12) — P2 · erledigt, 0 Schwachstellen
- [x] **P6** Kontrast + Zoom (F-05, F-06) — P1 · erledigt, Accessibility 86 → 100

### Woche 2 — Aufräumen (16,5 h)
- [x] **P7** Linter (F-10) — P2 · erledigt (oxlint statt ESLint, siehe ROADMAP § P7)
- [x] **P8** `BeansScreen.tsx` zerlegen (F-09) — P2 · erledigt, 1429 → 572
- [x] **P9** `BrewScreen.tsx` zerlegen (F-09) — P2 · erledigt, 1304 → 838 (Kriterium < 600 verfehlt, begründet)
- [x] **P10** Tests für den Kernpfad (F-14) — P2 · erledigt, +18 Tests
- [x] **P11** Kleinkram (F-13, F-19) — P3 · erledigt

### Woche 3 — Erlebnis (9 h)
- [ ] **P12** Schriftskala (F-11) — P2, 4 h
- [ ] **P13** Fehlerzustände je Ansicht — P2, 3 h
- [ ] **P14** README + CHANGELOG (F-16) — P3, 2 h

### Nur eine Woche Zeit?
Dann **P1 + P2 + P6**. Zusammen ~1 Tag.
