/**
 * Frische: Ruhefenster, Score und die Frische-Drift.
 *
 * Briefing C4: Die Frische ändert sich täglich, ohne dass jemand etwas tut.
 * Ohne Korrektur wandert jedes gespeicherte Rezept mit der Zeit aus dem
 * Fenster — und der Nutzer sucht den Fehler bei sich.
 */
import formulas from '@data/formulas.json'
import { freshnessScore as gaussScore, ageGrindDrift } from '@domain'
import type { BrewMethod, RoastLevel, Bag, Bean, Process } from '@domain'
import { daysOffRoast, daysSince } from '@/domain'
import { tage } from './text'

type RestTable = Record<BrewMethod, Record<RoastLevel, [number, number]>>

const REST: RestTable = formulas.restWindows as unknown as RestTable
const DECAF_FACTOR = formulas.restWindows.decafFactor as number
const STALE_AFTER = formulas.restWindows.staleAfterDays as number
const PROCESS_MOD = (formulas.restWindows as unknown as {
  processModifiers?: Record<string, number>
}).processModifiers ?? {}
const DENSITY_MOD = (formulas.restWindows as unknown as {
  densityModifier?: Record<string, { min: number; max: number }>
}).densityModifier ?? {}
const FRESHNESS_PARAMS = (
  formulas.formulas.find((f) => f.id === 'F-31') as unknown as {
    params: Record<BrewMethod, Record<RoastLevel, { tPeak: number; sigma: number }>>
  }
).params

export interface RestWindow {
  min: number
  max: number
}

/** Woraus sich das Fenster zusammensetzt — für die Begründung in der UI */
export interface WindowReason {
  text: string
  confidence: 'high' | 'medium' | 'low'
}

export interface RestWindowDetail extends RestWindow {
  reasons: WindowReason[]
}

/**
 * Ruhefenster in Tagen nach Röstung.
 *
 * Einflussgrößen, nach Beleglage geordnet:
 *   Röstgrad          🟡 dominant — dunkler = mehr CO₂ und porösere Struktur
 *   Entkoffeinierung  🟡 vorgeschädigte Struktur, kürzeres Fenster
 *   Dichte / Höhe     🟠 dichtere Bohne hält CO₂ länger
 *   Aufbereitung      🟠 umstritten — klein, und NUR am oberen Ende
 *
 * Zur Aufbereitung, geprüft in docs/04-faktencheck.md §3–4:
 * `barista-pwa` verschob hier das UNTERE Ende um 3–7 Tage und widersprach
 * dabei dem eigenen Quellkommentar (Kommentar sagte „braucht länger", Tabelle
 * sagte „braucht kürzer"). Die ASC-Kursunterlage behandelt Aufbereitung
 * ausschließlich als Trocknungsvorgang auf der Farm und sagt zur Ruhezeit
 * nach der Röstung nichts.
 *
 * Belegbar ist nicht „Naturals gasen schneller aus", sondern „fruchtbetonte
 * Aufbereitungen verlieren ihre flüchtigen Ester früher". Der Effekt wirkt
 * deshalb auf das ENDE des Fensters, nicht auf seinen Beginn — und bleibt
 * klein genug, dass die eigenen Bewertungen ihn überstimmen können.
 */
export function restWindow(
  method: BrewMethod,
  roast: RoastLevel,
  isDecaf = false,
  process?: Process,
  altitudeMasl?: [number, number],
  densityGL?: number,
): RestWindowDetail {
  const [rawMin, rawMax] = REST[method]?.[roast] ?? [5, 21]
  const reasons: WindowReason[] = []
  let min = rawMin
  let max = rawMax

  if (isDecaf) {
    min = Math.round(min * DECAF_FACTOR)
    max = Math.round(max * DECAF_FACTOR)
    reasons.push({ text: 'Entkoffeiniert — poröse Struktur, kürzeres Fenster.', confidence: 'high' })
  }

  const pm = process ? PROCESS_MOD[process] : undefined
  if (pm !== undefined && pm !== 0) {
    max += pm
    reasons.push({
      text:
        pm < 0
          ? `Fruchtbetonte Aufbereitung — Fruchtaroma lässt rund ${Math.abs(pm)} Tage früher nach.`
          : `Gewaschen — hält die Klarheit rund ${pm} Tage länger.`,
      confidence: 'low',
    })
  }

  const alt = altitudeMasl ? (altitudeMasl[0] + altitudeMasl[1]) / 2 : null
  if (alt !== null && alt > 1800 && DENSITY_MOD['altitudeAbove1800']) {
    min += DENSITY_MOD['altitudeAbove1800'].min
    max += DENSITY_MOD['altitudeAbove1800'].max
    reasons.push({ text: 'Über 1800 m — dichtere Bohne, gast langsamer aus.', confidence: 'low' })
  } else if (densityGL && densityGL > 400 && DENSITY_MOD['densityAbove400']) {
    min += DENSITY_MOD['densityAbove400'].min
    max += DENSITY_MOD['densityAbove400'].max
    reasons.push({ text: 'Hohe Dichte — gast langsamer aus.', confidence: 'low' })
  }

  return { min: Math.max(1, min), max: Math.max(min + 3, max), reasons }
}

/** Bequemer Aufruf, wenn die Bohne vorliegt */
export function restWindowFor(bean: Bean, method: BrewMethod): RestWindowDetail {
  return restWindow(method, bean.roastLevel, !!bean.isDecaf, bean.process, bean.altitudeMasl, bean.densityGL)
}

export type FreshnessState =
  | 'unknown'
  | 'too-fresh'
  | 'approaching'
  | 'peak'
  | 'past-peak'
  | 'stale'

export interface Freshness {
  state: FreshnessState
  days: number | null
  score: number
  window: RestWindow
  label: string
  hint?: string
}

export function assessFreshness(
  bag: Bag | undefined,
  method: BrewMethod,
  roast: RoastLevel,
  isDecaf: boolean,
  today: Date,
  process?: Process,
): Freshness {
  const win = restWindow(method, roast, isDecaf, process)
  const days = daysOffRoast(bag, today)

  if (days === null) {
    return {
      state: 'unknown',
      days: null,
      score: 50,
      window: win,
      label: 'Röstdatum unbekannt',
      hint: 'Trag das Röstdatum ein — dann kann ich den Mahlgrad mit dem Alter mitführen.',
    }
  }

  const p = FRESHNESS_PARAMS[method]?.[roast] ?? { tPeak: 10, sigma: 7 }
  const openedDays = daysSince(bag?.openedDate, today) ?? 0
  const score = Math.round(gaussScore(days, p.tPeak, p.sigma, openedDays))

  let state: FreshnessState
  let label: string
  let hint: string | undefined

  if (days >= STALE_AFTER) {
    state = 'stale'
    label = `${tage(days)} — überaltert`
    hint = 'Aromaverlust lässt sich durch keine Einstellung reparieren. Neue Bag.'
  } else if (days < win.min) {
    state = 'too-fresh'
    label = `${tage(days)} — noch zu frisch`
    hint = `Das CO₂ stört noch. Ab Tag ${win.min} sind die Ergebnisse stabil.`
  } else if (days <= win.min + 2) {
    state = 'approaching'
    label = `${tage(days)} — wird gerade gut`
  } else if (days <= win.max) {
    state = 'peak'
    label = `${tage(days)} — im Fenster`
  } else {
    state = 'past-peak'
    label = `${tage(days)} — über dem Optimum`
    hint = 'Etwas feiner mahlen, das Bett bietet weniger Widerstand.'
  }

  // Gefroren: Die Zahl ist das Alter beim Einfrieren, nicht das heutige.
  // Ohne diesen Hinweis liest sich „119 Tage" so, als altere die Bohne
  // im Gefrierfach weiter.
  if (bag?.storage === 'frozen') {
    label = `${label} · eingefroren`
    hint = hint
      ? `${hint} Solange sie gefroren bleibt, ändert sich daran nichts.`
      : 'Im Gefrierfach steht die Uhr — der Wert gilt ab dem Tag des Einfrierens.'
  }

  return { state, days, score, window: win, label, hint }
}

/**
 * Frische-Drift: Wie viele Mahlschritte muss ein gespeicherter Referenz-Shot
 * korrigiert werden, weil die Bohne inzwischen älter ist?
 *
 * Negativ = feiner. Nur Espresso — beim Filter ist der Effekt sensorisch,
 * nicht hydraulisch (kb/02 F-32).
 */
export function driftCorrection(
  method: BrewMethod,
  refDaysOffRoast: number | null,
  nowDaysOffRoast: number | null,
): { steps: number; drift: number; reason?: string } {
  if (method !== 'espresso' || refDaysOffRoast === null || nowDaysOffRoast === null) {
    return { steps: 0, drift: 0 }
  }
  const drift = nowDaysOffRoast - refDaysOffRoast
  if (Math.abs(drift) < 6) return { steps: 0, drift }

  const steps = Math.round(ageGrindDrift(nowDaysOffRoast, refDaysOffRoast))
  if (steps === 0) return { steps: 0, drift }

  const richtung = steps < 0 ? 'feiner' : 'gröber'
  const alter = drift > 0 ? 'älter' : 'jünger'
  return {
    steps,
    drift,
    reason: `Die Bohne ist ${Math.abs(drift)} Tage ${alter} als bei deinem Referenz-Shot — ${Math.abs(steps)} Klick${Math.abs(steps) === 1 ? '' : 's'} ${richtung}.`,
  }
}
