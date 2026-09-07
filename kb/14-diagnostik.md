# 14 — Diagnostik: Symptom → Ursache → Korrektur

> **Fachbegriffe?** Einstieg ohne Vorwissen: [START-HIER.md](START-HIER.md) ·
> Einzelne Begriffe: [GLOSSAR.md](GLOSSAR.md)

Das Regelwerk der Diagnose-Engine. Maschinenlesbar in `data/diagnostics.json`.

---

## 1. Architektur

Die Engine läuft in vier Stufen. **Eine Stufe darf erst feuern, wenn alle
vorherigen leer sind.**

```
STUFE 0    GATES        Ist das Ergebnis überhaupt interpretierbar?
                        → Channeling, Messfehler, Bohne außerhalb des Fensters,
                          Wasserverdacht. Blockiert alle weiteren Stufen.
STUFE 0,5  LAUFKONTROLLE Zeit, Fluss und Beobachtungen — ohne Geschmack.
                        → Läuft VOR der Verkostung und trägt eine eigene
                          Korrektur. Siehe §3b.
STUFE 1    OBJEKTIV     Nur wenn TDS gemessen: Position im Brew Control Chart.
STUFE 2    SENSORISCH   Aus Fehlertags und Beobachtungen.
STUFE 3    AUSGABE      Genau EINE Korrektur, mit Zahl und Erwartungswert.
```

**Kardinalregel (kb/00 §7):** Pro Iteration wird **genau eine** Variable
geändert. Einzige Ausnahme: Stufe 1 mit vorliegender TDS-Messung, wo die zwei
orthogonalen Achsen (Mahlgrad und Ratio) gleichzeitig korrigiert werden dürfen.

---

## 2. Regelformat

```ts
interface DiagnosticRule {
  id: string                    // D-nn
  scope: BrewMethod[]           // für welche Methoden
  stage: 0 | 1 | 2
  priority: number              // 1 = zuerst
  when: string                  // auswertbare Bedingung
  cause: string                 // was los ist
  action: {
    variable: string
    direction: 'increase' | 'decrease' | 'technique' | 'none'
    delta?: number | string     // Zahl oder Formel-ID
    formulaRef?: string         // z. B. "F-22"
  }
  explanation: string           // Nutzertext, erklärt das WARUM
  confidence: 'high' | 'medium' | 'low'
  blocks?: string[]             // Regel-IDs, die dadurch unterdrückt werden
}
```

---

## 3. STUFE 0 — Gates

Diese Regeln blockieren alle Korrekturvorschläge, bis ihre Ursache behoben ist.
**Ohne diese Stufe schickt jede Kaffee-App ihre Nutzer früher oder später in
Endlosschleifen.**

### D-01 · Channeling erkannt (Espresso)

```
scope:     [espresso]
when:      flowState ∈ {uneven, spritzing}
           OR puckState ∈ {crater, sideChannel}
cause:     Ungleichmäßige Durchströmung des Pucks
action:    technique → Puck Prep
blocks:    ALLE Mahlgrad- und Ratio-Regeln
confidence: high
```

**Erklärung für den Nutzer:** *„Ein Teil des Wassers hat den Kaffee umgangen.
Die gemessene Zeit sagt deshalb nichts über deinen Mahlgrad aus — sie würde
dich in die falsche Richtung schicken. Zuerst die Verteilung korrigieren:
WDT, dann eben tampen, danach nicht mehr klopfen."*

**Maßnahmen in dieser Reihenfolge:** WDT → kalibrierter Tamper → nicht klopfen
→ Dosis prüfen (Headspace) → Korb prüfen.

### D-02 · Sauer UND bitter gleichzeitig

```
scope:     [espresso, v60, aeropress]
when:      defects ⊇ {sour, bitter}
           OR defects ⊇ {sour, astringent}
cause:     Ungleichmäßige Extraktion (nicht zu viel, nicht zu wenig)
action:    technique
blocks:    D-20…D-29 (Mahlgrad), D-30…D-39 (Ratio)
confidence: high
```

Methodenspezifische Maßnahme:
| Methode | Maßnahme |
| ------- | -------- |
| Espresso | WDT, ebener Tamp, Präinfusion verlängern |
| V60 | Nach dem Bloom swirlen, nicht aufs Papier gießen, Rao Spin |
| AeroPress | Mahlwerk prüfen (breite Verteilung) oder Röstung verdächtigen — Channeling ist hier unmöglich |

Der letzte Punkt ist wichtig: Bei der AeroPress kann dieses Symptom **nicht**
von ungleichmäßiger Durchströmung kommen. Die Engine muss hier direkt auf
Mühle oder Röstung verweisen (kb/10 §6).

### D-03 · Bohne zu frisch

```
when:      daysOffRoast < restWindow.min
cause:     CO₂ stört die Extraktion
action:    none — warten
confidence: high
```
*„Diese Bohne ist erst X Tage alt. Bis Tag Y sind Ergebnisse nicht stabil —
CO₂ verdrängt das Wasser. Warte noch Z Tage, bevor du einmisst."*

### D-04 · Bohne zu alt

```
when:      daysOffRoast > 60
cause:     Aromaverlust und Lipidoxidation
action:    none — Bohne ersetzen
confidence: high
blocks:    alle Korrekturregeln
```

### D-05 · Unplausible Messung

```
when:      ey > 26 OR ey < 12 OR tdsPct > 15
cause:     Messfehler
action:    none — Messung wiederholen
confidence: high
```
*„Prüfe: Probe gefiltert? Auf 20–25 °C abgekühlt? Espresso vor der Messung
durchgerührt? (Die Tasse ist geschichtet.) Prisma sauber?"* → kb/02 §I

### D-06 · Wasserverdacht

```
when:      ey ∈ [18, 22]
           AND rating ≤ 2
           AND defects ∋ flat
           AND defects ∌ {sour, bitter}
cause:     Vermutlich zu hohe Karbonathärte
action:    none — Wasser prüfen (kb/06)
confidence: medium
blocks:    alle Brühparameter-Regeln
```

**Das ist die wertvollste Regel der Sammlung.** Sie fängt genau den Fall ab, in
dem jede Brühkorrektur wirkungslos bleibt, weil die Ursache außerhalb des
Brühvorgangs liegt. Ohne sie dreht der Nutzer wochenlang am Mahlgrad.

### D-07 · Röstungsverdacht (Schleifenerkennung)

```
when:      letzte 3 Korrekturen alle in Richtung „feiner"
           AND rating hat sich nicht verbessert
           AND defects enthalten weiterhin sour
           AND defects haben zusätzlich bitter aufgenommen
cause:     Unterentwickelte Röstung (kb/05 §1.2)
action:    none — Bohne wechseln
confidence: medium
blocks:    alle
```

*„Du bist dreimal feiner gegangen. Die Säure ist geblieben und Bitterkeit ist
dazugekommen — das ist das Muster einer unterentwickelten Röstung, nicht einer
Unterextraktion. Diese Bohne wird mit keiner Einstellung ausgewogen. Probier
sie mit mehr Wasser und höherer Temperatur, oder wechsle sie."*

### D-08 · Dosierstreuung

```
scope:     [espresso]
when:      Standardabweichung von timeS über die letzten 5 Brews > 4 s
           bei identischem Rezept
cause:     Prozessstreuung, nicht Rezeptfehler
action:    technique
confidence: medium
```
Maßnahmen: auf 0,1 g wiegen · RDT · Single Dosing mit Purge · kalibrierter
Tamper. *„Bevor du das Rezept änderst, mach es erst wiederholbar."*

---

## 3b. STUFE 0,5 — Laufkontrolle

Maschinenlesbar in `data/diagnostics.json` unter `runCheck`.

Diese Stufe existiert, weil **kb/15 §3.1 Phase C und Phase D trennt**: Der
Mahlgrad wird über die Zeit gefunden, der Geschmack erst danach feinjustiert.
Eine Zeitabweichung ist ohne jeden Geschmackseindruck auswertbar — wer beides
in einem Schritt abfragt, mischt zwei Signale und kann das Ergebnis hinterher
keinem von beiden zuordnen.

**Der Ausfall, der dazu geführt hat:** Ein Espresso mit 19 s bei 25 s
Zielmitte und leerem Tasting bekam „keine klare Korrektur". Die Zeit allein
enthielt die Antwort; die Engine hat auf einen Fehlertag gewartet, der nie
kam. Regel: **Was die Uhr sagt, geht nie verloren.**

### 3b.1 Zeitbänder

Bezugsgröße ist die Zielmitte, Toleranz aus `methods.json`.

| Band | Bedingung | Konfidenz der Korrektur |
| ---- | --------- | ----------------------- |
| `aborted` | `t < 0,35 × Ziel` | keine — Durchgang wiederholen |
| `farFast` / `farSlow` | Abweichung > 20 % der Zielzeit | sicher |
| `fast` / `slow` | Abweichung > Toleranz, ≤ 20 % | wahrscheinlich |
| `onTarget` | Abweichung ≤ Toleranz | keine — das ist Wiederholgenauigkeit |

Die Konfidenz kommt aus der **Schwere der Abweichung**, nicht aus der Regel:
F-22 ist immer dieselbe Physik, aber vier Sekunden auf fünfundzwanzig sind ein
schwächeres Signal als zehn.

### 3b.2 Regeln

| ID | Bedingung | Korrektur |
| -- | --------- | --------- |
| D-90 | Zeit unter Ziel, Perkolation | Mahlgrad feiner (F-22) |
| D-91 | Zeit über Ziel, Perkolation | Mahlgrad gröber (F-22) |
| D-92 | Zeit im Band | keine |
| D-93 | Eindruck **bestätigt** die Zeit | Konfidenz eine Stufe höher |
| D-94 | Eindruck **widerspricht** der Zeit | Zahl gewinnt, Konfidenz eine Stufe tiefer |
| D-95 | Eindruck ohne messbare Abweichung | **ein** Schritt, Konfidenz „Versuch" |
| D-96 | Immersion, Zeit ≠ geplant | `steepS` — **nie** Mahlgrad (kb/10b §6) |
| D-97 | Immersion, Presswiderstand ≠ normal | Mahlgrad (einziges mechanisches Signal) |
| D-98 | Bohne im Ruhefenster **und** zu langsam | keine — CO₂, nicht Mahlgrad |
| D-99 | Bohne über dem Fenster **und** zu schnell | feiner, als Alterskorrektur (F-32) |
| D-9A | Streuung der letzten 5 Zeiten > 4 s | Empfehlung bleibt, Konfidenz sinkt (→ D-08) |

### 3b.3 Der eigene Eindruck als zweites Signal

Erfasst wird `perceivedSpeed ∈ {tooFast, onPoint, tooSlow}` — bei Immersion als
Presswiderstand formuliert, weil dort nichts durch ein Bett fließt.

Der Wert ist nicht die Wiederholung der Zeit, sondern ihre **Kreuzprobe**:

- Beide gleich → zwei unabhängige Signale in dieselbe Richtung (D-93)
- Nur der Eindruck → zu wenig für eine Rechnung, genug für einen Schritt (D-95)
- Widerspruch → die Zahl gewinnt, und der Widerspruch selbst ist der Befund (D-94)

### 3b.4 Was hier gesperrt bleibt

Dieselben Sperren wie Stufe 0, aber vor der Verkostung geprüft:

| Sperre | Warum |
| ------ | ----- |
| Channeling (D-01) | Die Zeit ist physikalisch bedeutungslos |
| Abbruch | Aus einem halben Durchgang folgt nichts |
| Immersion (kb/10b §6) | Zeit ist gewählt, nicht Ergebnis |
| Bohne zu frisch (D-03) | CO₂ baut Widerstand auf, den kein Mahlgrad erklärt |

### 3b.5 Zusammenführung mit Stufe 2

Beide Stufen können den Mahlgrad wollen. Die Kardinalregel bleibt: **eine**
Korrektur.

| Fall | Ergebnis |
| ---- | -------- |
| Gleiche Richtung | Zahl aus F-22, Begründung aus beiden, Konfidenz `sicher` |
| Nur Laufkontrolle | Ihre Korrektur ist das Ergebnis |
| Nur Sensorik | Die Methodenkaskade entscheidet (§6) |
| **Gegenläufig** | Eigene Diagnose — siehe unten |

Der gegenläufige Fall ist der wertvollste, weil er sonst zu einer geratenen
Empfehlung führt:

- **Lang gelaufen und trotzdem sauer** — bei so viel Kontakt fehlt keine
  Extraktion, sie war *ungleichmäßig*. Gröber würde die untererschöpfte
  Fraktion vergrößern, feiner die erschöpfte. Also **kein Mahlgrad**, sondern
  Gleichmäßigkeit, dann die Eskalationsleiter (kb/15 §6).
- **Kurz gelaufen und trotzdem bitter** — der Mahlgrad kann es nicht sein:
  feiner wäre für die Zeit richtig und für den Geschmack falsch. Wirksam ist
  die Temperatur, weil sie die Selektivität verschiebt (kb/10 §5.1). Steht sie
  am unteren Ende der Methode, bleibt nur Verteilung, Dosis oder Röstung.

---

## 4. STUFE 1 — Objektive Diagnose (nur mit TDS-Messung)

Position im Brew Control Chart (kb/01 §2.1) bestimmt die Korrektur.
Zielkorridore: EY 18–22 %, TDS Filter 1,15–1,45 %, Espresso 8–11 %.

| ID | EY | TDS | Diagnose | Korrektur |
| -- | -- | --- | -------- | --------- |
| **D-10** | < 18 | < Ziel | zu dünn + unterextrahiert | Mahlgrad feiner **und** Ratio enger |
| **D-11** | < 18 | in Ziel | unterextrahiert, Stärke ok | Mahlgrad feiner |
| **D-12** | < 18 | > Ziel | zu stark + unterextrahiert | Mahlgrad feiner **und** Ratio weiter |
| **D-13** | in Ziel | < Ziel | zu dünn, Extraktion ok | Ratio enger (weniger Wasser) |
| **D-14** | in Ziel | in Ziel | ✅ **im Zielkorridor** | keine — als Referenz speichern |
| **D-15** | in Ziel | > Ziel | zu stark, Extraktion ok | Ratio weiter (mehr Wasser) |
| **D-16** | > 22 | < Ziel | zu dünn + überextrahiert | Mahlgrad gröber **und** Ratio enger |
| **D-17** | > 22 | in Ziel | überextrahiert, Stärke ok | Mahlgrad gröber |
| **D-18** | > 22 | > Ziel | zu stark + überextrahiert | Mahlgrad gröber **und** Ratio weiter |

**Korrekturgröße:**
- Mahlgrad: über **F-22** aus der Zeitabweichung, sonst 2 Schritte
- Ratio: `ΔEY-Bedarf / 2` in Ratio-Punkten, mindestens 0,1

**Wichtig:** D-14 ist keine leere Regel. Sie muss aktiv feuern und den Brew als
Referenz vorschlagen — positive Rückmeldung ist Teil der Diagnose. Nur so
entsteht die Datenbasis für personalisierte Defaults (kb/00 §8).

---

## 5. STUFE 2 — Sensorische Diagnose

Greift, wenn keine Messung vorliegt. Grundlage: die **Fehlerachse** (kb/16 §2),
nicht die Charakterachse.

### 5.1 Unterextraktion

| ID | Bedingung | Methode | Korrektur | Konfidenz |
| -- | --------- | ------- | --------- | --------- |
| D-20 | `sour` ∧ `salty` | alle | Mahlgrad feiner (F-22 oder 2 Schritte) | high |
| D-21 | `sour` ∧ `thin` ∧ `shortFinish` | alle | Mahlgrad feiner | high |
| D-22 | `sour`, Zeit < Ziel −15 % | espresso | Mahlgrad feiner (F-22) | high |
| D-23 | `sour`, Zeit im Ziel | alle | Temperatur +2 °C | medium |
| D-24 | `sour`, Temp bereits ≥ 96 °C | alle | Ratio weiter (mehr Wasser) | medium |
| D-25 | `sour` ∧ drawdown `fast` | v60 | Mahlgrad feiner **oder** mehr Güsse | high |
| D-26 | `sour` | aeropress | **+1 Rührvorgang** (vor Mahlgrad!) | high |

> **D-26 ist eine bewusste Abweichung.** Bei der AeroPress ist Agitation der
> schnellere, reversiblere Hebel als der Mahlgrad (kb/10 §5.2). Die Engine
> sollte hier nicht dem Espresso-Reflex folgen.

### 5.2 Überextraktion

| ID | Bedingung | Methode | Korrektur | Konfidenz |
| -- | --------- | ------- | --------- | --------- |
| D-30 | `bitter` ∧ `astringent` | alle | Mahlgrad gröber (F-22 oder 2 Schritte) | high |
| D-31 | `bitter` ∧ `harsh`, Zeit > Ziel +15 % | espresso | Mahlgrad gröber (F-22) | high |
| D-32 | `bitter`, Zeit im Ziel | alle | Temperatur −2 °C | medium |
| D-33 | `bitter`, Temp bereits ≤ 90 °C | alle | Ratio enger | medium |
| D-34 | `bitter` ∧ drawdown `slow/stalled` | v60 | Mahlgrad gröber, weniger Agitation | high |
| D-35 | `bitter` | aeropress | **Temperatur −5 °C** (vor Mahlgrad!) | high |
| D-36 | `bitter` ∧ roastLevel dark | alle | Temperatur −3 °C, Ratio enger | high |

> **D-35:** Bei der AeroPress ist die Temperatur der stärkste Bitterkeitshebel
> — sie verschiebt die Selektivität zugunsten der süßen Fraktion (kb/10 §5.1).

### 5.3 Stärke ohne Extraktionsfehler

| ID | Bedingung | Korrektur |
| -- | --------- | --------- |
| D-40 | `watery`, keine Fehltöne | Ratio enger (weniger Wasser) |
| D-41 | „zu intensiv", geschmacklich sauber | Ratio weiter — **oder** Bypass (F-15) bei AeroPress |
| D-42 | `watery` ∧ `bitter` | Ratio enger **und** Mahlgrad gröber |

**Zu D-41:** Bypass ist hier korrekt, weil kein Extraktionsfehler vorliegt
(F-14). Bei `bitter` wäre er falsch — er verdünnt nur bittere Flüssigkeit.
Die Engine muss diese Unterscheidung durchhalten.

### 5.4 Flussprobleme (Espresso)

| ID | Bedingung | Korrektur |
| -- | --------- | --------- |
| D-50 | `choked` (> 45 s) | 3–4 Schritte gröber, Dosis −0,5 g |
| D-51 | `gusher` (< 15 s) | erst Prep prüfen (D-01), dann 3–4 Schritte feiner |
| D-52 | `slow` | F-22 |
| D-53 | `fast` | F-22 |
| D-54 | `puckState = wet-soupy` | Dosis +0,5 g oder Ratio enger |

### 5.5 V60-spezifisch

| ID | Bedingung | Korrektur |
| -- | --------- | --------- |
| D-60 | `stalled` (Drawdown > 45 % der Zeit) | 2 Schritte gröber; Filtermarke prüfen |
| D-61 | Bloom `uneven` | nach dem Bloom swirlen; langsamer gießen |
| D-62 | Bloom `vigorous` | Bohne sehr frisch → Bloom auf 45 s verlängern |
| D-63 | Bloom `flat` | Bohne alt **oder** Wasser zu kalt |
| D-64 | Kaffeekuchen mit Krater | breiter kreisen; Rao Spin |
| D-65 | Kaffeekuchen schräg | gleichmäßiger gießen; Dripper eben stellen |
| D-66 | Zeit > Ziel, aber Dosis > 25 g | **kein Fehler** — Zielzeit skalieren (kb/03 §2) |

**D-66 ist eine Anti-Regel:** Sie verhindert, dass die Engine bei großen
Dosen fälschlich Überextraktion diagnostiziert, weil sie eine feste Zielzeit
annimmt.

### 5.6 Milchgetränke

| ID | Bedingung | Korrektur |
| -- | --------- | --------- |
| D-70 | Schaum blasig, matt | Phase 1 kürzen, Wirbel in Phase 2 verbessern |
| D-71 | Schaum trennt sich vom Getränk | zu viel Luft → weniger Stretching |
| D-72 | Milch schmeckt gekocht/schweflig | Zieltemperatur > 70 °C → auf 60 °C |
| D-73 | Kaffee geht in der Milch unter | Ristretto-Basis; Milchmenge reduzieren |
| D-74 | Pflanzenmilch geronnen | Barista-Version; Temp −5 °C; Milch in den Kaffee gießen |
| D-75 | Latte Art misslingt | Textur, nicht Technik → kb/11 §4.2 |

### 5.7 Iced

| ID | Bedingung | Korrektur |
| -- | --------- | --------- |
| D-80 | Iced schmeckt wässrig | Ratio enger; Eisanteil senken; Kaffee-Eiswürfel |
| D-81 | Iced schmeckt sauer | Flash Chill: 1 Schritt feiner, Temp +2 °C |
| D-82 | Cold Brew holzig/papierig | Ziehzeit auf < 18 h reduzieren |
| D-83 | Cold Brew sauer und dünn | Ziehzeit auf ≥ 12 h erhöhen; feiner mahlen |
| D-84 | Cold Brew bei heller Röstung enttäuschend | **kein Fehler des Nutzers** → Flash Chill empfehlen |

---

## 6. Konfliktauflösung

Wenn mehrere Regeln feuern:

```
1. STUFE 0 gewinnt IMMER und blockiert alles Weitere.
2. Innerhalb einer Stufe gewinnt die niedrigste `priority`.
3. Bei gleicher Priorität gewinnt die höhere `confidence`.
4. Bei Gleichstand gewinnt die Variable mit der höheren Sensitivität
   (kb/03): Mahlgrad > Ratio > Temperatur > Technik > Druck.
5. Es wird IMMER nur eine Korrektur ausgegeben —
   außer bei Stufe 1 mit TDS-Messung (Mahlgrad + Ratio).
```

### Korrekturkaskade

```
Priorität 1   Mahlgrad
Priorität 2   Ratio / Ausbringung
Priorität 3   Temperatur
Priorität 4   Technik (Agitation, Güsse, Rühren, Puck Prep)
Priorität 5   Druck, Präinfusion, Dosis
```

Ausnahmen (methodenspezifisch, oben begründet):
- **AeroPress:** Agitation (D-26) und Temperatur (D-35) rücken vor den Mahlgrad
- **V60:** Gießtechnik rückt vor den Mahlgrad, wenn `bloomBehavior = uneven`

---

## 7. Schleifenerkennung

Die Engine muss merken, wenn sie nicht weiterkommt — sonst wird sie zur
Ratemaschine.

```js
if (last3Corrections.allSameDirection() && !ratingImproved()) {
  // Nicht weiter in dieselbe Richtung
  escalate([
    'Röstung prüfen (D-07)',
    'Wasser prüfen (D-06)',
    'Frische prüfen (D-03/D-04)',
    'Mühle prüfen (Alignment, Schärfe)',
    'Bohne wechseln'
  ])
}

if (correctionOscillates()) {   // feiner → gröber → feiner
  // Das Optimum liegt zwischen den beiden Punkten
  suggest('Mittelwert der letzten beiden Einstellungen; ' +
          'ab jetzt in halben Schritten')
}
```

Die Oszillationsregel ist praktisch wertvoll: Wer zwischen zwei Einstellungen
hin- und herspringt, hat das Optimum bereits eingegrenzt und braucht nur eine
feinere Schrittweite — nicht eine neue Richtung.

---

## 8. Ausgabeformat

Jeder Vorschlag enthält **fünf** Elemente:

```
1. WAS      „3 Klicks gröber (≈ +40 µm)"
2. WARUM    „Dein Shot lief 35 s statt 28 s — das Bett ist zu dicht."
3. ERWARTUNG „Erwartete Zeit danach: 28–29 s. Weniger Bitterkeit."
4. KONFIDENZ „Sicher" / „Wahrscheinlich" / „Versuch"
5. ALTERNATIVE „Wenn das nicht hilft: Temperatur um 2 °C senken."
```

**Beispielausgabe:**

> **3 Klicks gröber** (≈ +40 µm)
> Dein Shot lief 35 s statt 28 s bei sonst gleichem Rezept — das Bett ist zu
> dicht. Berechnet nach dem Durchflussgesetz: √(35/28) = 1,12, also 12 %
> gröber.
> **Erwartung:** 28–29 s, spürbar weniger Bitterkeit und Trockenheit.
> **Konfidenz:** sicher.
> **Falls nicht:** Temperatur auf 91 °C senken.

Punkt 3 ist der wichtigste. Eine Erwartung, die man überprüfen kann, macht die
App überprüfbar — und damit vertrauenswürdig. Wenn die vorhergesagte Zeit
eintrifft, glaubt der Nutzer auch der Geschmacksvorhersage.

---

## 9. Was die Engine NICHT tun darf

| Verbot | Grund |
| ------ | ----- |
| Zwei Variablen gleichzeitig ändern (außer Stufe 1) | Ergebnis wird uninterpretierbar |
| Mahlgrad bei Channeling vorschlagen | Zeit ist dann bedeutungslos |
| Bypass gegen Bitterkeit vorschlagen | F-14 — verdünnt nur bittere Flüssigkeit |
| Zeit als Stellgröße anbieten | Zeit ist Ergebnis, nicht Eingabe |
| Eine feste V60-Zielzeit für alle Dosen | skaliert mit der Dosis (D-66) |
| Positive Charaktertags als Fehler behandeln | `bright`, `fruity` sind keine Defekte |
| Endlos in eine Richtung korrigieren | Schleifenerkennung §7 |
| Eine Zeitabweichung ohne Fehlertag verschweigen | Die Zeit ist ein Befund für sich (§3b) |
| Nach dem Eindruck korrigieren, wenn die Uhr widerspricht | Die Zahl ist reproduzierbar, der Eindruck nicht (D-94) |
| Bei Immersion aus der Zeit auf den Mahlgrad schließen | Die Zeit ist dort gewählt (D-96, kb/10b §6) |
| Bei `isDecaf` normale Defaults verwenden | kb/05 §6 |
| Bei gemessener TDS die Sensorik überstimmen lassen | Messung hat Vorrang |
