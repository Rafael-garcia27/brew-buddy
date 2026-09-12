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
