# 10c — Filterkaffeemaschine

> **Fachbegriffe?** Einstieg ohne Vorwissen: [START-HIER.md](START-HIER.md) ·
> Einzelne Begriffe: [GLOSSAR.md](GLOSSAR.md)

Dieselbe Physik wie der V60 — Schwerkraft durch Papier —, aber die Hälfte der
Variablen gehört der Maschine. Das macht sie zur verlässlichsten und zur
unbeweglichsten Methode dieser App.

---

## 1. Warum die Maschine anders zu bedienen ist

| Eigenschaft | Konsequenz |
| ----------- | ---------- |
| **Temperatur ist eingebaut** | Zertifizierte Brühgeräte liegen bei 92–96 °C am Bett. Einstellen kann man das an den meisten Geräten nicht. Der stärkste Hebel gegen Bitterkeit fällt damit weg. |
| **Agitation ist fest** | Der Brühkopf gießt, wie er gießt. Kein Zentrumsgruß, kein Rühren, keine Gusszahl. Was am Handfilter Technik ist, ist hier eine Geräteeigenschaft. |
| **Zeit ist fast fest** | Die Durchlaufzeit bestimmt die Pumpe, nicht der Mahlgrad. Ein Klick feiner verlängert am Handfilter deutlich, hier kaum. |
| **Tiefes Bett** | Große Mengen liegen hoch im Korb. Das mittelt Unterschiede aus — und bestraft ungleichmäßiges Befüllen mit Kanalbildung, die man nicht sieht. |
| **Papier wie beim V60** | Öle und Fines bleiben zurück. Klarheit und Körper liegen dadurch nah am Handfilter. |

**Die entscheidende praktische Folge:** Es bleiben drei Hebel — Dose, Ratio,
Mahlgrad. Wer an einer Filtermaschine ein Temperaturproblem hat, muss es über
den Mahlgrad und die Ratio umgehen; er kann es nicht beheben. Deshalb ist die
Bohnenwahl hier wichtiger als bei jeder anderen Methode dieser App.

---

## 2. Zielkorridore

Grundlage ist der SCA *Golden Cup*: **55 g Kaffee je Liter Wasser ± 10 %**,
also 50–60 g/L. Umgerechnet auf die Verhältnisschreibweise dieser App
(Wasser je Gramm Kaffee):

| Angabe | Wert |
| ------ | ---- |
| Ratio | **1:16,5 – 1:20**, Standard 1:17 |
| Brühtemperatur | 92–96 °C, geräteseitig |
| Gesamtzeit | 4–6 min für eine volle Kanne |
| Mahlgrad | mittel, **700–1000 µm** — gröber als V60, feiner als French Press |
| Retentionswasser (LRR) | **2,0 g/g**, wie beim Papierfilter des V60 |

Die Zeit gehört ausdrücklich **nicht** zu den Diagnosegrößen: Sie ist
Geräteeigenschaft. Eine Kanne, die 7 Minuten braucht, hat ein verkalktes
Gerät, keinen zu feinen Mahlgrad.

### 2.1 Warum gröber als der V60

Zwei Gründe, die sich addieren:

1. **Das Bett ist tiefer.** 60 g Mehl im Korb liegen mehrere Zentimeter hoch.
   Der Strömungswiderstand wächst mit der Betthöhe; bei V60-Mahlgrad würde
   die Maschine überlaufen.
2. **Die Kontaktzeit ist länger.** 4–6 min gegen 2,5–3,5 min am V60. Bei
   gleichem Mahlgrad wäre die Extraktion überzogen.

---

## 3. Rezept

| Kanne | Dose | Wasser | Zeit |
| ----- | ---- | ------ | ---- |
| 2 Tassen | 20 g | 340 g | ~4 min |
| 4 Tassen | 35 g | 600 g | ~4,5 min |
| 6 Tassen | 55 g | 940 g | ~5 min |
| 8 Tassen | 70 g | 1190 g | ~5,5 min |

**Ablauf:** Filter einlegen, mit heißem Wasser durchspülen (Papiergeschmack
und kaltes Gerät in einem Schritt), Mehl einfüllen, Korb waagerecht
einschütteln, Wasser einfüllen, starten. Nach dem Durchlauf **sofort
umfüllen** — eine Warmhalteplatte kocht das Getränk weiter und macht in
20 Minuten aus einem guten Kaffee einen bitteren.

### 3.1 Der Spülschritt ist nicht optional

Er tut zwei Dinge gleichzeitig, und das zweite wird meist vergessen: Er
wäscht das Papier aus **und** wärmt Korb und Kanne vor. Kalte Keramik zieht
dem Aufguss messbar Temperatur — bei einer Methode, deren Temperatur man
nicht nachregeln kann, ist das der einzige Griff, der sie beeinflusst.

---

## 4. Diagnostik — was hier anders ist

| Beobachtung | Am Handfilter heißt das | An der Maschine heißt das |
| ----------- | ----------------------- | ------------------------- |
| Zu lange gelaufen | zu fein gemahlen | Gerät verkalkt oder Korb überfüllt |
| Sauer | zu grob, zu kalt, zu kurz | zu grob oder Ratio zu weit — Temperatur ist keine Option |
| Bitter | zu fein, zu heiß, zu lange | zu fein, zu lange auf der Platte gestanden |
| Ungleichmäßiges Bett | Gusstechnik | Korb schief oder Brühkopf verkalkt |

**Korrekturreihenfolge:** Mahlgrad → Ratio → Dose. Temperatur und Agitation
stehen nicht in der Liste, weil sie nicht zur Verfügung stehen. Das ist die
kürzeste Korrekturliste aller Methoden dieser App — und der Grund, warum sie
die verlässlichste ist: Wenige Hebel heißt wenige Fehlerquellen.

---

## 5. Eignung

Die Maschine liefert das Profil eines V60 mit weniger Klarheit und weniger
Kontrolle — dafür reproduzierbar und in Mengen.

- **Stark**: mittlere Röstungen, gewaschene Mittelamerikaner, Blends,
  schokoladig-nussige Profile. Alles, was keine feine Steuerung braucht.
- **Schwach**: helle nordische Röstungen. Sie brauchen Temperatur an der
  oberen Grenze und Zeit — beides gibt das Gerät nicht her. Nicht falsch,
  aber unter ihren Möglichkeiten.
- **Ausdrücklich gut**: alles, wovon man mehrere Tassen auf einmal will. Der
  eigentliche Vorteil ist nicht Geschmack, sondern Menge bei gleichbleibender
  Qualität.

---

## 6. Für die App

- `physics: gravity-percolation`, `channelingPossible: true`,
  `timeIsResult: false`, `agitationRelevant: false`
- `grindSensitivity: 0.7`, `timeSensitivity: 0.3` — beide niedriger als am
  V60, weil das tiefe Bett mittelt und die Zeit der Pumpe gehört.
- Kein Bloom, keine Gusszahl, keine Wassertemperatur zur Eingabe. Ein
  Startpunkt, der eine Temperatur vorschlägt, würde eine Einstellmöglichkeit
  behaupten, die das Gerät nicht hat.
- Die Zeit wird **erfasst, aber nicht als Mahlgradsignal ausgewertet**: Eine
  Abweichung deutet auf Kalk oder Überfüllung, nicht auf den Grind.
