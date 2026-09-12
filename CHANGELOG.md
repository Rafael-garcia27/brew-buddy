# Changelog

Alle nennenswerten Änderungen an Café. Neueste zuerst.

Das Format ist bewusst schlicht: Was hat sich für jemanden geändert, der
die App benutzt — nicht, welche Dateien angefasst wurden. Die stehen in
der Git-Historie.

---

## Unveröffentlicht

### Behoben
- **Die App lässt sich wieder vergrößern.** Zwei Finger auseinander tun
  jetzt, was sie sollen — vorher war das gesperrt. Der Auto-Zoom beim
  Antippen eines Eingabefelds bleibt trotzdem aus. (F-06)
- **Sechs Textfarben waren zu blass zum Lesen.** Kleingedrucktes, Hinweise
  und die Signalfarben lagen unter der Schwelle, ab der Text auf seinem
  Untergrund verlässlich erkennbar ist. Alle Kombinationen liegen jetzt
  darüber — sichtbar vor allem bei 10–12-px-Text und in der Sonne. (F-05)
- **Ein seltener Absturz im Brühen-Bildschirm.** Unter bestimmten
  Bedingungen rief der Bildschirm zwei React-Hooks weniger auf als sonst;
  beim Wechsel zwischen beiden Fällen bricht React ab und entlädt die
  Oberfläche. Vom neuen Linter gefunden. (F-10)
- **Die erste Wischbewegung auf einer Kaffeekarte greift sofort.** Vorher
  rechnete sie mit Breite 0 und schob die Karte um nichts — spürbar war
  ein kurzes Hängen zu Beginn der Geste.
- **Der Hintergrund eines Blattes wird nicht mehr vorgelesen.** Er ist
  Dekoration; Escape und „Schließen" führen ohnehin hinaus.
- **Ein Absturz endet nicht mehr in einer weißen Seite.** Ging beim
  Zeichnen des Bildschirms etwas schief, blieb nichts übrig — in der
  installierten App ohne Adresszeile eine Sackgasse. Jetzt erscheint ein
  Fehlerbildschirm mit „Neu starten" und „Daten retten". Beim zweiten
  Absturz in derselben Sitzung sagt er zusätzlich, dass es vermutlich am
  gespeicherten Bestand liegt. (F-03)
- **Ein Lesefehler kann den gespeicherten Bestand nicht mehr
  überschreiben.** Ließ sich die Datenbank beim Start nicht lesen, hielt
  die App das für einen Erststart und schrieb einen leeren Zustand
  darüber — die Historie war endgültig weg. Jetzt wird in diesem Fall
  nichts geschrieben, und die App sagt, was los ist. (F-01)
- **Fehlgeschlagenes Speichern ist sichtbar.** Bei vollem Speicher oder
  im privaten Modus tat die App so, als sei gespeichert. Jetzt steht eine
  Warnung mit dem Weg zur Sicherung. (F-02)
- **Die letzte gelöschte Mühle bleibt gelöscht.** Sie wurde beim nächsten
  Start wortlos wieder angelegt.

### Unter der Haube
- **Kontraste sind jetzt prüfbar** (`npm run kontrast`, auch in der CI).
  Rechnet jede Textfarbe gegen jeden Untergrund und bricht ab, wenn eine
  Kombination unter 4,5:1 fällt. Sonst hält der Fix nur bis zum nächsten
  Griff in die Palette.
- **Linter eingerichtet** (`npm run lint`, auch in der CI). Nicht ESLint
  wie geplant — `typescript-eslint` läuft nicht auf TypeScript 7, dessen
  Paket die alte Compiler-Schnittstelle nicht mehr hat. Stattdessen
  oxlint mit eigenem Parser. Nur Fehlerklassen, keine Stilregeln.
  Begründung in `docs/ROADMAP.md`, § P7.
