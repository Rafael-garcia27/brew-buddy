# 05 — Brew und Coffee: Analyse, Recherche, Solution Design

Grundlage für die nächste Ausbaustufe. Eingang: Testerrückmeldung vom
07.09.2026. Dieses Dokument entscheidet nichts, was Geschmackssache ist —
es sortiert, bewertet den Aufwand gegen den Nutzen und legt fest, was
gebaut werden muss, damit die Wünsche fachlich tragen.

Stand des Codes: `c60052c`. 271 Tests, vier Brühmethoden, Beans als
einziger Einstieg.

---

## 1. Die Themen, sortiert

Aus der Rückmeldung lassen sich sieben Themen trennen. Die Reihenfolge ist
nach Abhängigkeit sortiert, nicht nach Wichtigkeit: A trägt B und C.

| # | Thema | Kern |
| - | ----- | ---- |
| **A** | **Zwei Einstiege** | Navigationsleiste mit `Brew` und `Coffee`; beide sind vollwertige Startpunkte |
| **B** | **Methodenkatalog** | Mehr als vier Methoden, Favoriten, nicht besessene nur angedeutet, Icons |
| **C** | **Methode → Bohne** | Neue Empfehlungsrichtung: Methode gewählt, welche Bohne passt? |
| **D** | **Filter im Bohnenregal** | Nach Methode und nach Aufbereitung |
| **E** | **Coffee grafischer** | Bohnen als Schaltflächen, Informationen schöner gesetzt |
| **F** | **Profil umbauen** | Roast- und Process-Skalen, Kartenlegende, Fit sortiert, Fakten in eine Tabelle |
| **G** | **Röstgrad quantitativ** | Fällt bei F ab: Die Skala, die F grafisch braucht, existiert fachlich schon (Agtron) |

**Was NICHT in der Rückmeldung steht und trotzdem entschieden werden
muss:** Wo das Logbuch über alle Bohnen hinweg wohnt. Es hing bis
`c11c1db` an einem eigenen Reiter, hängt jetzt an einer Bohne, und mit
zwei Reitern ist die Frage wieder offen (§6.1).

---

## 2. Potenzialanalyse

Aufwand als Größenklasse, nicht als Stundenzahl: **S** = ein Nachmittag,
**M** = mehrere Sitzungen, **L** = eigenes Vorhaben mit Wissensarbeit.

| # | Nutzen | Aufwand | Risiko | Urteil |
| - | ------ | ------- | ------ | ------ |
| A | **hoch** | M | mittel | Macht den Kern der App erst sichtbar |
| B | **hoch** | **L** | hoch | Teuerste Position — aber teilbar, siehe §3.2 |
| C | **hoch** | S–M | mittel | Daten liegen vollständig vor, Funktion fehlt |
| D | mittel | S | niedrig | Billig, aber Bedeutung muss geklärt werden |
| E | mittel | M | mittel | Charme mit Lesbarkeitsfalle, siehe §4.5 |
| F | **hoch** | M | niedrig | Gut umrissen, fast reine Darstellung |
| G | mittel | S | niedrig | Hebt F von „erfunden" auf „gemessen" |

### 2.1 Warum A hoch bewertet ist

Die App beantwortet zwei Fragen, und beide sind echte Alltagsfragen:

> „Ich will einen V60 machen — welche meiner Bohnen nehme ich?"
> „Ich habe diese Bohne — wie brühe ich sie am besten?"

Die zweite kann die App seit Anfang an (`bestMethodFor`). Die erste hat sie
nie gekonnt, und mit dem Umbau auf Beans als einzigen Einstieg ist sie
sogar unstellbar geworden: Man muss erst eine Bohne wählen, um überhaupt
zu einer Methode zu kommen. Der Tester hat damit keine Geschmacksfrage
gemeldet, sondern eine fehlende Hälfte.

**Das relativiert den Umbau von `c11c1db` nicht, es korrigiert ihn
teilweise.** Die damalige Begründung war: drei von vier Reiterzielen
ergeben nur mit einer bestimmten Bohne Sinn. Für Profil und Log stimmt das
weiter. Für Brühen stimmt es nicht mehr, sobald die Methode selbst der
Einstieg ist.

### 2.2 Warum B das Risiko trägt

Eine Methode ist in dieser App kein Listeneintrag. Der eigene Maßstab —
gesetzt bei der French Press in `4b923c0` — verlangt pro Methode:

| Was | Wo | Umfang |
| --- | -- | ------ |
| Physikklasse | `methods.json` | immersion / gravity- / pressure-percolation |
| Vorgaben je Röstgrad | `methods.json` | 5 × (Dosis, Ratio, Temperatur, Zeit) |
| Empfindlichkeiten | `methods.json` | grindSensitivity, timeSensitivity |
| Mahlgradfenster | `grinders.json` | targetMicronByMethod |
| Retentionswasser | `formulas.json` | LRR — ohne das ist jede Ausbeute falsch |
| Toleranzen | `methods.json` | Zeit, Dosis, Wasser |
| Korrekturreihenfolge | `methods.json` | getrennt für unter- und überextrahiert |
| Eignungsmatrix | `methods.json` | 5 Röstgrade × 4 Aufbereitungsfamilien = **20 Werte** |
| Ruhefenster | `formulas.json` F-31 | je Röstgrad |
| Ablaufschritte | `methods.json` | die Handgriffe |
| Herkunftseignung | `origins.json` | **13 Profile × 1 Wert** |
| Wissenskapitel | `kb/` | eigenes Kapitel wie kb/10b |

Das sind rund **40 fachliche Einzelwerte plus ein Kapitel je Methode**.
Fünfzehn Methoden wie bei Filtru wären damit kein Feature, sondern ein
zweites Projekt.

**Der Ausweg steht in der Rückmeldung selbst:** „wenn ich zb keine
Mokkakanne habe, will ich die Funktion nur in leicht angedeutet sehen
(damit ich weiß es wäre möglich)". Eine angedeutete Methode braucht
**keinen einzigen** dieser Werte — nur Name, Icon und einen Satz. Damit
entkoppelt der Wunsch nach Andeutung den Katalog von der Engine, und der
Katalog kann pro Methode wachsen, statt auf einmal fertig sein zu müssen.

Das ist die tragende Erkenntnis dieser Analyse.

---

## 3. Recherche

### 3.1 Was die Wissensbasis heute schon hergibt

Geprüft, nicht vermutet:

* **Eignung in beide Richtungen ist vollständig.** Alle 13
  Herkunftsprofile haben `methodSuitability` für alle vier Methoden,
  lückenlos. Alle vier Methoden haben die volle 5 × 4-Eignungsmatrix. Für
  Thema C fehlt keine Zahl, nur die Funktion.
* **Der Röstgrad hat eine echte Skala.** `kb/05 §2.1` führt die
  Agtron/SCA-Farbskala mit sieben Bändern von 25 bis 95 („höherer Wert =
  heller") und die Regel: *ist `agtron` bekannt, hat er Vorrang vor
  `roastLevel`, weil Rösteretiketten um bis zu zwei Stufen streuen*.
  `Bean.agtron` existiert im Typ — **und wird nirgends benutzt**: kein
  Formular, keine Engine, keine Anzeige. Thema F verlangt eine grafische
  Röstskala; sie kann damit auf einer genormten Messgröße stehen statt auf
  fünf erfundenen Stufen.
* **Aufbereitung ist zweistufig modelliert.** Neun Verfahren in
  `origins.json`, die die Eignungsmatrix auf vier Familien abbildet
  (`washed`, `natural`, `honey`, `fermented`, siehe `suitability.ts`). Für
  eine grafische Process-Darstellung ist die Familie die richtige Ebene —
  neun Symbole wären neun Vokabeln, vier sind lernbar.
* **Cold Brew ist KEINE Methode.** Es ist ein `IcedModifier` mit
  `mode: 'cold-brew'` und `steepHours`, fachlich unterlegt durch kb/13.
  Wer Cold Brew in den Methodenkatalog aufnimmt, baut es doppelt.
  Entscheidung nötig (§6.3).

### 3.2 Wie teuer welche neue Methode ist

Nicht jede Methode kostet gleich viel. Entscheidend ist, ob sie die Physik
einer bestehenden teilt:

| Methode | Physik | Nachbar | Kosten |
| ------- | ------ | ------- | ------ |
| Chemex | gravity-percolation | V60 | **niedrig** — dickeres Papier, langsamer, weniger Körper |
| Kalita Wave | gravity-percolation | V60 | **niedrig** — Flachboden, gleichmäßiger, verzeiht mehr |
| Clever / Switch | Hybrid | V60 + French Press | **mittel** — Immersion mit Papierfilter, eigene LRR |
| Filterkaffeemaschine | gravity-percolation | V60 | **niedrig-mittel** — Brühkopf statt Hand, Agitation fix |
| **Mokkakanne** | pressure-percolation | Espresso (entfernt) | **hoch** — ~1,5 bar statt 9, Dampfdruck, eigenes Kapitel |
| Cezve / Türkisch | keine Filtration | — | **hoch** — gekocht, ungefiltert, ultrafein, eigenes Kapitel |
| Siphon | gravity + Vakuum | — | **hoch** — eigene Physik, seltenes Gerät |
| Phin | Immersion/Perkolation | AeroPress (entfernt) | **mittel-hoch** |

**Beobachtung zur Priorisierung:** Der Tester nennt die Mokkakanne — und
das ist zufällig die teuerste der naheliegenden Methoden, weil ihre
Physik keinen Nachbarn hat. Sie ist damit das perfekte Beispiel für die
angedeutete Stufe, aber ein schlechter Kandidat für die erste echte
Erweiterung. Die Filterkaffeemaschine dagegen ist in deutschen Küchen
verbreiteter als jede Handmethode und kostet fast nichts.

### 3.3 Icons: Konvention, nicht Nachbau

Filtru zeigt die Methoden als Reihe monochromer Strichsilhouetten, jede
die Umrisslinie ihres Geräts — Chemex als Sanduhr, V60 als Kegel,
AeroPress als Zylinder. Dieselbe Sprache benutzen praktisch alle Apps der
Kategorie; sie ist Konvention und nicht Filtrus Eigentum.

**Vorgabe:** eigene Icons im Strichstil der App zeichnen — 24er Raster,
`stroke-width` 1.8, `currentColor`, wie `GearButton` und der Zurück-Pfeil
es schon tun. Kein Nachbau fremder Zeichnungen, keine Emoji (die
Designregel der App verbietet sie ausdrücklich), keine gefüllten Flächen:
Die Icons müssen in beiden Paletten und auf 44 px funktionieren.

Eindeutigkeit ist bei drei Kegeln (V60, Kalita, Chemex) die eigentliche
Schwierigkeit. Unterscheidungsmerkmale, die im Umriss tragen:

* **V60** — Kegel mit sichtbaren Rippen, spitzer Auslauf, 60°
* **Kalita** — Kegel mit **flachem** Boden, drei Standfüße
* **Chemex** — Sanduhr mit Holzmanschette und Ausgusstülle
* **AeroPress** — Zylinder mit Kolbengriff oben
* **French Press** — Glaszylinder mit Deckel und Kolbenstange
* **Espresso** — Siebträger im Profil, Griff nach links, zwei Ausläufe
* **Mokkakanne** — Achteck-Silhouette mit Griff und Deckelknopf

---

## 4. Solution Design

### 4.1 A — Zwei Einstiege

**Route.** Aus `beans` wird `coffee`; `brew` bleibt, wird aber ohne
Bohnenkennung aufrufbar. Beides braucht die Weiterleitung alter Adressen,
wie sie `router.tsx` schon für `shelf` führt — eine installierte PWA
startet mit dem Hash des letzten Besuchs.

```
#/brew                → Methodenraster
#/brew/<methode>      → Bohnenempfehlung für diese Methode
#/brew/<methode>/<bohne>  → der Brühvorgang (heute #/brew/<bohne>)
#/coffee              → Bohnenliste
#/coffee/<bohne>      → Bohne vorausgewählt
#/profile/<bohne>     → Profil
#/log[/<bohne>]       → Logbuch
#/setup               → Setup
```

Die dritte Segmentebene ist neu. `router.tsx` führt heute `tab/id/detail`
mit `-` als Platzhalter (`f1213f6`); für `brew/<methode>/<bohne>` reicht
das aus, wenn die Methode als `id` und die Bohne als `detail` läuft. Das
ist eine Umdeutung der Felder und gehört im Router benannt, sonst ist es
in drei Monaten ein Rätsel.

**Navigationsleiste.** Zwei Ziele, `Brew` und `Coffee`. Setup bleibt
hinter dem Zahnrad. Beide Reiter behalten die 44-px-Trefferflächen der
alten Leiste. Der Zurück-Pfeil im Kopf bleibt, wo er heute ist.

**Wo der Sitzungszustand hängt.** Heute merkt sich Beans die Auswahl in
der Route (`waehle`, `f1213f6`). Brew braucht dasselbe für die Methode,
und `settings.lastMethod` existiert bereits.

### 4.2 B — Methodenkatalog in drei Stufen

Ein neues Feld in `methods.json` trennt, was die Engine kann, von was der
Katalog kennt:

```jsonc
{
  "id": "mokapot",
  "label": "Mokkakanne",
  "tier": "announced",   // "full" | "announced"
  "teaser": "Dampfdruck um 1,5 bar — kräftig, ohne Crema.",
  "icon": "mokapot"
}
```

* **`full`** — alles aus §2.2 vorhanden, Methode voll benutzbar.
* **`announced`** — nur Name, Icon, ein Satz. Im Raster gedämpft
  dargestellt, antippbar, öffnet aber keinen Brühvorgang, sondern die
  Erklärung „gibt es, ist noch nicht eingemessen".

Die Engine muss davor geschützt werden, eine angedeutete Methode zu
verarbeiten: `getMethod()` wirft heute bei unbekannter Kennung, was
richtig ist. Neu braucht es `getFullMethod()` — oder eine Sperre in
`startingPoint`, die eine `announced`-Methode ablehnt, statt mit
Vorgabewerten zu raten. **Ohne diese Sperre erfindet die App Rezepte für
Geräte, über die sie nichts weiß.**

**Favoriten.** `settings.favoriteMethods?: BrewMethod[]`. Leer = alle
`full`-Methoden gelten als Favorit (kein Erststart-Leerlauf). Das Raster
zeigt Favoriten zuerst und voll, danach die übrigen `full`-Methoden
normal, zuletzt die `announced` gedämpft. Umschalten über einen
Sternknopf am Icon oder im Setup — Entscheidung offen (§6.4).

**Typänderung mit Folgen.** `BrewMethod` ist heute ein
String-Literal-Union über vier Werte, und `Record<BrewMethod, …>` wird an
vielen Stellen verlangt (Labels, Farben, Frischefenster). Jeder neue Wert
bricht diese Records — was gut ist, denn der Compiler zeigt dann genau,
was noch fehlt. Der Union bleibt also, er wächst nur; **kein `string`**.

### 4.3 C — Methode → Bohne

Die Gegenrichtung zu `bestMethodFor`, und sie darf nicht dessen Fehler
wiederholen. Der Kommentar in `suitability.ts` hält ihn fest: Eignung
misst, *wie leicht etwas schiefgeht* — die AeroPress gewann deshalb fast
immer. Empfohlen wird stattdessen nach `origin.methodSuitability`, also
danach, *wo eine Bohne ihre Stärken ausspielt*.

Für Methode → Bohne kommen zwei Größen dazu, die es in der anderen
Richtung nicht gibt:

```
rang(bohne, methode) =
      methodSuitability[methode]         // wo spielt sie ihre Stärken aus
    − Malus wenn suitability < 2,5       // was schwierig ist, wird nicht empfohlen
    × Frischefaktor                      // NEU
    − Malus wenn Bag fast leer           // NEU
```

**Warum Frische hier zählt und dort nicht:** Bohne → Methode vergleicht
Methoden für **eine** Bohne, die Frische ist für alle gleich und kürzt
sich weg. Methode → Bohne vergleicht **Bohnen** untereinander — und eine
fachlich perfekte Bohne, die 60 Tage nach Röstung liegt, ist die falsche
Empfehlung. `assessFreshness` liefert den `score` (0–100) bereits.

Genauso der Bestand: 8 g Restmenge bei 18 g Vorgabe machen die beste
Empfehlung unbrauchbar. `bag.remainingGrams` wird geführt und beim Brühen
schon verrechnet (`store/index.ts`).

Zu klären: ob die Empfehlung auch **abraten** darf — „für diese Methode
hast du gerade nichts Passendes". Das wäre ehrlich und passt zum Ton der
App (kb/15 §6 lässt „die Bohne passt nicht zur Methode" ausdrücklich zu).

### 4.4 D — Filter im Bohnenregal

`Process` ist eindeutig: Auswahl über die neun Verfahren oder die vier
Familien. Empfehlung: **Familien**, weil die Eignungsmatrix auch auf
Familien rechnet und neun Chips die Liste zudecken.

`Methode` ist **zweideutig** und muss entschieden werden:

| Lesart | Bedeutung | Ergebnis |
| ------ | --------- | -------- |
| „geeignet für" | `suitability(bohne, m).score ≥ 3,5` | mehrere Methoden je Bohne |
| „am besten als" | `bestMethodFor(bohne).method === m` | genau eine je Bohne |

Die zweite ist strenger und deckt sich mit dem, was in der Liste schon
steht („Am besten als V60"). Die erste ist beim Suchen nützlicher.
Vorschlag: **„geeignet für"**, weil Filtern eine Suchhandlung ist und der
strenge Fall über die Sortierung ohnehin sichtbar bleibt.

### 4.5 E — Coffee grafischer, ohne unlesbar zu werden

**Die Falle:** Eine bohnenförmige Schaltfläche ist beim ersten Mal
charmant und beim zwanzigsten unbrauchbar — in eine Bohnenform passt kein
Name, und ein Regal ohne Namen ist ein Ratespiel. Zwölf gleich aussehende
Bohnen sind schlechter als zwölf Zeilen.

**Vorschlag, der beide Wünsche in einem Element löst:** Die Bohne ersetzt
den `FreshnessRing` als Anzeigeelement der Zeile und trägt dann drei
Informationen statt einer.

```
        ╭───────────╮
        │  ◗ Bohne  │   Füllfarbe  = Röstgrad (Agtron-Band, §4.7)
        │   im Ring │   Ring       = Frische (wie heute, 0–100)
        ╰───────────╯   Zahl innen = Tage nach Röstung
```

Damit bleibt die Zeile eine Zeile — Name, Röster, Frische lesbar — und
gewinnt trotzdem das spielerische Element. Der Ring existiert schon
(`FreshnessRing`, 36 px), die Bohnenform kommt als Pfad hinein.

Für „schönere Darstellung von Informationen" braucht es keine neue
Mechanik, sondern die Anwendung dessen, was `f1213f6` und `9e22028`
schon eingeführt haben: Grafik oben, trockene Fakten unten. Genau das
sagt Thema F.

### 4.6 F — Das Profil neu geschichtet

Reihenfolge von oben nach unten, so wie der Tester sie beschreibt:

| # | Block | Form |
| - | ----- | ---- |
| 1 | **Weltkarte** | bleibt unverändert |
| 2 | **Kartenlegende** | die Herkünfte als Legende zur Grafik, nicht als Fließtext |
| 3 | **Roast** | grafische Skala plus Begriff |
| 4 | **Process** | grafisches Symbol plus Begriff |
| 5 | **Fit** | wie heute, **nach Eignung sortiert** |
| 6 | **Fakten** | schlichte Tabelle: Name, Röster, Röstung, Menge, Höhe, Varietät |

**Zu 2 — Legende.** Heute steht unter der Karte ein Satz („Blend aus 3
Herkünften: Brasilien, Äthiopien, Indien."). Als Legende wird daraus eine
Liste mit Farbmarke je Eintrag. Das eröffnet zugleich etwas, das der
Fließtext nicht kann: **je Herkunft eine eigene Farbe**, damit man in
einem Blend sieht, welche Fläche welches Land ist. Dafür braucht die Karte
mehrere Füllfarben statt einer — Aufwand niedrig, Nutzen deutlich.
Randbedingung: bei einem offenen Blend (ganzer Gürtel, 60 Länder) gibt es
keine Legende, dort bleibt der Satz.

**Zu 3 — Roast.** Siehe §4.7.

**Zu 4 — Process.** Vier Familiensymbole, jedes zeigt, was mit der
Fruchthülle passiert ist — das ist der fachliche Unterschied:

* **Washed** — Bohne, Fruchtfleisch abgelöst daneben, Wassertropfen
* **Natural** — Bohne komplett in der Kirsche, Sonne
* **Honey** — Bohne mit anhaftender Schleimschicht
* **Fermented** — geschlossenes Gefäß mit Bläschen

**Zu 5 — Fit sortieren.** Einzeiler: `.sort((a,b) => b.score - a.score)`.
Achtung, die Reihenfolge der vier Methoden ist heute die
Anzeigereihenfolge aus `labels.ts` und damit stabil; nach Eignung sortiert
springt sie je Bohne. Das ist gewollt, aber die Methodennamen müssen dann
links stehen bleiben, damit man sie findet.

**Zu 6 — Faktentabelle.** Zwei Spalten, links Bezeichnung in `mute`,
rechts Wert in `ink`, Trennlinien in `line`. Kein `Stat`, keine Kacheln —
der Zweck ist Dichte. Was heute in der `Profil`-Karte als 2×3-Kachelraster
steht, wandert hierher.

**Was wegfällt:** die Origin-Zeile. Die Karte plus Legende sagt es
besser. Der Ort, an dem heute die Herkunft steht, ist damit frei für die
Legende — die Karte bekommt keinen zusätzlichen Platzbedarf.

### 4.7 G — Röstgrad auf gemessener Skala

`Bean.agtron` liegt seit dem ersten Commit im Typ und wird nirgends
benutzt. Die grafische Skala aus Thema F ist der Anlass, das zu ändern:

```
data/formulas.json → agtronBands (neu, aus kb/05 §2.1)
  [{ min: 85, max: 95, level: "light",        label: "Extremely Light" },
   { min: 75, max: 85, level: "light",        label: "Light / Nordic" },
   { min: 65, max: 75, level: "medium-light", label: "Medium-Light" },
   { min: 55, max: 65, level: "medium",       label: "Medium" },
   { min: 45, max: 55, level: "medium-dark",  label: "Medium-Dark" },
   { min: 35, max: 45, level: "dark",         label: "Dark" },
   { min: 25, max: 35, level: "dark",         label: "Very Dark / French" }]
```

Zwei Richtungen, beide nützlich:

* **Agtron bekannt** → Skala zeigt die gemessene Position, Etikett aus dem
  Band. kb/05 verlangt sogar, dass Agtron die Vorgaben bestimmt und nicht
  `roastLevel` — das wäre eine Engine-Änderung und bleibt vorerst außen
  vor (§6.5).
* **Nur `roastLevel`** → Skala zeigt die Mitte des zugehörigen Bandes,
  optisch als Bereich statt als Punkt. Der Unterschied „gemessen" gegen
  „geschätzt" muss sichtbar sein, sonst behauptet die Grafik Präzision,
  die nicht da ist. Das ist die Regel, die dieses Projekt sich in
  `docs/04-faktencheck.md` selbst gegeben hat.

**Darstellung.** Statt Flamme: eine Bohne, die entlang der Skala von
hellem Beige nach dunklem Braun läuft, mit einer Marke an der Position.
Die Flamme wäre Röstwärme, nicht Röstgrad — und die App hat mit
`--c-crema` bis `--c-ink` die Farbverläufe schon im Token-Satz. Sekundär
kann die Bohnenfarbe dieselbe Funktion in der Listenzeile übernehmen
(§4.5), womit ein Element zwei Themen bedient.

---

## 5. Reihenfolge

Vier Pakete. Jedes ist für sich lieferbar und lässt die App benutzbar.

**Paket 1 — Fundament (A + C)**
Navigationsleiste, Route-Umbau, `bestBeansFor(method)`. Danach kann man
von der Methode aus brühen. Ohne neue Methoden, ohne neue Icons.
*Begründung: C ist billig und hat ohne A keinen Ort, A ist ohne C eine
leere Hülle.*

**Paket 2 — Profil (F + G)**
Die sechs Blöcke neu geschichtet, Agtron-Bänder, Roast- und
Process-Grafik, Kartenlegende mit Farben je Herkunft.
*Begründung: reine Darstellung auf vorhandenen Daten, kein Risiko, sofort
sichtbarer Gewinn.*

**Paket 3 — Katalog (B)**
Dreistufiges Methodenmodell, Sperre gegen `announced` in der Engine,
Favoriten, Icons für alle Katalogeinträge. Dann **eine** echte neue
Methode als Beweis, dass die Stufe trägt — Vorschlag Filterkaffeemaschine
oder Chemex, nicht Mokkakanne (§3.2).
*Begründung: Erst wenn der Rahmen steht, ist die zweite Methode billig.*

**Paket 4 — Regal (D + E)**
Filter, Bohne-im-Ring, Feinschliff der Listendarstellung.
*Begründung: hängt an nichts, profitiert aber von Paket 2.*

---

## 6. Offene Entscheidungen

Sechs Punkte, die ich nicht allein entscheiden sollte.

**6.1 Wo wohnt das Logbuch über alle Bohnen?**
Mit zwei Reitern ist der bohnenübergreifende Log ohne Einstieg. Optionen:
dritter Reiter (aber der Tester nennt zwei), im Zahnrad neben Setup, oder
auf `Coffee` als Kopfknopf. Neigung: **Kopfknopf auf Coffee** — dort steht
die Frage „was habe ich schon gebrüht?" am nächsten.

**6.2 Welche Methode wird als erste echte ergänzt?**
Der Tester nennt die Mokkakanne, sie ist aber die teuerste der
naheliegenden (§3.2). Meine Empfehlung ist die **Filterkaffeemaschine**
(verbreitet, billig) oder **Chemex** (V60-Nachbar, Spezialitätenbezug).
Wenn die Mokkakanne wirklich zuerst gebraucht wird, ist das in Ordnung —
dann kostet Paket 3 spürbar mehr.

**6.3 Cold Brew: Methode oder Modifier?**
Heute ein `IcedModifier` mit fachlicher Grundlage in kb/13. Als
Katalogeintrag wäre es doppelt modelliert. Neigung: **Modifier bleiben**
und im Methodenraster als Verweis führen, nicht als eigene Methode.

**6.4 Wo werden Favoriten gesetzt?**
Direkt am Icon im Raster (schnell, aber ein zusätzlicher Zustand pro
Kachel) oder gesammelt im Setup (aufgeräumter, aber weiter weg). Neigung:
**am Icon**, mit einer aufräumbaren Liste im Setup.

**6.5 Soll Agtron die Vorgaben bestimmen?**
kb/05 §2.1 verlangt es ausdrücklich. Es wäre eine Engine-Änderung mit
Wirkung auf jeden Startpunkt und gehört nicht in ein Darstellungspaket.
Neigung: **Agtron zunächst nur anzeigen**, die Vorgabenlogik als eigenes
Vorhaben.

**6.6 Bricht der Route-Umbau gespeicherte Adressen?**
`#/beans/<id>` würde zu `#/coffee/<id>`. Wie bei `shelf` (`f1213f6`)
braucht es eine Weiterleitung, sonst startet die installierte PWA nach
dem Update auf einem leeren Bildschirm. Kein Entscheidungsbedarf, nur
nicht vergessen — und der Router-Test deckt es ab.

---

## 6b. Was bei der Umsetzung anders kam

Dieses Dokument ist die Grundlage, nicht das Protokoll. Vier Stellen sind
beim Bauen anders entschieden worden, und zwar aus Gründen, die vorher
nicht sichtbar waren.

**Angekündigte Methoden sind kein Feld, sondern eine eigene Liste.**
§4.2 sah `tier: 'full' | 'announced'` am Methodenobjekt vor, mit einer
Sperre in `startingPoint`. Umgesetzt ist eine getrennte Liste `announced`
in methods.json mit eigenem Typ `AnnouncedMethod`. Der Unterschied ist
nicht Geschmack: Eine angekündigte Methode ist damit KEINE `BrewMethod`
und kann die Engine gar nicht erreichen — der Compiler hält die Sperre,
nicht eine Abfrage zur Laufzeit, die man vergessen kann. Der Preis ist,
dass eine Aufnahme in den vollen Katalog zwei Schritte kostet (Eintrag
verschieben, Typ erweitern). Das ist der richtige Preis: Danach zählt der
Compiler auf, was noch fehlt.

**Zeit und Mahlgrad hängen nicht überall zusammen — und der Code wusste
das nicht.** Die Regeln D-90/D-91 in diagnostics.json führen seit immer
ein `scope: ["espresso", "v60"]`. Gelesen wurde er nie; `runcheck.ts`
prüfte stattdessen auf Immersion, was bei vier Methoden dasselbe Ergebnis
hatte. Die Filterkaffeemaschine ist die erste Methode, bei der es
auseinandergeht: Perkolation, aber die Durchlaufzeit gehört der Pumpe
(kb/10c §4). Ohne die neue Prüfung `timeSignalsGrind()` hätte die App bei
einer verkalkten Maschine „mahle gröber" empfohlen — mit hoher
Zuversicht, weil D-91 als sichere Regel geführt ist. Das war der
teuerste Fund dieses Pakets und hat nichts mit der Oberfläche zu tun.

**Ein Startpunkt darf nichts vorschlagen, was das Gerät nicht kann.**
Die Brühtemperatur der Maschine liegt geräteseitig bei 92–96 °C. Die
Modifikatoren für Röstgrad, Höhe und Koffein rechnen trotzdem eine
Temperatur — fachlich richtig, praktisch nicht ausführbar. Neu:
`tempAdjustable()`, und wo sie falsch ist, wird die Temperatur auf den
Gerätewert zurückgesetzt UND die Begründung entsprechend gekürzt. Der
erste Anlauf schrieb „dichtere Bohne, deshalb feiner und heißer" zwei
Zeilen über „die Brühtemperatur ist nicht einstellbar".

**Fünf Methoden sprengen den Umschalter.** `METHOD_SHORT` reichte bis
vier, bei fünf wurde „Maschine" zu „Masch…" und „AeroPress" war schon
vorher abgeschnitten. Der `SegmentedControl` nimmt jetzt Symbole und
stellt sie über eine kleine Beschriftung — die Icons aus §3.3 zahlen sich
damit an einer Stelle aus, für die sie nicht gedacht waren.

**Erledigte offene Entscheidungen:** 6.1 Kopfknopf auf Coffee (Paket 1) ·
6.2 Filterkaffeemaschine (Paket 3) · 6.3 Cold Brew bleibt Modifier ·
6.4 Auswahl an der Liste selbst, kein zweiter Ort im Setup ·
6.5 Agtron wird angezeigt, nicht gerechnet (Paket 2) ·
6.6 Weiterleitung steht, Router-Test deckt sie ab.

---

## 7. Was dieses Dokument nicht klärt

* **Keine Icons entworfen.** §3.3 legt Stil und Unterscheidungsmerkmale
  fest, die Zeichnungen entstehen beim Bauen.
* **Keine Texte formuliert.** Die Teaser der angedeuteten Methoden sind
  Fachaussagen und entstehen mit dem jeweiligen Wissenskapitel.
* **Kein Aufwand in Stunden.** Die Größenklassen aus §2 tragen die
  Reihenfolge; genauer wird es erst mit den Entscheidungen aus §6.
