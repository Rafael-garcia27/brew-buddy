/**
 * „Was brühe ich jetzt?" — vorweg beantwortet.
 *
 * Bisher standen zwei Einstiege nebeneinander: „welche Methode?" und
 * „welche Bohne?". Beide sind Fragen an jemanden, der es schon weiß. Wer
 * morgens um halb sieben in die Küche kommt, hat die Antwort im Kopf und
 * muss sie der App trotzdem zweimal eintippen.
 *
 * Hier wird sie vorweggenommen — aus drei Signalen, die alle schon im
 * Bestand stehen: was zuletzt gebrüht wurde, was um diese Uhrzeit
 * üblicherweise gebrüht wird, und welche Bohne gerade brühbereit ist.
 *
 * Ein Vorschlag, keine Entscheidung: Ein Tipp daneben führt ins Regal.
 *
 * Rein funktional, ohne Browser, ohne eigenen Zeitbegriff.
 */
import type { Bean, Bag, Brew, BrewMethod } from '@domain'
import type { Settings } from '@/domain'
import { bestBeansFor, type BeanRanking } from './suitability'
import { assessFreshness, type Freshness } from './freshness'

export interface HeuteVorschlag {
  bean: Bean
  bag?: Bag
  method: BrewMethod
  freshness: Freshness
  /** Warum diese Bohne — ein halber Satz, kein Absatz. */
  grund: string
  /** Warum diese Methode. */
  methodengrund: string
  /** Die übrigen, nach Brühbereitschaft sortiert. */
  weitere: BeanRanking[]
}

/** Wie weit eine Uhrzeit von einer anderen entfernt sein darf, um zu zählen. */
export const STUNDEN_FENSTER = 2

/** Ab wie vielen Durchgängen in diesem Fenster die Uhrzeit etwas aussagt. */
export const STUNDEN_BELEGE = 3

/**
 * Die Methode, die um diese Uhrzeit üblich ist.
 *
 * Wer morgens Espresso und nachmittags V60 macht, muss das nicht jedes
 * Mal sagen. Drei Durchgänge im Zweistundenfenster reichen als Beleg —
 * darunter ist es Zufall, und dann gilt die zuletzt benutzte.
 */
export function methodeZurStunde(brews: Brew[], stunde: number): BrewMethod | null {
  const nah = brews.filter((b) => {
    const h = new Date(b.createdAt).getHours()
    // Über Mitternacht hinweg: 23 Uhr und 1 Uhr sind zwei Stunden auseinander.
    const abstand = Math.min(Math.abs(h - stunde), 24 - Math.abs(h - stunde))
    return abstand <= STUNDEN_FENSTER
  })
  if (nah.length < STUNDEN_BELEGE) return null

  const zaehler = new Map<BrewMethod, number>()
  for (const b of nah) zaehler.set(b.method, (zaehler.get(b.method) ?? 0) + 1)
  const [beste] = [...zaehler.entries()].sort((a, b) => b[1] - a[1])
  return beste?.[0] ?? null
}

interface Eingabe {
  beans: Bean[]
  bags: Bag[]
  brews: Brew[]
  settings: Settings
  today: Date
}

export function heuteVorschlag(e: Eingabe): HeuteVorschlag | null {
  if (!e.beans.length) return null

  // ── Die Methode ──
  const zurStunde = methodeZurStunde(e.brews, e.today.getHours())
  const method = zurStunde ?? e.settings.lastMethod ?? e.brews[0]?.method ?? 'espresso'
  const methodengrund = zurStunde
    ? 'um diese Zeit meistens'
    : e.settings.lastMethod
      ? 'zuletzt gebrüht'
      : 'Standard'

  // ── Die Bohne ──
  const rangliste = bestBeansFor(method, e.beans, e.bags, e.today)
  const brauchbar = rangliste.filter((r) => !r.unavailable)

  /**
   * Die zuletzt gebrühte Bohne gewinnt, solange sie brühbereit ist.
   *
   * Sonst wechselte der Vorschlag jeden Morgen, weil eine andere Tüte
   * gerade einen Punkt besser dasteht — und man müsste jedes Mal
   * gegensteuern. Wer eine Bohne eingemessen hat, will sie zu Ende
   * brühen.
   */
  const zuletzt = brauchbar.find((r) => r.bean.id === e.settings.lastBeanId)
  const gewaehlt = zuletzt ?? brauchbar[0] ?? rangliste[0]
  if (!gewaehlt) return null

  const fresh = assessFreshness(
    gewaehlt.bag,
    method,
    gewaehlt.bean.roastLevel,
    !!gewaehlt.bean.isDecaf,
    e.today,
    gewaehlt.bean.process,
  )

  const grund = zuletzt
    ? 'zuletzt gebrüht'
    : gewaehlt.unavailable
      ? 'die einzige, die da ist'
      : 'gerade am besten dran'

  return {
    bean: gewaehlt.bean,
    ...(gewaehlt.bag ? { bag: gewaehlt.bag } : {}),
    method,
    freshness: fresh,
    grund,
    methodengrund,
    weitere: rangliste.filter((r) => r.bean.id !== gewaehlt.bean.id),
  }
}
