# Changelog

Alle nennenswerten Änderungen an Café. Neueste zuerst.

Das Format ist bewusst schlicht: Was hat sich für jemanden geändert, der
die App benutzt — nicht, welche Dateien angefasst wurden. Die stehen in
der Git-Historie.

---

## 2.0 — Unveröffentlicht

### Aus echten Logdaten (24.09.2026)

Fünfzehn Durchgänge aus vier Wochen wurden gegen die Engine
nachgerechnet — jeder mit dem Wissensstand, den die App damals hatte.
Acht davon endeten ohne jede Aussage. Was daraus folgte:

- **Die Frische sperrt nicht mehr, sie steht daneben.** „Noch zu frisch"
  hat ein Drittel aller Durchgänge stillgelegt: Wer am Röstdatum kauft
  und am selben Tag brüht, bekam einen Monat lang keine Empfehlung —
  und weil ohne Empfehlung auch keine Wette entsteht, blieb die ganze
  Vorhersage-Bilanz leer. Jetzt kommt die Empfehlung, mit einem
  Vorbehalt darüber und gedeckelter Konfidenz. Der Einwand bleibt
  richtig, er ist nur keine Sperre mehr. „Überaltert" sperrt weiterhin —
  aber nicht mehr, wenn die Tasse gut bewertet wurde.
- **Mahlgrade gehören zu ihrer Mühle.** Beim Wechsel von der Mylo SG2
  (Skala 0–100) auf die Sage Barista Express (Skala 0–18) hat die App
  die Referenzzahl unverändert übernommen und viermal „Mahlgrad 26,5"
  an einer Maschine vorgeschlagen, deren Rädchen bei 18 endet.
  Umgerechnet wird jetzt über Mikrometer; was außerhalb des Verstellwegs
  läge, wird gar nicht erst genannt.
- **Der Ertrag ist ein eigener Befund (D-09).** 18 g eingewogen, 41 g
  vorgeschlagen, bei 27,9 g gestoppt — sauer. Die App redete über Zeit
  und Geschmack und erwähnte nicht, dass ein Drittel des geplanten
  Ertrags fehlte. Jetzt steht das zuerst da, bevor irgendwer am
  Mahlgrad dreht.
- **Die Alterskorrektur (F-32) feuert überhaupt.** Sie hing am
  gelernten Modell, das drei gut bewertete Durchgänge JE BOHNE braucht —
  nach vier Wochen war es leer. Das Alter des Referenz-Shots steht aber
  längst in seiner Tüte und wird jetzt von dort genommen.

### Neu
- **Ein Einstieg statt zwei.** „Heute" beantwortet die Frage „welche
  Bohne, welche Methode" vorweg — aus der zuletzt gebrühten Bohne, der
  Uhrzeit und der Brühbereitschaft — und nennt den Grund dafür.
- **Eine laufende Uhr.** Bis jetzt hat die App die Zeit nicht gemessen,
  sondern abgefragt. „Let's Brew" startet jetzt einen Vollbild-Timer mit
  Zielband; der Bildschirm bleibt dabei an, und am Anfang und Ende des
  Bands gibt es einen Ton.
- **Die App steht für ihre Vorhersagen gerade.** „Erwartete Zeit danach:
  28 s" wird gespeichert, und der nächste Durchgang rechnet ab. Im
  Ergebnis steht die Prognose neben der gemessenen Zeit, im Verlauf die
  Trefferquote, und nach drei vergeblichen Korrekturen an derselben
  Stellgröße sagt die App, dass es nicht daran liegt.
- **Verkosten in einer Frage.** Zu sauer, sitzt, zu bitter — drei große
  Ziele statt zwanzig kleiner. Genauer geht es unter „Genauer", mit einem
  Geschmackspad statt acht Chips.
- **Das Logbuch ist eine Kurve.** Man sieht das Einmessen konvergieren,
  und unter „Versuche" steht, was geholfen hat: „24 → 23 → gemessen
  31 s. Vorhergesagt waren 26. Um 5 s daneben."
- **Im Regal steht der Termin.** Bei „noch zu frisch" jetzt mit dem Tag,
  ab dem es losgeht.
- **Die Getränkekarte.** Nach einem Espresso beantwortet die App die
  Frage „und jetzt?": dreiundzwanzig Getränke von Cortado bis Espresso
  Tonic, mit Milchmenge, Gießreihenfolge, Glasgröße und Schaumhöhe — und
  zwar auf den Shot gerechnet, der gerade gelaufen ist. Wer 20 g
  einwiegt, bekommt die passende Milchmenge und nicht die aus dem Buch.
  Abschaltbar in den Optionen unter „Zusatzfunktionen".
- **Und nach dem Filter: „Was geht noch?"** Am V60 stehen Japanese Iced
  Coffee und die kräftige Variante, in der Immersion Cold Brew als
  Konzentrat und trinkfertig samt Nitro, an der Maschine der Batch Brew —
  mit Einwaage, Wasser, Mahlgradabweichung, Temperatur und Ziehzeit. Die
  werden bewusst NICHT auf den letzten Durchgang umgerechnet: Das sind
  eigene Brühungen für das nächste Mal, keine Weiterverarbeitung dessen,
  was gerade in der Tasse steht.

### Unter der Haube
- **Der Ereignisstrom ist die Wahrheit.** Der gesamte Bestand entsteht
  aus einer angehängten Ereignisfolge; die bisherige Momentaufnahme
  bleibt als zweite Kopie. Fällt eine Quelle aus, rettet die andere den
  Bestand — vorher gab es nur eine.
- **Gewicht statt Schwelle.** Der gelernte Geschmacks-Bias schaltet nicht
  mehr beim zwölften Durchgang an, sondern wächst mit Anzahl, Einigkeit
  und Alter der Belege.
- **Die Wissensbasis prüft sich selbst.** Dabei kam heraus, dass eine
  stufenlose Mühle im Katalog ohne Schrittweite stand — wer sie gewählt
  hätte, hätte ab da falsche Mahlgradzahlen bekommen.
- **Methodenfähigkeiten stehen in den Daten**, nicht mehr im Code.
- 505 → 534 Tests.

---

## Unveröffentlicht

### Neu
- **Der Import sagt vorher, was er ersetzt.** „1 Bohne, 1 Bag, 0 Brews
  wird ersetzt durch 12 Bohnen, 3 Bags, 40 Brews" — und warnt, wenn die
  gewählte Sicherung leer oder älter ist als der Bestand. Der
  naheliegende Knopf sichert vorher. (F-08)
- **Im Setup steht, welcher Stand läuft** — Version, Commit und
  Baudatum. (F-04)
- **Eine neue Version meldet sich.** Vorher tauschte der Service Worker
  still aus, und wer die App offen liegen ließ, lief auf einem Stand,
  den es nicht mehr gab. (F-07)

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

### Neu (klein)
- **Ein kaputter Teil reißt nicht mehr die ganze App mit.** Geht das
  Nachladen der Weltkarte schief, steht ein Hinweis an ihrer Stelle und
  der Rest des Profils bleibt. Stürzt ein Bildschirm ab, bleibt die
  Reiterleiste bedienbar — man kann ihn verlassen, statt neu zu starten.

### Behoben (klein)
- **Das Setup zeigt für die Barista Express nur noch Espresso.** Vorher
  standen dort fünf Mahlgrade für Methoden, die diese Mühle gar nicht
  bedient. (F-13)
- **Screenreader lesen den Wischhinweis nicht mehr vor.** „Loslassen zum
  Löschen" stand in jeder Zeile im Textfluss. (F-19)

### Unter der Haube
- **Eine Schriftskala statt 17 Einzelwerte.** Neun Stufen als Tokens;
  229 Stellen umgestellt, ohne dass sich der Zeilenabstand ändert. (F-11)
- **README auf Stand gebracht** — fünf Methoden statt drei, die
  tatsächlichen Prüfkommandos, die aktuelle Verzeichnisstruktur. (F-16)
- **Die beiden größten Dateien sind zerlegt.** `BeansScreen` 1429 → 572
  Zeilen, `BrewScreen` 1304 → 838, verteilt auf fünf Dateien statt zwei.
  Reines Verschieben, kein Verhalten geändert. (F-09)
- **18 neue Tests** für den Start, den Kernpfad „Bohne anlegen → brühen →
  protokollieren" und den Rundlauf durch eine Sicherungsdatei. (F-14)
- **Eine Sicherheitslücke in einer Bau-Abhängigkeit geschlossen**
  (`fast-uri`). Sie lief nie im Browser. (F-12)
- **Kontraste sind jetzt prüfbar** (`npm run kontrast`, auch in der CI).
  Rechnet jede Textfarbe gegen jeden Untergrund und bricht ab, wenn eine
  Kombination unter 4,5:1 fällt. Sonst hält der Fix nur bis zum nächsten
  Griff in die Palette.
- **Linter eingerichtet** (`npm run lint`, auch in der CI). Nicht ESLint
  wie geplant — `typescript-eslint` läuft nicht auf TypeScript 7, dessen
  Paket die alte Compiler-Schnittstelle nicht mehr hat. Stattdessen
  oxlint mit eigenem Parser. Nur Fehlerklassen, keine Stilregeln.
  Begründung in `docs/ROADMAP.md`, § P7.
