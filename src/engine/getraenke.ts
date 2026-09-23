/**
 * Was aus einem Shot wird.
 *
 * `data/drinks.json` beschreibt 35 Getränke mit Mengen, Reihenfolgen und
 * Gläsern — gerechnet auf einen Bezugsshot aus 18 g mit 36 g Ertrag. Wer
 * 20 g einwiegt und auf 42 g zieht, hat aber mehr Kaffee im Glas, und
 * ein Cortado mit den Mengen der Karte wäre dann ein anderes Getränk.
 *
 * Dieses Modul rechnet die Karte auf den Shot um, der tatsächlich
 * gelaufen ist. Es kennt keinen Browser und keinen Zustand: rein,
 * prüfbar, und ohne die Oberfläche testbar.
 *
 * ── Zur Skalierung
 *
 * Skaliert wird über die **Kaffeemasse im Glas**, nicht über die
 * Einwaage. Das ist die Größe, die der Barista am Glas sieht: doppelt so
 * viel Espresso, doppelt so viel Milch, gleiches Verhältnis. Die Karte
 * führt jede Zutat als finale Masse; der Faktor läuft deshalb glatt
 * durch alle Zutaten hindurch.
 *
 * Was NICHT mitskaliert: Rezepturen mit `scalable: false`. Ein
 * Cappuccino classico ist über Drittel definiert und ein Affogato über
 * zwei Kugeln Eis — das sind feste Formen, keine Verhältnisse.
 */
import type { RoastLevel } from '@domain'
import { DRINK_BASIS, DRINK_PRUEFUNGEN, ausEspresso } from '@/kb'
import type { Getraenk, Zutat } from '@/kb'

/** Der Shot, aus dem das Getränk werden soll. */
export interface Shot {
  doseG: number
  /** Der Ertrag in der Tasse — bei Espresso die Masse des Getränks. */
  yieldG: number
  roastLevel: RoastLevel
}

export interface Rezept {
  getraenk: Getraenk
  /** 1 = genau wie in der Karte. 1,2 = ein Fünftel mehr von allem. */
  faktor: number
  /** Espresso im Glas. */
  kaffeeG: number
  zutaten: Zutat[]
  /** Was am Ende im Glas steht. */
  gesamtG: number
  /** Milch VOR dem Aufschäumen — Dampf kondensiert und macht sie schwerer. */
  milchEingiessenG?: number
  /** Gelöste Feststoffe je 100 g Getränk. Ohne Angabe in der Karte: undefined. */
  intensitaetPct?: number
  /** Was an DIESEM Shot auffällt — nicht die Notizen der Karte. */
  hinweise: string[]
}

/**
 * Welche Prüfregel der Datei hier tatsächlich etwas prüft — und welche
 * nicht.
 *
 * `drinks.json` führt sieben Regeln unter `validation`. Vier davon
 * vergleichen eine Rezeptur mit ihren eigenen festen Zahlen: Ob ein
 * Espresso Macchiato „sehr kräftig" ist, hängt nicht vom Shot ab,
 * sondern steht in seiner Definition. Als Meldung wären sie eine
 * Konstante, die bei jedem Aufruf erscheint.
 *
 * Die Trennung steht hier, damit sie nicht nur in einem Kommentar lebt:
 * Ein Test hält beide Listen gegen die Datei. Kommt dort eine achte
 * Regel dazu, wird es rot, und jemand muss entscheiden, in welche Liste
 * sie gehört — statt dass sie stillschweigend nie ausgewertet wird.
 */
export const PRUEFUNGEN_AKTIV = ['intensityLow', 'intensityHighMilk'] as const

export const PRUEFUNGEN_KONSTANT = [
  // Fest je Rezeptur: der Macchiato IST kräftig, das Eisglas IST voll Eis.
  'tooFewShots',
  'milkDominates',
  'iceTooLittle',
  'iceTooMuch',
  // Greift nur bei Cold Brew — und Cold Brew baut nicht auf einem Shot
  // auf, taucht in dieser Karte also nicht auf.
  'coldBrewLightRoast',
] as const

/**
 * Wie viel Espresso die Karte für dieses Getränk vorsieht.
 *
 * Der Regelfall ist Bezugseinwaage mal Ratio. `shotYieldG` ist die
 * Ausnahme für Rezepturen, die eine feste Masse nennen statt eines
 * Verhältnisses.
 */
export function basisKaffeeG(d: Getraenk): number {
  return d.shotYieldG ?? DRINK_BASIS.espressoDoseG * d.baseRatio
}

/**
 * Gramm so runden, wie man sie abwiegt.
 *
 * Über zehn Gramm ist die erste Nachkommastelle Scheingenauigkeit — eine
 * Küchenwaage zeigt sie, aber niemand gießt 66,7 g Milch ab. Darunter
 * zählt sie: zwischen 15 und 17 g Milch im Macchiato liegt ein
 * sichtbarer Unterschied.
 */
function runde(g: number): number {
  return g >= 10 ? Math.round(g) : Math.round(g * 10) / 10
}

/**
 * Die Karte auf diesen Shot umgerechnet.
 *
 * Die Hinweise am Ende sind bewusst wenige. Vier der sieben Prüfregeln
 * in `drinks.json` vergleichen eine Rezeptur mit sich selbst — ihr
 * Ergebnis ist für ein Getränk immer dasselbe und ändert sich durch den
 * Shot nicht. Ein Espresso Macchiato ist laut `intensityHighMilk`
 * dauerhaft „sehr kräftig"; das ist keine Beobachtung, sondern seine
 * Definition. Gemeldet wird deshalb nur, was an DIESEM Durchgang anders
 * ist als in der Karte. Ausführlich in IDEAS.md.
 */
export function rezept(d: Getraenk, shot: Shot): Rezept {
  const basis = basisKaffeeG(d)
  const fest = d.scalable === false
  const faktor = fest ? 1 : shot.yieldG / basis
  const kaffeeG = runde(fest ? basis : shot.yieldG)

  const zutaten = d.components.map((c) => ({ ...c, massG: runde(c.massG * faktor) }))
  const gesamtG = runde(d.totalG * faktor)

  const hinweise: string[] = []

  /**
   * Die Stärke folgt dem Verhältnis, nicht der Menge.
   *
   * Beim Skalieren wachsen Feststoffe und Getränk gemeinsam — die
   * Konzentration bleibt. Sie ändert sich erst, wenn der Shot ein
   * anderes Verhältnis hat als die Karte: Gleiche Einwaage, längerer
   * Ertrag heißt dieselbe Menge Kaffee in mehr Flüssigkeit.
   */
  const istRatio = shot.yieldG / Math.max(0.1, shot.doseG)
  const abweichung = d.baseRatio / istRatio
  const intensitaetPct =
    d.intensityPct !== undefined ? Math.round(d.intensityPct * abweichung * 100) / 100 : undefined

  if (!fest && d.intensityPct !== undefined && Math.abs(abweichung - 1) > 0.12) {
    // Die Meldungstexte stehen in der Datei, damit sie dort geändert
    // werden können, wo auch die Rezepturen stehen.
    const duenner = abweichung < 1
    if (duenner) {
      hinweise.push(
        `${DRINK_PRUEFUNGEN['intensityLow']?.message ?? 'Sehr dünn — Ratio prüfen'} — dein Shot läuft 1:${
          Math.round(istRatio * 10) / 10
        }, die Karte rechnet mit 1:${d.baseRatio}.`,
      )
    } else if (d.category === 'milk') {
      hinweise.push(
        `${DRINK_PRUEFUNGEN['intensityHighMilk']?.message ?? 'Sehr kräftig — bitte prüfen'} — dein Shot läuft 1:${
          Math.round(istRatio * 10) / 10
        } statt 1:${d.baseRatio}.`,
      )
    }
  }

  // Röstgrad: manche Getränke setzen ihn voraus, andere bevorzugen ihn.
  // Der Unterschied steht in der Datei und gehört nicht eingeebnet.
  if (d.requiresRoast && !d.requiresRoast.includes(shot.roastLevel)) {
    hinweise.push(`Braucht eine hellere Röstung als diese.`)
  } else if (d.preferredRoast && !d.preferredRoast.includes(shot.roastLevel)) {
    hinweise.push(`Kommt mit hellen Röstungen besser — mit dieser geht es auch.`)
  }

  if (d.warnings) hinweise.push(...d.warnings)

  return {
    getraenk: d,
    faktor,
    kaffeeG,
    zutaten,
    gesamtG,
    ...(d.milkToPourG !== undefined ? { milchEingiessenG: runde(d.milkToPourG * faktor) } : {}),
    ...(intensitaetPct !== undefined ? { intensitaetPct } : {}),
    hinweise,
  }
}

/**
 * Die ganze Karte, auf diesen Shot gerechnet.
 *
 * Reihenfolge: erst die Milchgetränke, dann die mit Wasser, dann alles
 * Kalte, zuletzt das Besondere — und innerhalb jeder Gruppe von klein
 * nach groß. Das ist die Ordnung einer Karte im Café und nicht die der
 * Datei; wer einen Cortado sucht, sucht ihn nicht hinter dem Affogato.
 */
const GRUPPEN: Getraenk['category'][] = ['milk', 'water', 'iced', 'special', 'pure']

export function karte(shot: Shot): Rezept[] {
  return ausEspresso()
    .map((d) => rezept(d, shot))
    .sort((a, b) => {
      const g = GRUPPEN.indexOf(a.getraenk.category) - GRUPPEN.indexOf(b.getraenk.category)
      return g !== 0 ? g : a.gesamtG - b.gesamtG
    })
}

export const GRUPPENNAME: Record<Getraenk['category'], string> = {
  milk: 'Mit Milch',
  water: 'Mit Wasser',
  iced: 'Auf Eis',
  special: 'Besonderes',
  pure: 'Pur',
}

export const ZUTATNAME: Record<Zutat['kind'], string> = {
  milk: 'Milch',
  water: 'Wasser',
  ice: 'Eis',
  chocolate: 'Schokolade',
  cream: 'Sahne',
  syrup: 'Sirup',
  tonic: 'Tonic',
}

export const SCHAUM: Record<NonNullable<Zutat['foamClass']>, string> = {
  'microfoam-thin': 'dünner Mikroschaum',
  'microfoam-standard': 'Mikroschaum',
  airy: 'luftiger Schaum',
}
