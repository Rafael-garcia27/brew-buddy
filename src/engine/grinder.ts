/**
 * Mühle: Skalenumrechnung, Korrektur aus Zeitabweichung, Selbstkalibrierung.
 *
 * Briefing C1: Ohne Mühlenkenntnis ist „wie stark verändern" nicht
 * beantwortbar. „12 % gröber" nützt niemandem — „3 Klicks" schon.
 */
import {
  grindScaleFactor,
  grindSteps as stepsFromFactor,
  expectedTimeAfterGrindChange,
  settingToMicron,
  canUseTimeForGrind,
} from '@domain'
import type { Grinder, BrewMethod, FlowState } from '@domain'
import { getGrinderCatalogEntry, referenceMicron, GRIND_TARGETS, GRINDER_CATALOG, tolerances } from '@/kb'

export function micronFor(setting: number, grinder?: Grinder): number | null {
  if (!grinder) return null
  return settingToMicron(setting, grinder)
}

/**
 * Obergrenze je Durchgang. Wer 19 Klicks auf einmal springt, verlässt den
 * Bereich, in dem das Durchflussgesetz überhaupt gilt — und kann das Ergebnis
 * nicht mehr zuordnen. Lieber zwei kontrollierte Runden als ein Sprung.
 */
/**
 * Zahl in deutscher Schreibweise für Texte, die der Nutzer liest.
 *
 * Die Engine formuliert ganze Sätze — dort darf kein „1:2.8" stehen,
 * während die Oberfläche daneben „1:2,8" zeigt.
 */
function de(v: number, decimals = 1): string {
  return v.toFixed(decimals).replace('.', ',')
}

export const MAX_STEPS_PER_ROUND = 5

/**
 * Derselbe Deckel, aber in Mikrometern gedacht statt in Skalenschritten.
 *
 * 5 Klicks der Bezugsmühle sind 62,5 µm. Auf einer Mühle mit 40 µm je
 * Nummer wären 5 Schritte 200 µm — mehr als das gesamte Espressoband.
 * Begrenzt wird die Partikeländerung, nicht die Zahl auf dem Rädchen.
 */
export const MAX_MICRON_PER_ROUND = MAX_STEPS_PER_ROUND * 12.5

/** Der Deckel, ausgedrückt in Schritten DIESER Mühle. */
function stepCap(grinder: Grinder): number {
  const roh = MAX_MICRON_PER_ROUND / Math.max(1, grinder.micronPerStep)
  const st = grinder.scaleType === 'stepless' ? (grinder.step ?? 0.1) : 1
  // Mindestens ein Schritt der Mühle — sonst gäbe es gar keine Empfehlung.
  return Math.max(st, Math.round(roh / st) * st)
}

export interface GrindCorrection {
  /** Schritte auf der Mühlenskala. Negativ = feiner. */
  steps: number
  /** Relative Änderung der Partikelgröße in Prozent */
  percent: number
  micronDelta: number | null
  /** Überprüfbare Vorhersage (Solution Design §6.2) */
  expectedTimeS: number | null
  /** Wenn keine Mühle kalibriert ist, gibt es nur Prozent statt Klicks */
  hasSteps: boolean
  /** true, wenn die volle Korrektur gedeckelt wurde und eine zweite Runde folgt */
  capped: boolean
  fullSteps: number
  math: string
}

/**
 * Kernfunktion: Aus Ist- und Zielzeit die Mahlgradkorrektur berechnen.
 *
 * Grundlage ist das Durchflussgesetz (Darcy + Kozeny-Carman, kb/02 F-22):
 * Der Durchfluss skaliert mit dem Quadrat der Partikelgröße, also
 *   d_neu / d_alt = sqrt(t_alt / t_neu)
 */
export function correctionFromTime(
  actualTimeS: number,
  targetTimeS: number,
  method: BrewMethod,
  grinder?: Grinder,
  currentSetting?: number,
): GrindCorrection | null {
  if (actualTimeS <= 0 || targetTimeS <= 0) return null

  // Innerhalb der Kurstoleranz wird nicht korrigiert (ASC: Espresso ±3 s).
  // Eine Abweichung, die kleiner ist als die eigene Wiederholgenauigkeit,
  // ist kein Signal — wer darauf reagiert, jagt Rauschen.
  const tol = tolerances(method).timeS
  if (Math.abs(actualTimeS - targetTimeS) <= tol) return null

  const factor = grindScaleFactor(actualTimeS, targetTimeS)
  const percent = (factor - 1) * 100
  if (Math.abs(percent) < 4) return null

  const currentMicron =
    grinder && currentSetting !== undefined
      ? settingToMicron(currentSetting, grinder)
      : referenceMicron(method)

  const hasSteps = !!grinder
  const raw = hasSteps ? stepsFromFactor(currentMicron, factor, grinder.micronPerStep) : 0
  const aufl = hasSteps ? (grinder.scaleType === 'stepless' ? (grinder.step ?? 0.1) : 1) : 1
  // Gerundet 0 Schritte wäre kein Vorschlag — wenigstens einen ganzen gehen.
  const fullSteps = hasSteps && raw === 0 ? (factor > 1 ? aufl : -aufl) : raw
  const cap = hasSteps ? stepCap(grinder) : 0
  let finalSteps = hasSteps ? Math.max(-cap, Math.min(cap, fullSteps)) : 0

  // Nicht über das Ende der Skala hinaus raten: Ein Vorschlag, der die
  // Mühle auf 0 stellen würde, ist keine Einstellung, sondern ein Stillstand.
  if (hasSteps && currentSetting !== undefined && grinder.usableRange) {
    const [lo, hi] = grinder.usableRange
    const ziel = Math.max(lo, Math.min(hi, currentSetting + finalSteps))
    finalSteps = roundToStep(ziel - currentSetting, grinder)
    if (finalSteps === 0) return null
  }
  const capped = hasSteps && Math.abs(fullSteps) > Math.abs(finalSteps) + 1e-9

  // Auch die Prozentangabe deckeln, wenn keine Mühle bekannt ist.
  const cappedPercent = hasSteps ? percent : Math.max(-35, Math.min(35, percent))

  const newMicron = hasSteps
    ? currentMicron + finalSteps * grinder.micronPerStep
    : currentMicron * (1 + cappedPercent / 100)

  return {
    steps: finalSteps,
    percent: cappedPercent,
    micronDelta: hasSteps ? finalSteps * grinder.micronPerStep : newMicron - currentMicron,
    expectedTimeS: Math.round(expectedTimeAfterGrindChange(actualTimeS, currentMicron, newMicron)),
    hasSteps,
    capped: capped || (!hasSteps && Math.abs(percent) > 35),
    fullSteps,
    math: `√(${actualTimeS}/${targetTimeS}) = ${de(factor, 3)} → ${percent > 0 ? '+' : ''}${de(percent, 0)} %`,
  }
}

/** Formulierung für die Empfehlung */
export function describeCorrection(c: GrindCorrection, grinder?: Grinder): string {
  const richtung = c.steps > 0 || c.percent > 0 ? 'gröber' : 'feiner'
  if (c.hasSteps) {
    const n = Math.abs(c.steps)
    // Typografisches Minus: In „−37 µm" neben einer Klickzahl ist der
    // Bindestrich zu kurz, um als Vorzeichen gelesen zu werden.
    const um = c.micronDelta
      ? ` (≈ ${c.micronDelta > 0 ? '+' : '−'}${Math.abs(Math.round(c.micronDelta))} µm)`
      : ''
    // Eine stufenlose Skala kennt keine Klicks. „2 Klicks" wäre dort nicht
    // nur falsch benannt, sondern auch nicht ablesbar — der Nutzer sucht
    // eine Zahl auf dem Regler, keine Rastungen.
    if (grinder?.scaleType === 'stepless') {
      const st = grinder.step ?? 0.1
      const betrag = (Math.round(n / st) * st).toFixed(st >= 1 ? 0 : 1).replace('.', ',')
      return `${betrag} ${richtung} auf der Skala${um}`
    }
    if ((grinder?.clicksPerNumber ?? 0) > 1) {
      return `${n} Klick${n === 1 ? '' : 's'} ${richtung}${um}`
    }
    return `${n} Klick${n === 1 ? '' : 's'} ${richtung}${um}`
  }
  return `${de(Math.abs(c.percent), 0)} % ${richtung}`
}

/** Zusatz, wenn die volle Korrektur zu groß für einen Durchgang war */
export function cappedNote(c: GrindCorrection, grinder?: Grinder): string | undefined {
  if (!c.capped) return undefined
  if (c.hasSteps) {
    const einheit = grinder?.scaleType === 'stepless' ? 'Skalenschritte' : 'Klicks'
    return `Rechnerisch wären ${Math.abs(c.fullSteps)} ${einheit} nötig. So große Sprünge lassen sich nicht mehr zuordnen — geh erst diese ${Math.abs(c.steps)}, dann sehen wir weiter.`
  }
  return 'Die rechnerische Korrektur ist sehr groß — geh sie in zwei Runden an.'
}

/**
 * Sperre aus Briefing C3: Bei Kanalbildung ist die gemessene Zeit
 * physikalisch bedeutungslos — ein Teil des Wassers ist gar nicht durch den
 * Kaffee gelaufen. Jede Mahlgradempfehlung wäre geraten.
 */
export function timeIsTrustworthy(flow?: FlowState): boolean {
  return canUseTimeForGrind(flow)
}

// ── Selbstkalibrierung (kb/07 §5.3) ───────────────────────────────────

export interface CalibrationInput {
  time1S: number
  setting1: number
  time2S: number
  setting2: number
  method: BrewMethod
}

export interface CalibrationResult {
  micronPerStep: number
  factor: number
  stepDelta: number
  confidence: 'measured'
  explanation: string
}

export function calibrate(input: CalibrationInput): CalibrationResult | { error: string } {
  const stepDelta = input.setting2 - input.setting1
  if (stepDelta === 0) return { error: 'Die beiden Einstellungen sind identisch.' }
  if (input.time1S <= 0 || input.time2S <= 0) return { error: 'Beide Zeiten müssen größer als 0 sein.' }
  if (input.time1S === input.time2S)
    return { error: 'Beide Shots liefen gleich lang — daraus lässt sich nichts ableiten.' }

  // Der gröber gestellte Shot muss der schnellere sein, sonst stimmt die
  // Zuordnung nicht (oder es lag Kanalbildung vor).
  const coarserIsFaster = stepDelta > 0 ? input.time2S < input.time1S : input.time1S < input.time2S
  if (!coarserIsFaster)
    return {
      error:
        'Der gröber eingestellte Shot lief nicht schneller. Sehr wahrscheinlich lag Channeling vor — bitte beide Shots wiederholen.',
    }

  const factor = grindScaleFactor(input.time1S, input.time2S)
  const ref = referenceMicron(input.method)
  const micronPerStep = Math.abs((ref * (factor - 1)) / stepDelta)

  if (micronPerStep < 2 || micronPerStep > 120)
    return {
      error: `Ergebnis unplausibel (${de(micronPerStep, 1)} µm/Schritt). Prüf, ob beide Shots mit identischer Dose und ohne Channeling liefen.`,
    }

  return {
    micronPerStep: Math.round(micronPerStep * 10) / 10,
    factor,
    stepDelta,
    confidence: 'measured',
    explanation:
      `${Math.abs(stepDelta)} Schritte haben die Zeit von ${input.time1S} s auf ${input.time2S} s verändert. ` +
      `Das entspricht ${de(((factor - 1) * 100), 1)} % Partikelgröße, ` +
      `also ${de((micronPerStep), 1)} µm pro Schritt.`,
  }
}

/** Neue Mühle aus dem Katalog anlegen */
export function grinderFromCatalog(catalogId: string, id: string): Grinder | null {
  const e = getGrinderCatalogEntry(catalogId)
  if (!e) return null
  return {
    id,
    name: e.name,
    burrType: e.burrType,
    scaleType: e.scaleType,
    clicksPerRotation: e.clicksPerRotation,
    clicksPerNumber: e.clicksPerNumber,
    micronPerStep: e.micronPerStep,
    zeroPointOffsetMicron: e.zeroPointOffsetMicron,
    usableRange: e.usableRange ?? e.dialRange,
    step: e.step,
    kind: e.kind,
    methods: e.methods,
    catalogId: e.id,
    confidence: e.confidence,
  }
}

/**
 * Startwert für den Mahlgrad einer Methode auf einer konkreten Mühle.
 *
 * Herstellerempfehlungen schlagen die Rückrechnung aus Mikrometern: Der
 * Hersteller kennt den Nullpunkt seiner Skala, wir schätzen ihn nur.
 */
/** Katalogeintrag einer Mühle — über die id, ersatzweise über den Namen. */
function catalogFor(grinder: Grinder) {
  return GRINDER_CATALOG.find((g) => g.id === grinder.catalogId || g.name === grinder.name)
}

export function suggestedSetting(grinder: Grinder | undefined, method: BrewMethod): number | null {
  if (!grinder) return null

  const entry = catalogFor(grinder)
  const preset = entry?.presets?.[method]
  if (preset) return roundToStep((preset[0] + preset[1]) / 2, grinder)

  const target = referenceMicron(method)
  const raw = (target - grinder.zeroPointOffsetMicron) / grinder.micronPerStep
  return Math.max(0, roundToStep(raw, grinder))
}

/** Vom Hersteller empfohlener Bereich, falls hinterlegt (in Klicks) */
export function vendorRange(
  grinder: Grinder | undefined,
  method: BrewMethod,
): { clicks: [number, number]; isDerived: boolean } | null {
  if (!grinder) return null
  const entry = catalogFor(grinder)
  const preset = entry?.presets?.[method]
  if (!preset) return null
  return { clicks: preset, isDerived: !!entry?.presetsDerived?.includes(method) }
}

/** Einheitenbezeichnung für die Oberfläche */
export function settingUnitLabel(grinder: Grinder | undefined): string {
  if (grinder?.scaleType === 'stepless') return 'Skala'
  return grinder?.clicksPerNumber && grinder.clicksPerNumber > 1 ? 'Skala' : 'Klicks'
}

/** Formulierung einer Änderung: „4 Klicks gröber (Skala 2,4 → 2,8)" */
export function describeSettingChange(
  grinder: Grinder | undefined,
  from: number,
  to: number,
): string {
  const numbered = (grinder?.clicksPerNumber ?? 0) > 1 || grinder?.scaleType === 'stepless'
  if (!numbered) return ''
  return `Skala ${formatSetting(from, grinder)} → ${formatSetting(to, grinder)}`
}

// ── Plausibilitätsprüfung (Übernahme aus barista-pwa, docs/03 §2.4) ───

/**
 * Meldet, wenn die eingetragene Einstellung für die Methode weit außerhalb
 * des Sinnvollen liegt. Mühlenunabhängig, weil in Mikrometern gerechnet.
 */
export function grindPlausibility(
  setting: number,
  method: BrewMethod,
  grinder?: Grinder,
): { ok: boolean; message?: string; suggestion?: number } {
  if (!grinder) return { ok: true }
  const micron = settingToMicron(setting, grinder)
  const [lo, hi] = GRIND_TARGETS[method] ?? [200, 900]
  const tol = 0.45 // 45 % Toleranz — Mahlwerke streuen erheblich

  if (micron < lo * (1 - tol)) {
    return {
      ok: false,
      message: `Einstellung ${setting} entspricht ~${Math.round(micron)} µm — sehr fein für ${method === 'v60' ? 'Filter' : method === 'espresso' ? 'Espresso' : 'AeroPress'} (üblich ${lo}–${hi} µm).`,
      suggestion: suggestedSetting(grinder, method) ?? undefined,
    }
  }
  if (micron > hi * (1 + tol)) {
    return {
      ok: false,
      message: `Einstellung ${setting} entspricht ~${Math.round(micron)} µm — sehr grob (üblich ${lo}–${hi} µm).`,
      suggestion: suggestedSetting(grinder, method) ?? undefined,
    }
  }
  return { ok: true }
}

/**
 * Anzeige der Mühlenskala (Übernahme docs/03 §2.5): viele Mühlen tragen die
 * Zahl als Dezimalwert auf dem Rädchen — 24 Klicks lesen sich dort als „2.4".
 */
/**
 * Rundet auf die kleinste Einstellung, die diese Mühle wirklich hergibt.
 *
 * Eine gerastete Mühle kennt nur ganze Klicks. Eine stufenlose Skala wie
 * die der Sage Barista Express kennt beliebige Zwischenwerte — dort auf
 * ganze Zahlen zu runden würde die Hälfte des Verstellwegs wegwerfen.
 */
/**
 * Dieselbe Partikelgröße, auf einer anderen Mühle abgelesen.
 *
 * Belegt an echten Logdaten vom 24.09.2026: Der Nutzer wechselte für
 * Espresso von der Mylo SG2 (Skala 0–100) auf die Sage Barista Express
 * (Skala 0–18). Die Referenz einer ähnlichen Bohne wurde danach
 * unverändert übernommen — vier Sitzungen lang stand „Mahlgrad 26,5"
 * auf einer Maschine, deren Rädchen bei 18 endet.
 *
 * Die Ursache war nicht ein Rechenfehler, sondern ein blinder Fleck:
 * `Brew.actual.grindSetting` trägt die `equipmentId` mit sich, und die
 * Engine hat sie nirgends gelesen. Eine Skalenzahl ohne ihre Mühle ist
 * aber keine Angabe — 26 heißt an der einen Maschine fein und an der
 * anderen gar nichts.
 *
 * Der Weg führt über Mikrometer, denn nur die sind mühlenunabhängig:
 * Einstellung → µm auf der alten Mühle → Einstellung auf der neuen.
 *
 * Zweimal gibt es bewusst gar keine Zahl statt einer falschen:
 * wenn die Herkunftsmühle unbekannt ist (dann fehlt die Skala, auf die
 * sich der Wert bezieht), und wenn das Ergebnis außerhalb des
 * Verstellwegs läge. Beides ist keine Einstellung, sondern eine Absage.
 */
export function uebertrageSetting(
  setting: number,
  von: Grinder | undefined,
  nach: Grinder | undefined,
): number | undefined {
  if (!nach) return undefined
  if (von?.id === nach.id) return setting
  if (!von) return undefined
  const micron = settingToMicron(setting, von)
  const roh = (micron - nach.zeroPointOffsetMicron) / Math.max(1, nach.micronPerStep)
  const wert = roundToStep(roh, nach)
  const [min, max] = nach.usableRange ?? [0, Number.POSITIVE_INFINITY]
  return wert < min || wert > max ? undefined : wert
}

export function roundToStep(value: number, grinder?: Grinder): number {
  const st = grinder?.scaleType === 'stepless' ? (grinder.step ?? 0.1) : 1
  const r = Math.round(value / st) * st
  // Gleitkommareste vermeiden: 6,5 soll 6,5 bleiben, nicht 6,500000000000001.
  return Math.round(r * 100) / 100
}

export function formatSetting(setting: number, grinder?: Grinder): string {
  if (!grinder) return String(setting)
  // Nummerierte Skala (z. B. Mylo SG2: 10 Klicks je Nummer): so anzeigen,
  // wie der Nutzer sie auf der Mühle abliest — 24 Klicks sind „2,4".
  const per = grinder.clicksPerNumber
  if (per && per > 1) return (setting / per).toFixed(1).replace('.', ',')
  if (grinder.scaleType === 'stepless') {
    // Stufenlos: Es gibt keine Rastung, deshalb wird auf den Anzeigeschritt
    // gerundet — halbe Nummern liest man am Regler noch sicher ab.
    const st = grinder.step ?? 0.1
    return (Math.round(setting / st) * st)
      .toFixed(st >= 1 ? 0 : 1)
      .replace('.', ',')
  }
  const rev = grinder.clicksPerRotation
  if (rev && rev >= 10) {
    const turns = Math.floor(setting / rev)
    const rest = setting % rev
    if (turns > 0) return `${setting} (${turns}×${rev} + ${rest})`
  }
  return String(setting)
}
