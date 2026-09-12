# PROGRESS — Audit und Produktreife

Gedächtnis für diesen Auftrag. Wird nach **jedem** Teilschritt aktualisiert,
nicht erst am Phasenende.

## Aktuelle Phase
Phase 3 — Umsetzung. P1 und P2 erledigt.

## Zuletzt geprüft
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
**P7 — Linter** (~2 h, vom Auftraggeber zugesagt und vorgezogen).
Danach P6 (Kontrast + Zoom), dann P3 (Version + Update-Hinweis).

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
- **O-5 Linter** → erklärt in `docs/ROADMAP.md`; **zugesagt am 12.09.**

## Arbeitspakete (Phase 3+)

### Woche 1 — Stabilisieren (11 h)
- [x] **P1** Datenverlust-Pfad (F-01, F-02) — **P0** · erledigt, 391 Tests grün
- [x] **P2** ErrorBoundary (F-03) — **P0** · erledigt, 404 Tests grün
- [ ] **P3** Version + Update-Hinweis (F-04, F-07) — P1, 1,5 h
- [ ] **P4** Sicherung vor Import (F-08) — P1, 2 h
- [ ] **P5** `npm audit fix` (F-12) — P2, 15 min
- [ ] **P6** Kontrast + Zoom (F-05, F-06) — P1, 2 h

### Woche 2 — Aufräumen (16,5 h)
- [ ] **P7** Linter (F-10) — P2, 2 h · **zugesagt am 12.09.**, vorgezogen auf Woche 1
- [ ] **P8** `BeansScreen.tsx` zerlegen (F-09) — P2, 4 h
- [ ] **P9** `BrewScreen.tsx` zerlegen (F-09) — P2, 4 h
- [ ] **P10** Tests für den Kernpfad (F-14) — P2, 5 h
- [ ] **P11** Kleinkram (F-13, F-19) — P3, 1,5 h

### Woche 3 — Erlebnis (9 h)
- [ ] **P12** Schriftskala (F-11) — P2, 4 h
- [ ] **P13** Fehlerzustände je Ansicht — P2, 3 h
- [ ] **P14** README + CHANGELOG (F-16) — P3, 2 h

### Nur eine Woche Zeit?
Dann **P1 + P2 + P6**. Zusammen ~1 Tag.
