# Café

**Persönliches Dial-in-Werkzeug für Espresso, V60 und AeroPress.**
Läuft als PWA auf dem iPhone. Vollständig offline, ohne Konto, ohne Cloud.

### → **[cafe.garciahub.de](https://cafe.garciahub.de/)**

> Nicht noch eine Rezeptdatenbank. Café lernt, wie **du** brühst und was
> **dir** schmeckt — und sagt ehrlich, wenn das Problem gar nicht in den
> Parametern liegt.

---

## Was die App anders macht

**1 · Sie sagt, wie stark — nicht nur wohin.**
Aus „Shot lief 35 s statt 28 s" wird `√(35/28) = 1,12` → **3 Klicks gröber,
erwartete Zeit danach 28–29 s**. Die Vorhersage ist überprüfbar; trifft sie
ein, kann man auch der Geschmacksaussage glauben.

**2 · Sie hält den Mund, wenn Raten schädlich wäre.**
Bei Kanalbildung ist die gemessene Zeit physikalisch bedeutungslos — ein Teil
des Wassers ist gar nicht durch den Kaffee gelaufen. Café sperrt dann **jede**
Mahlgradempfehlung und verweist auf die Verteilung. Genauso bei „sauer *und*
bitter": das ist ungleichmäßige Extraktion, kein Mahlgradproblem.

**3 · Sie rechnet die Frische mit.**
Kaffee gast wochenlang CO₂ aus, das Bett bietet weniger Widerstand, der Shot
läuft schneller — ohne dass sich am Rezept etwas geändert hätte. Café kennt
das Röstdatum deines letzten guten Shots und korrigiert automatisch:
*„Die Bohne ist 14 Tage älter — einen Klick feiner."*

**4 · Sie kennt die Grenze deiner Bohne.**
Ein heller kenianischer Washed ergibt selten einen ausgewogenen Espresso. Das
ist kein Anwenderfehler, sondern eine Materialeigenschaft — und Café sagt es
**vorher**, statt dich in eine aussichtslose Schleife laufen zu lassen.

**5 · Sie hört auf, wenn Weiterdrehen nichts bringt.**
Dreimal feiner ohne Besserung, dafür jetzt auch bitter? Das ist das Muster
einer unterentwickelten Röstung. Café bricht ab und benennt es.

---

## Installation auf dem iPhone

1. **[cafe.garciahub.de](https://cafe.garciahub.de/)** in **Safari** öffnen
2. Unten auf **Teilen** tippen (Quadrat mit Pfeil nach oben)
3. Nach unten wischen zu **Zum Home-Bildschirm**
4. Oben rechts auf **Hinzufügen**

Danach startet Café im Vollbild und funktioniert ohne Internet.

> **Wichtig:** iOS löscht die Daten einer Web-App nach längerer Nichtnutzung.
> Die App erinnert an die Sicherung — bitte ernst nehmen, die Historie ist der
> eigentliche Wert.

---

## Der Ablauf

```
Bohne + Methode  →  Startpunkt mit Begründung  →  Timer  →  Ergebnis erfassen
                                                              ↓
        Referenz speichern  ←  eine begründete Korrektur  ←  verkosten
```

Drei Pflichtinteraktionen: **starten, stoppen, bewerten.** Alles andere ist
vorbelegt.

---

## Aufbau

```
Barista/
├── kb/          Fachwissen als Markdown — die Quelle der Wahrheit
│   ├── START-HIER.md   Kaffee von null, ohne Vorwissen (20 Min.)
│   ├── GLOSSAR.md      44 Begriffe, einzeln erklärt
│   └── 00–16           Extraktion, Formeln, Bohne, Wasser, Methoden, Diagnostik
├── data/        Dieselben Inhalte maschinenlesbar (JSON) — von der App geladen
├── types/       Domänenmodell + Rechenkern (reine Funktionen)
├── src/
│   ├── engine/  Startpunkt · Diagnose · Frische · Mühle · Lernen · Eignung
│   ├── screens/ Beans (Start) · Brühen · Logbuch · Setup
│   └── store/   Zustand + IndexedDB
└── docs/        Briefing · Solution Design · Vergleich mit dem Vorgänger
```

**Leitprinzip:** Fachwissen liegt in `data/*.json`, nicht im Code. Der Code ist
nur der Interpreter. Eine fachliche Korrektur ist eine Datenänderung.

---

## Entwicklung

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # 121 Tests gegen die Abnahmeszenarien
npm run build      # Produktions-Build
```

### Tests

Die Tests sind der Beleg, dass die App tut, was zugesagt wurde — vor allem in
den Fällen, in denen sie **nicht** das Naheliegende tun darf:

| Szenario | Erwartung |
|---|---|
| „sauer und bitter" | keine Mahlgradempfehlung, sondern Technikhinweis |
| Kanalbildung erkannt | Zeit gilt als ungültig, Korrektur gesperrt |
| Extraktion gut, schmeckt flach | Verdacht aufs Wasser, nicht aufs Rezept |
| Bohne 3 Tage alt | kein Einmessen empfohlen |
| 3× feiner ohne Besserung | Abbruch, Verdacht auf die Röstung |
| 20 Durchgänge protokolliert | persönliche Tendenz wird benannt |
| Korrektur wäre 19 Klicks | auf 5 gedeckelt, Deckelung wird erklärt |

Zusätzlich prüft `types/domain.test.ts` jedes in `kb/` ausgerechnete Beispiel
gegen die Implementierung — von der Extraktionsausbeute bis zur Eismenge beim
Japanese Iced Coffee.

---

## Bewusste Nicht-Ziele

- ❌ **Keine KI zur Laufzeit** — die Empfehlung muss reproduzierbar,
  offline und nachvollziehbar sein. Das Fachwissen steckt in `kb/` und `data/`,
  eingeflossen zur Bauzeit.
- ❌ **Kein Konto, keine Cloud, kein Tracking** — alle Daten bleiben auf dem Gerät
- ❌ **Keine Community-Rezepte** — fremde Rezepte kennen weder deine Mühle noch
  dein Wasser noch deinen Geschmack
- ❌ **Kein Refraktometer nötig** — die Engine funktioniert ohne Messgerät
- ❌ **Nie mehr als eine Empfehlung** — zwei gleichzeitige Änderungen machen das
  Ergebnis uninterpretierbar

---

## Fachliche Grundlage

Alle Zahlen stammen aus `kb/` und sind dort mit Konfidenz gekennzeichnet:

- 🟢 **gesichert** — physikalisch belegt oder normiert (SCA)
- 🟡 **etabliert** — breiter Branchenkonsens
- 🟠 **heuristisch** — Erfahrungswert, wird aus deinen Daten überschrieben

🟠-Werte darf die App aus deiner Historie lernen. 🟢-Werte sind harte Grenzen
(Milch über 70 °C, Extraktion über 30 %) und bleiben unantastbar.

---

## Deployment

Im Normalfall macht das die CI: Push auf `main` → Typprüfung + Tests → Build →
GitHub Pages. Nichts weiter zu tun.

**Wenn GitHub Actions ausgefallen ist** ([Status prüfen](https://www.githubstatus.com)):

```bash
npm run deploy:direct
```

Baut, pusht das Ergebnis auf `gh-pages` und stößt einen Pages-Build an — ohne
Actions. Danach steht Pages auf `legacy`. Sobald Actions wieder läuft:

```bash
npm run deploy:restore
```

> **Achtung, zwei Konten:** Auf diesem Rechner liegt im Schlüsselbund die
> CogniCore-Anmeldung (`Rafael-278`) für github.com, und sie antwortet vor dem
> gh-Helfer. Neue Repos pushen deshalb standardmäßig unter dem falschen Konto.
> Die Deploy-Skripte umgehen das. Dauerhafte Behebung: siehe
> `docs/04-faktencheck.md` §10.

---

*Gebaut für ein iPhone 12, eine Espressomühle, einen V60 und eine AeroPress.*
