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
