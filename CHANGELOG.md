# Changelog

Alle nennenswerten Änderungen an Café. Neueste zuerst.

Das Format ist bewusst schlicht: Was hat sich für jemanden geändert, der
die App benutzt — nicht, welche Dateien angefasst wurden. Die stehen in
der Git-Historie.

---

## Unveröffentlicht

### Behoben
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
