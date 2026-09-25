# Brew Buddy

**Persönliches Dial-in-Werkzeug für Espresso, V60, AeroPress,
French Press und Filterkaffeemaschine.**
Läuft als PWA auf dem iPhone. Vollständig offline, ohne Konto, ohne Cloud.

### → **[brewbuddy.garciahub.de](https://brewbuddy.garciahub.de/)**

> Nicht noch eine Rezeptdatenbank. Brew Buddy lernt, wie **du** brühst und was
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
des Wassers ist gar nicht durch den Kaffee gelaufen. Brew Buddy sperrt dann **jede**
Mahlgradempfehlung und verweist auf die Verteilung. Genauso bei „sauer *und*
bitter": das ist ungleichmäßige Extraktion, kein Mahlgradproblem.

**3 · Sie rechnet die Frische mit.**
Kaffee gast wochenlang CO₂ aus, das Bett bietet weniger Widerstand, der Shot
läuft schneller — ohne dass sich am Rezept etwas geändert hätte. Brew Buddy kennt
das Röstdatum deines letzten guten Shots und korrigiert automatisch:
*„Die Bohne ist 14 Tage älter — einen Klick feiner."*

**4 · Sie kennt die Grenze deiner Bohne.**
Ein heller kenianischer Washed ergibt selten einen ausgewogenen Espresso. Das
ist kein Anwenderfehler, sondern eine Materialeigenschaft — und Brew Buddy sagt es
**vorher**, statt dich in eine aussichtslose Schleife laufen zu lassen.

**5 · Sie hört auf, wenn Weiterdrehen nichts bringt.**
Dreimal feiner ohne Besserung, dafür jetzt auch bitter? Das ist das Muster
einer unterentwickelten Röstung. Brew Buddy bricht ab und benennt es.

---

## Installation auf dem iPhone

1. **[brewbuddy.garciahub.de](https://brewbuddy.garciahub.de/)** in **Safari** öffnen
2. Unten auf **Teilen** tippen (Quadrat mit Pfeil nach oben)
3. Nach unten wischen zu **Zum Home-Bildschirm**
4. Oben rechts auf **Hinzufügen**

Danach startet Brew Buddy im Vollbild und funktioniert ohne Internet.

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
│   │            · Wette (Vorhersagen einlösen) · Überzeugung · Heute
│   │            · Getränke (was aus dem Shot wird)
│   ├── screens/ Coffee (Regal · Profil · Formulare) · Brew (Startpunkt ·
│   │            Erfassen · Phasen) · Logbuch · Setup
│   ├── components/  Bausteine, Bohnengrafik, Mahlgradräder, Wischgeste
│   └── store/   Ereignisstrom (die Wahrheit) + Momentaufnahme + Migration
├── scripts/     Werkzeuge, u. a. die Kontrastprüfung
└── docs/        Briefing · Solution Design · Architektur · Audit · Roadmap
```

**Leitprinzip:** Fachwissen liegt in `data/*.json`, nicht im Code. Der Code ist
nur der Interpreter. Eine fachliche Korrektur ist eine Datenänderung.

---

## Entwicklung

```bash
npm install
npm run dev        # Entwicklungsserver
npm run pruefen    # alles auf einmal — dieselbe Kette wie in der CI
npm run build      # Produktions-Build (Typprüfung inklusive)
```

`npm run pruefen` läuft nacheinander durch und bricht beim ersten Fehler ab:

| Kommando | prüft |
|---|---|
| `npm run lint` | Fehlerklassen, die Typen und Tests nicht sehen — Hooks hinter Bedingungen, vergessene Abhängigkeiten, Refs beim Rendern |
| `npm run kontrast` | jede Textfarbe gegen jeden Untergrund, beide Themes, WCAG 2.1 AA |
| `npm run build` | Typen und Produktions-Build |
| `npm test` | 534 Tests |

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

Und seit dem Audit prüfen `src/store/*.test.ts` die Stellen, an denen Daten
verloren gehen könnten: was beim Start übernommen und was zurückgeschrieben
wird, die Kette „Bohne anlegen → brühen → protokollieren", und der Rundlauf
durch eine Sicherungsdatei.

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

Im Normalfall macht das die CI: Push auf `main` → Linter + Kontrastprüfung +
Typprüfung + Tests → Build → GitHub Pages. Nichts weiter zu tun.

**Wenn GitHub Actions ausgefallen ist** ([Status prüfen](https://www.githubstatus.com)):

```bash
npm run deploy:direct
```

Baut, pusht das Ergebnis auf `gh-pages` und stößt einen Pages-Build an — ohne
Actions. Danach steht Pages auf `legacy`. Sobald Actions wieder läuft:

```bash
npm run deploy:restore
```

> **Zwei Konten auf einem Rechner.** Privat (`Rafael-garcia27`) und
> geschäftlich liegen beide im Schlüsselbund. Welches gilt, entscheidet nicht
> `gh`, sondern eine `url.…insteadOf`-Regel in der Git-Konfiguration: Sie
> schreibt den passenden Benutzernamen in jede GitHub-URL, abhängig vom
> Verzeichnis. Solange das Projekt unter `~/Claude Projekte/Privat/` liegt,
> stimmt alles von allein — ein manuelles `gh auth switch` ist unnötig und
> hat schon einmal den Schlüsselbund gesperrt.
>
> Gibt ein Push 403, ist meist das hinterlegte Token veraltet:
> `gh auth token --user Rafael-garcia27` neu ablegen.

---

## Weitere Dokumente

| Datei | Inhalt |
|---|---|
| `CHANGELOG.md` | was sich für jemanden geändert hat, der die App benutzt |
| `docs/ARCHITECTURE.md` | wie die App gebaut ist, Datei für Datei belegt |
| `docs/AUDIT.md` | 19 Befunde mit Beleg, Schwere und Empfehlung |
| `docs/ROADMAP.md` | die Pakete daraus, mit Abnahmekriterien |
| `docs/PROGRESS.md` | was davon erledigt ist |
| `IDEAS.md` | was unterwegs auffiel und bewusst liegen blieb |

---

*Gebaut für ein iPhone 12, eine Sage Barista Express, eine Mylo SG2,
einen V60, eine AeroPress und eine French Press.*
