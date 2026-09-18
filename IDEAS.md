# IDEAS

Was unterwegs aufgefallen ist und **nicht** in den aktuellen Diff gehört.
Kein Versprechen, nur ein Merkzettel.

---

## Getränkekatalog aus `data/drinks.json` (aus Audit F-17)

Die Datei ist keine Leiche, sondern ein fertiger, ungenutzter Datensatz:
35 Getränke von Ristretto bis Nitro Cold Brew, dazu Referenzbasen,
Sirupmengen, Eisarten und Validierungsregeln. Quelle laut Datei selbst:
`kb/12-getraenke.md` und `kb/13-iced-und-cold.md`.

```
drinks:        35 Einträge
referenceBase:  7 Schlüssel
syrups:         2 · iceTypes: 4 · validation: 7
```

Die naheliegende Funktion dahinter: **„Was mache ich aus diesem Shot?"**
Nach einem gelungenen Espresso zeigt die App, dass daraus ein Cortado
(1 Shot + 60 ml Milch) oder ein Flat White wird — mit den Mengen, die
dazugehören. Das ist der einzige Teil der Wissensbasis, der bisher
nirgends ankommt.

**Kosten:** Die Datei wird nicht importiert und liegt deshalb *nicht* im
Bundle. Sie zu behalten kostet 15,7 KB im Repository und sonst nichts.

**Empfehlung:** behalten, nicht löschen. Entweder wird daraus einmal eine
Funktion, oder sie bleibt liegen — beides ist billiger als die Arbeit
wegzuwerfen, die in den 35 Rezepturen steckt.

---

## Weitere Notizen

*(wird gefüllt, sobald unterwegs etwas auffällt)*
## Fehlerbildschirm im hellen Modus, obwohl Dunkel eingestellt ist (aus P2)

Das Farbschema wird von `applyTheme()` gesetzt, und das läuft erst, wenn
`hydrate()` durch ist. Stürzt die App schon beim ersten Zeichnen ab, hat
`html` noch keine Klasse `dark` — wer Dunkel eingestellt hat, bekommt
einen hellen Fehlerbildschirm.

Belegt am 12.09.2026: Klasse von Hand gesetzt → der Bildschirm ist korrekt
dunkel (`--c-paper: #1c1512`). Es fehlt also nur der frühe Zeitpunkt.

**Warum nicht sofort behoben:** Die Einstellung liegt in IndexedDB und ist
damit asynchron; `prefers-color-scheme` zu nehmen wäre falsch für den, der
bewusst Hell gewählt hat. Ein sauberer Weg wäre, die Themewahl zusätzlich
in `localStorage` zu spiegeln und in `main.tsx` synchron anzuwenden — das
behebt nebenbei auch das kurze Aufblitzen in Hell bei jedem Kaltstart.
Gehört zu P12 (Schriftskala) oder einem eigenen kleinen Paket.

---

## „Bestand zurücksetzen" im Fehlerbildschirm (aus P2)

Wenn der gespeicherte Bestand die Absturzursache ist, hilft „Neu starten"
nicht, und ins Setup (wo man eine Sicherung einspielen könnte) kommt man
nicht — die Oberfläche steht ja nicht. Der fehlende dritte Knopf wäre:
Datenbank leeren, und zwar erst, nachdem die Rettungsdatei rausgegangen ist.

Bewusst aus P2 herausgehalten: ein Knopf, der alles löscht, gehört nicht
in denselben Durchgang wie der Bildschirm, der ihn trägt.

---
## `--c-mute` und `--c-faint` sind fast dasselbe Token (aus P6)

Vor P6 lagen beide bei 4,27 bzw. 4,26 auf `paper` — als Hierarchie gedacht,
in Wahrheit nicht unterscheidbar. Nach dem Nachziehen stehen sie bei 5,55
und 5,15; das ist ein echter, aber kleiner Unterschied.

Dahinter steckt ein Denkfehler, der größer ist als die Farbe: `faint` wird
für 10–12-px-Text benutzt, `mute` für 13–15 px. Kleinere Schrift braucht
**mehr** Kontrast, nicht weniger — die beiden Tokens sind also verkehrt
herum zugeordnet.

Der saubere Weg wäre, sie zu einem zusammenzulegen. Das sind aber rund
hundert Verwendungsstellen, und der richtige Moment dafür ist P12
(Schriftskala): Dort werden die Größen ohnehin angefasst, und erst dann
lässt sich sagen, welche Stufe welche Farbe braucht.

---
## Die Wischaktionen stehen vor der Karte, die sie betreffen (aus P11)

Im Baum liest sich jede Zeile so:

```
button "Edit"
button "Löschen"
generic "Loslassen zum Löschen"   ← mit P11 aria-hidden
button  [Kontrollbohne, Medium · Washed, …]
```

Die Aktionen kommen also **vor** der Bohne, auf die sie sich beziehen —
zwangsläufig, weil sie in der Wischmechanik darunterliegen und die Karte
sich über sie schiebt. Wer sich vorlesen lässt, hört „Edit, Löschen" und
erfährt erst danach, wovon die Rede war.

Der Fix wäre, den Aktionen den Bohnennamen mitzugeben
(`aria-label="Kontrollbohne bearbeiten"`) statt die Reihenfolge zu
ändern — die hängt an der Optik. Kleine Sache, gehört aber zu einem
Durchgang, in dem die Liste ohnehin angefasst wird.

---
## Zeilenhöhen an die Schriftstufen binden (aus P12)

Die Skala aus P12 liefert nur Schriftgrößen; die Zeilenhöhen stehen auf
`inherit`, damit die Umstellung nichts am Zeilenabstand ändert. Das war
richtig für diesen Durchgang — es sollte ein Austausch sein, keine
Neugestaltung.

Der nächste Schritt wäre, jeder Stufe ihre Zeilenhöhe mitzugeben: kleine
Schrift braucht relativ mehr Durchschuss als große, und die `leading-*`
über die Oberfläche verstreuten Einzelangaben würden dann größtenteils
überflüssig. Das ist aber ein Durchgang, bei dem man jeden Bildschirm
ansieht, nicht einer, den man ausrechnet.

---
## Fehler als Ausprägung statt als Schalter (aus 2.0/O5)

Das Geschmackspad liefert eine Position — „deutlich sauer, etwas dünn" —
und übersetzt sie in dieselben Fehler-Tags wie die Chips davor. Die
Information über die *Stärke* geht dabei verloren.

Sie zu behalten hieße, die Fehlerachse der Engine von kategorial auf
kontinuierlich umzustellen. 57 Regeln fragen heute „ist `sour` gesetzt?",
nicht „wie sehr" — und viele Schwellen (Tore, Deckelungen, Konfidenz)
hängen an dieser Binärität.

Der Gewinn wäre echt: Eine Korrektur könnte proportional zur Ausprägung
ausfallen statt in festen Schritten. Der Aufwand ist aber ein Durchgang
durch die gesamte Diagnostik, mit neuen Testfällen für jede Regel. Das
ist ein eigenes Vorhaben, kein Anhängsel an eine Oberfläche.

---
## `when` und `priority` der Diagnoseregeln werden nie gelesen (aus 2.0/U7)

`data/diagnostics.json` beschreibt 57 Regeln mit einer Bedingung (`when`)
und einer Rangfolge (`priority`). Beim Bauen des Beispiel-Mechanismus kam
heraus: **Die Engine liest beides nicht.** `RULES` wird ausschließlich
über `getRule(id)` benutzt — um Text zu einer Regel nachzuschlagen, die
der Code vorher selbst ausgewählt hat.

Belegt am 18.09.2026: Ein Beispiel für D-30 (`when` = bitter **und**
adstringierend, `priority` 1) ließ D-32 feuern (`priority` 3). Nach der
Datei hätte D-30 gewinnen müssen.

**Warum das zählt.** Leitentscheidung E2 lautet „Fachwissen liegt in
`data/*.json`, der Code ist ihr Interpreter". Für Methoden, Herkünfte,
Formeln und Mühlen stimmt das. Für die Diagnoseregeln stimmt es nur zur
Hälfte: Text, Konfidenz und Techniktipps kommen aus der Datei, die
*Auslösebedingung* steht im Code. Beides kann auseinanderlaufen, ohne
dass irgendwo etwas rot wird — und wer die Datei liest, glaubt, er habe
das Regelwerk vor sich.

**Drei Wege, absteigend nach Aufwand:**

1. **Einen Auswerter bauen.** `when` ist eine kleine Ausdruckssprache
   (`defects includes 'bitter' && timeS > targetTimeS * 1.15`). Ein
   Interpreter dafür wäre überschaubar — aber er würde das Verhalten
   überall ändern, und die 57 Bedingungen müssten erst gegen die
   heutige Implementierung geprüft werden.
2. **Die Divergenz sichtbar machen.** Für jede Regel ein `beispiel`, das
   durch `diagnose()` läuft. Wo Datei und Code sich uneinig sind, wird
   es rot. Der Mechanismus steht seit U7; es fehlen die Beispiele.
3. **Ehrlich umbenennen.** `when` nach `_when` und dokumentieren, dass es
   eine Beschreibung ist, keine Regel. Kostet eine Stunde und nimmt der
   Datei den falschen Anschein.

Weg 2 ist der beste: Er kostet je Regel fünf Zeilen, deckt die
Divergenzen einzeln auf und lässt Weg 1 später offen.

---
## Einheiten im Typsystem — bewusst nicht gebaut (aus 2.0/U8)

Der Entwurf sah `Gramm`, `Sekunden`, `Celsius`, `Mikrometer` und `Klicks`
als eigene Typen vor, damit man sie nicht verwechseln kann. Beim
Abarbeiten der Liste ist das durchgefallen, und zwar aus einem Grund, der
zählt: **Es gibt keinen Beleg für die Fehlerklasse.**

In der ganzen Historie dieses Projekts — 50 Commits vor dem Audit, 19
Audit-Befunde, 534 Tests — steht keine einzige Verwechslung von Sekunden
und Gramm. Die Namenskonvention (`doseG`, `timeS`, `waterTempC`) trägt
die Einheit bereits, und sie wird durchgehend eingehalten.

Der Preis wäre dagegen hoch: Jedes Zahlenliteral im Code und in den Tests
bräuchte einen Konstruktor, und die Wissensbasis liefert nackte Zahlen,
die an jeder Grenze umgewandelt werden müssten.

**Wenn es doch kommt, dann von der Grenze her:** zuerst nur `Mikrometer`
und `Klicks`, weil zwischen diesen beiden tatsächlich umgerechnet wird
(`micronPerStep`) und ein Vorzeichenfehler dort plausibel ist. Der Rest
hat die Konvention.

---
