/**
 * Die Empfehlung als Wette — und das Buch darüber.
 *
 * Das Solution Design nennt das Feld ERWARTUNG „den Vertrauens­
 * mechanismus der App": eine überprüfbare Vorhersage. Trifft die Zeit
 * ein, glaubt der Nutzer auch der Geschmacksaussage.
 *
 * Gebaut war sie als Anzeigetext. Die App sagte „danach 28 s" und schaute
 * nie nach. Hier bekommt die Vorhersage einen Lebenslauf: gegeben →
 * übernommen → eingelöst oder verfehlt. Daraus fallen fünf Dinge heraus,
 * die sonst je einzeln gebaut werden müssten — Trefferquote,
 * Selbstkalibrierung, „hör auf zu drehen", Regelqualität und das stille
 * Präferenzsignal aus verworfenen Empfehlungen.
 *
 * Rein funktional, ohne Browser, ohne Zeitbegriff außer dem übergebenen.
 */
import type { BrewMethod, Brew } from '@domain'
import type {
  Empfehlung,
  Einloesung,
  Eingriff,
  Stellgroesse,
  Vorhersage,
} from '@/domain'
import type { Diagnosis, Suggestion, Confidence } from './diagnose'

/**
 * Wie weit daneben noch als getroffen gilt — zwei Sekunden.
 *
 * Das Flussgesetz F-22 ist keine Uhr: Es sagt, wie sich die Zeit mit der
 * Korngröße verhält, nicht auf die Sekunde genau, wie lange ein
 * bestimmter Shot läuft. Tamperdruck, Verteilung und Pumpenanlauf
 * streuen um mehr als eine Sekunde. Eine engere Toleranz würde die
 * Trefferquote drücken, ohne dass eine Empfehlung deshalb schlechter
 * wäre; eine weitere würde jede Aussage bedeutungslos machen.
 *
 * Der Wert steht hier und nicht in `data/`, weil er nichts über Kaffee
 * sagt, sondern über die Genauigkeit, die diese App beansprucht.
 */
export const TOLERANZ_S = 2

/** Ab wie vielen verfehlten Eingriffen an derselben Größe man aufhören sollte. */
export const KREIS_AB = 3

const KONFIDENZ: Record<Confidence, number> = {
  sicher: 0.9,
  wahrscheinlich: 0.65,
  Versuch: 0.4,
}

/** Welche Stellgröße eine Engine-Variable meint. */
function stellgroesse(variable: string): Stellgroesse {
  if (variable === 'grindSetting') return 'mahlgrad'
  if (variable === 'ratio') return 'ratio'
  if (variable === 'waterTempC') return 'temperatur'
  if (variable === 'doseG') return 'dosis'
  return 'technik'
}

function einheit(g: Stellgroesse): string {
  if (g === 'mahlgrad') return 'Klicks'
  if (g === 'temperatur') return '°C'
  if (g === 'dosis') return 'g'
  return ''
}

function eingriffAus(sg: Suggestion, istWert?: number): Eingriff | undefined {
  const groesse = stellgroesse(sg.variable)
  if (groesse === 'technik') return undefined
  return {
    groesse,
    ...(istWert !== undefined ? { von: istWert } : {}),
    ...(sg.newValue !== undefined ? { nach: sg.newValue } : {}),
    einheit: einheit(groesse),
  }
}

function vorhersageAus(sg: Suggestion): Vorhersage | undefined {
  if (!sg.erwartung) return undefined
  return {
    groesse: sg.erwartung.groesse,
    erwartet: sg.erwartung.wert,
    toleranz: TOLERANZ_S,
    konfidenz: KONFIDENZ[sg.confidence],
  }
}

export interface Wetteinsatz {
  diagnose: Diagnosis
  brewId: string
  beanId: string
  method: BrewMethod
  /** Der Ist-Wert der Stellgröße vor der Änderung, wenn bekannt. */
  istWert?: number
  id: string
  at: string
}

/**
 * Aus einer Diagnose eine Empfehlung machen — oder keine.
 *
 * `null`, wenn ein Tor gefeuert hat oder gar kein Eingriff vorgeschlagen
 * wird. Das ist kein Sonderfall, sondern der Kern von Befund C3 aus dem
 * Briefing: Wo die App ehrlich sagt „das liegt nicht an den Parametern",
 * darf sie auch keine Wette darauf abschließen.
 */
export function alsEmpfehlung(w: Wetteinsatz): Empfehlung | null {
  if (w.diagnose.blocked) return null
  const sg = w.diagnose.suggestions[0]
  if (!sg) return null

  return {
    id: w.id,
    at: w.at,
    brewId: w.brewId,
    beanId: w.beanId,
    method: w.method,
    regelId: sg.ruleId,
    titel: sg.what,
    ...(eingriffAus(sg, w.istWert) ? { eingriff: eingriffAus(sg, w.istWert)! } : {}),
    ...(vorhersageAus(sg) ? { vorhersage: vorhersageAus(sg)! } : {}),
    // Die Kette so festhalten, wie sie gezeigt wurde. Ändert sich die
    // Regel später, behauptet die App sonst rückwirkend etwas, das sie
    // damals nicht gesagt hat.
    begruendung: [sg.why, sg.expectation, ...(sg.alternative ? [sg.alternative] : [])],
    zustand: 'offen',
  }
}

/** Der gemessene Wert eines Durchgangs zur Größe, auf die gewettet wurde. */
function istWert(v: Vorhersage, brew: Brew): number | undefined {
  if (v.groesse === 'zeit') return brew.actual.timeS
  return brew.actual.yieldG ?? brew.actual.waterG
}

/**
 * Eine übernommene Empfehlung am nächsten Durchgang messen.
 *
 * `null`, wenn nichts zu messen ist: keine Vorhersage, nicht übernommen,
 * andere Bohne, andere Methode. Eine Empfehlung, die man nur gelesen und
 * nicht angewendet hat, wird NICHT eingelöst — sonst stünde in der
 * Bilanz, die App habe etwas vorhergesagt, das niemand ausprobiert hat.
 */
export function einloesen(e: Empfehlung, brew: Brew, at: string): Einloesung | null {
  if (e.zustand !== 'uebernommen' || !e.vorhersage) return null
  if (brew.beanId !== e.beanId || brew.method !== e.method) return null
  const ist = istWert(e.vorhersage, brew)
  if (ist === undefined) return null

  const abweichung = Math.round((ist - e.vorhersage.erwartet) * 10) / 10
  return {
    brewId: brew.id,
    istWert: ist,
    abweichung,
    getroffen: Math.abs(abweichung) <= e.vorhersage.toleranz,
    at,
  }
}

// ── Das Buch ──────────────────────────────────────────────────────────

export interface Trefferbilanz {
  gegeben: number
  uebernommen: number
  eingeloest: number
  verfehlt: number
  /** Anteil der getroffenen an den geprüften. `null`, solange keine geprüft ist. */
  quote: number | null
}

export function trefferquote(es: Empfehlung[]): Trefferbilanz {
  const eingeloest = es.filter((e) => e.zustand === 'eingeloest').length
  const verfehlt = es.filter((e) => e.zustand === 'verfehlt').length
  const geprueft = eingeloest + verfehlt
  return {
    gegeben: es.length,
    uebernommen: es.filter((e) => e.zustand === 'uebernommen').length + geprueft,
    eingeloest,
    verfehlt,
    quote: geprueft ? Math.round((eingeloest / geprueft) * 100) / 100 : null,
  }
}

export interface Kreisbefund {
  groesse: Stellgroesse
  anzahl: number
}

/**
 * „Hör auf zu drehen."
 *
 * Briefing Teil D: Wenn drei Korrekturen in dieselbe Richtung nichts
 * gebracht haben, liegt die Ursache bei Bohne, Wasser oder Röstung — und
 * nicht an der Stellgröße, an der man gerade dreht.
 *
 * Vorher hätte das eine eigene Erkennung gebraucht. Mit eingelösten
 * Vorhersagen ist es ein Abzählen: drei übernommene Eingriffe an
 * derselben Größe, alle verfehlt, keiner dazwischen getroffen.
 */
export function imKreis(
  es: Empfehlung[],
  beanId: string,
  method: BrewMethod,
): Kreisbefund | null {
  const eigene = es
    .filter((e) => e.beanId === beanId && e.method === method && e.eingriff)
    .filter((e) => e.zustand === 'eingeloest' || e.zustand === 'verfehlt')
    // Neueste zuerst — gezählt wird die laufende Serie, nicht die Summe.
    .sort((a, b) => b.at.localeCompare(a.at))

  const groesse = eigene[0]?.eingriff?.groesse
  if (!groesse) return null

  let anzahl = 0
  for (const e of eigene) {
    if (e.eingriff?.groesse !== groesse) break
    if (e.zustand !== 'verfehlt') break
    anzahl++
  }
  return anzahl >= KREIS_AB ? { groesse, anzahl } : null
}
