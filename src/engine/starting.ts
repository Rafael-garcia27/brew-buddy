/**
 * Startpunkt-Engine.
 *
 * Briefing A5/A7: Das Kaffeeprofil fließt IMMER ein, und der Nutzer sieht,
 * woher der Vorschlag kommt. Ohne sichtbare Begründung entsteht kein
 * Vertrauen — und ohne Vertrauen folgt niemand einer Empfehlung.
 */
import formulas from '@data/formulas.json'
import type { BrewMethod, Brew, Bean, RoastLevel } from '@domain'
import { targetYield } from '@domain'
import type { EngineContext } from '@/domain'
import { beanKey, daysOffRoast } from '@/domain'
import {
  getMethodDefaults,
  targetTimeRange,
  doseGrindOffset,
  getProcess,
  getOrigin,
  tempRange,
  tempAdjustable,
  maxWaterG,
} from '@/kb'
import { assessFreshness, driftCorrection } from './freshness'
import { suggestedSetting, roundToStep } from './grinder'
import { LEARN_THRESHOLDS } from '@/config'

type Mods = { grindSteps?: number; waterTempC?: number; ratio?: number }
const ROAST_MODS = formulas.roastModifiers as unknown as Record<RoastLevel, Mods>
const BEAN_MODS = formulas.beanModifiers as unknown as Record<string, Mods>

interface Sensitivity {
  grindWeight: number
  tempWeight: number
  ratioWeight: number
  steepPerGrindStep: number
}
const SENSITIVITY = formulas.methodSensitivity as unknown as Record<string, Sensitivity>

/** Wie stark ein Bohnenmerkmal in dieser Methode durchschlägt (Aufgabe 2). */
/**
 * Umrechnungsfaktor von der Bezugsskala auf die Skala dieser Mühle.
 *
 * Ein „Schritt" in der Wissensbasis meint 12,5 µm. Eine Mühle, deren
 * Skalenschritt 40 µm groß ist, braucht für dieselbe Partikeländerung nur
 * knapp ein Drittel davon.
 */
function grindStepScale(grinder: { micronPerStep?: number } | undefined): number {
  const ref =
    (formulas as unknown as { grindStepReference?: { micronPerStep: number } })
      .grindStepReference?.micronPerStep ?? 12.5
  const own = grinder?.micronPerStep
  if (!own || own <= 0) return 1
  return ref / own
}

function sensitivity(method: BrewMethod): Sensitivity {
  return (
    SENSITIVITY[method] ?? {
      grindWeight: 1,
      tempWeight: 1,
      ratioWeight: 1,
      steepPerGrindStep: 0,
    }
  )
}

/**
 * Anbauhöhe der Bohne — eingetragen oder aus der Herkunft abgeleitet.
 *
 * Ohne den Rückfall bliebe eine äthiopische Bohne ohne Höhenangabe
 * behandelt wie eine brasilianische Tieflandbohne, obwohl die Herkunft
 * die Antwort längst kennt.
 */
function beanAltitude(bean: Bean): { masl: number; derived: boolean } | null {
  if (bean.altitudeMasl) {
    return { masl: (bean.altitudeMasl[0] + bean.altitudeMasl[1]) / 2, derived: false }
  }
  const ranges = bean.origins
    .map((o) => getOrigin(o.country)?.altitudeMasl)
    .filter((r): r is [number, number] => Array.isArray(r))
  if (!ranges.length) return null
  const mid = ranges.reduce((sum, r) => sum + (r[0] + r[1]) / 2, 0) / ranges.length
  return { masl: mid, derived: true }
}

/** Stetige Höhenwirkung statt Sprung bei genau 1800 m. */
function altitudeMods(masl: number): Mods {
  const ramp = BEAN_MODS['altitudeRamp'] as unknown as {
    startMasl: number
    fullMasl: number
    atFull: { grindSteps: number; waterTempC: number }
  }
  const t = Math.max(0, Math.min(1, (masl - ramp.startMasl) / (ramp.fullMasl - ramp.startMasl)))
  return { grindSteps: ramp.atFull.grindSteps * t, waterTempC: ramp.atFull.waterTempC * t }
}

export type StartingSource = 'personal' | 'own-attempt' | 'transfer' | 'roaster' | 'default'

export interface Proposal {
  method: BrewMethod
  doseG: number
  ratio: number
  yieldG: number
  waterG?: number
  waterTempC: number
  grindSetting?: number
  targetTimeS?: [number, number]
  bloomWaterG?: number
  bloomTimeS?: number
  pourCount?: number
  steepS?: number
  stirCount?: number
  inverted?: boolean
}

export interface RationaleLine {
  text: string
  kind: 'source' | 'modifier' | 'warning' | 'learning'
}

export interface StartingPoint {
  proposal: Proposal
  source: StartingSource
  headline: string
  rationale: RationaleLine[]
  warning?: string
  /** Wie viele gute Brews noch fehlen, bis personalisiert wird */
  brewsUntilPersonal?: number
}

// ── Ähnlichkeit zwischen Bohnen (Solution Design §6.1) ────────────────

const ROAST_ORDER: RoastLevel[] = ['light', 'medium-light', 'medium', 'medium-dark', 'dark']

function roastDistance(a: RoastLevel, b: RoastLevel): number {
  return Math.abs(ROAST_ORDER.indexOf(a) - ROAST_ORDER.indexOf(b))
}

function processFamily(p: string): string {
  if (p.startsWith('honey')) return 'honey'
  if (p === 'anaerobic' || p === 'carbonic-maceration') return 'fermented'
  return p
}

export function similarity(a: Bean, b: Bean): number {
  let s = 0
  const rd = roastDistance(a.roastLevel, b.roastLevel)
  s += rd === 0 ? 3 : rd === 1 ? 1.5 : 0
  if (a.process === b.process) s += 2
  else if (processFamily(a.process) === processFamily(b.process)) s += 1

  const ac = new Set(a.origins.map((o) => o.country))
  if (b.origins.some((o) => ac.has(o.country))) s += 2

  if (a.altitudeMasl && b.altitudeMasl) {
    const am = (a.altitudeMasl[0] + a.altitudeMasl[1]) / 2
    const bm = (b.altitudeMasl[0] + b.altitudeMasl[1]) / 2
    if (Math.abs(am - bm) < 300) s += 1
  }
  if (a.densityGL && b.densityGL && Math.abs(a.densityGL - b.densityGL) < 30) s += 1
  if (!!a.isDecaf === !!b.isDecaf) s += 0.5
  return s
}

// ── Modifikatoren ─────────────────────────────────────────────────────

function applyBeanModifiers(
  base: Proposal,
  bean: Bean,
  ctx: EngineContext,
  lines: RationaleLine[],
): Proposal {
  const p = { ...base }
  let grindSteps = 0

  // Aufgabe 2: Jeder Modifikator wird mit der Empfindlichkeit der Methode
  // gewichtet. sGrind sammelt den Anteil, der bei Immersion NICHT in den
  // Mahlgrad, sondern in die Ziehzeit wandert.
  const sens = sensitivity(ctx.method)
  let steepFactor = 1
  // Die Modifikatoren stehen in Schritten einer 12,5-µm-Bezugsskala. Auf
  // einer gröber aufgelösten Mühle sind dafür weniger Schritte nötig —
  // sonst würde derselbe Zahlenwert dort ein Vielfaches bewirken.
  const scaleFactor = grindStepScale(ctx.grinder)
  /** Verteilt einen Mahlgrad-Impuls je nach Methode auf Mahlgrad und Zeit. */
  const applyGrind = (steps: number) => {
    grindSteps += steps * sens.grindWeight * scaleFactor
    if (sens.steepPerGrindStep) {
      steepFactor *= 1 + steps * (1 - sens.grindWeight) * sens.steepPerGrindStep
    }
  }

  const rm = ROAST_MODS[bean.roastLevel] ?? {}
  if (rm.grindSteps) applyGrind(rm.grindSteps)
  if (rm.waterTempC) p.waterTempC += rm.waterTempC * sens.tempWeight
  if (rm.ratio) p.ratio += rm.ratio * sens.ratioWeight

  const altInfo = beanAltitude(bean)
  if (altInfo && altInfo.masl > 1400) {
    const m = altitudeMods(altInfo.masl)
    applyGrind(m.grindSteps ?? 0)
    p.waterTempC += (m.waterTempC ?? 0) * sens.tempWeight
    /**
     * Die Begründung darf nur nennen, was auch geschieht.
     *
     * „deshalb feiner und heißer" stand einen Absatz über dem Satz „die
     * Brühtemperatur ist nicht einstellbar" — die App hat sich in zwei
     * aufeinanderfolgenden Zeilen selbst widersprochen. Wo die Temperatur
     * dem Gerät gehört, bleibt der Mahlgrad die ganze Aussage.
     */
    const wie = !tempAdjustable(ctx.method)
      ? 'feiner'
      : ctx.method === 'aeropress'
        ? 'länger ziehen und heißer'
        : 'feiner und heißer'
    lines.push({
      text: altInfo.derived
        ? `Herkunftstypisch um ${Math.round(altInfo.masl / 50) * 50} m angebaut — dichtere Bohne, deshalb ${wie}.`
        : `Auf ${Math.round(altInfo.masl)} m gewachsen — dichtere Bohne, deshalb ${wie}.`,
      kind: 'modifier',
    })
  }
  if (bean.densityGL && bean.densityGL > 400) {
    applyGrind(BEAN_MODS['densityAbove400']!.grindSteps ?? 0)
    lines.push({ text: `Hohe Dichte (${bean.densityGL} g/L) — schwerer löslich.`, kind: 'modifier' })
  }

  const proc = getProcess(bean.process)
  if (proc?.modifiers?.grindSteps) {
    applyGrind(proc.modifiers.grindSteps)
    lines.push({
      text: `${proc.label} löst sich leichter — etwas gröber.`,
      kind: 'modifier',
    })
  }
  if (proc?.modifiers?.waterTempC) p.waterTempC += proc.modifiers.waterTempC * sens.tempWeight
  if (proc?.modifiers?.ratio) p.ratio += proc.modifiers.ratio * sens.ratioWeight
  // Ziehzeit relativ (−0,1 = −10 %): Anaerob und Carbonic Maceration lösen
  // sich atypisch schnell — kürzerer Kontakt, sonst kippen sie (kb/04 §4.4).
  const steepMod = (proc?.modifiers as { steepS?: number } | undefined)?.steepS
  if (p.steepS && steepMod) {
    p.steepS = Math.round(p.steepS * (1 + steepMod))
    lines.push({
      text: `${proc!.label} löst sich schnell — Ziehzeit ${Math.round(Math.abs(steepMod) * 100)} % kürzer.`,
      kind: 'modifier',
    })
  }

  if (bean.isDecaf) {
    const m = BEAN_MODS['decaf']!
    applyGrind(m.grindSteps ?? 0)
    p.waterTempC += (m.waterTempC ?? 0) * sens.tempWeight
    lines.push({
      text: tempAdjustable(ctx.method)
        ? `Entkoffeiniert — die Struktur ist poröser, deshalb gröber und kühler.`
        : `Entkoffeiniert — die Struktur ist poröser, deshalb gröber.`,
      kind: 'modifier',
    })
  }
  if (ctx.bag?.storage === 'frozen') {
    applyGrind(BEAN_MODS['frozen']!.grindSteps ?? 0)
    lines.push({
      text: `Gefroren gemahlen — engere Partikelverteilung, deshalb gröber starten.`,
      kind: 'modifier',
    })
  }

  const origin = bean.origins[0] ? getOrigin(bean.origins[0].country) : undefined
  if (origin?.modifiers) {
    applyGrind(origin.modifiers.grindSteps ?? 0)
    p.waterTempC += (origin.modifiers.waterTempC ?? 0) * sens.tempWeight
    p.ratio += (origin.modifiers.ratio ?? 0) * sens.ratioWeight
  }

  grindSteps += doseGrindOffset(ctx.method, p.doseG) * scaleFactor

  // Bei Immersion ist die Zeit der zweite Hebel: Was der Mahlgrad hier
  // nicht leistet, leistet die Ziehzeit. Auf 5 s gerundet, damit die
  // Vorgabe im Ablauf ablesbar bleibt, und bei ±5 % ohne Begründung.
  if (p.steepS && Math.abs(steepFactor - 1) > 0.05) {
    const vorher = p.steepS
    p.steepS = Math.round((p.steepS * steepFactor) / 5) * 5
    lines.push({
      text:
        p.steepS > vorher
          ? `Schwerer löslich — Ziehzeit auf ${p.steepS} s verlängert.`
          : `Leichter löslich — Ziehzeit auf ${p.steepS} s verkürzt.`,
      kind: 'modifier',
    })
  }

  if (p.grindSetting !== undefined) {
    p.grindSetting = Math.max(0, roundToStep(p.grindSetting + grindSteps, ctx.grinder))
  }
  /**
   * Grenzen der jeweiligen Methode, nicht eine globale Klammer: Ein
   * Siebträger liefert am Brühkopf keine 100 °C, ein Wasserkocher schon.
   *
   * Und wo die Temperatur nicht einstellbar ist, werden die Modifikatoren
   * wieder zurückgenommen. Die Rechnung darüber ist nicht falsch — eine
   * dunkle Röstung WILL kühler —, sie ist nur nicht ausführbar. Ein
   * Vorschlag, den das Gerät nicht annehmen kann, ist keine Empfehlung,
   * sondern eine Ablenkung von den drei Hebeln, die es wirklich gibt
   * (kb/10c §1).
   */
  const tr = tempRange(ctx.method)
  if (!tempAdjustable(ctx.method)) {
    p.waterTempC = getMethodDefaults(ctx.method, ctx.bean.roastLevel).waterTempC
    lines.push({
      text: `Die Brühtemperatur liegt geräteseitig bei ${tr.min}–${tr.max} °C und ist nicht einstellbar — es bleiben Dose, Ratio und Mahlgrad.`,
      kind: 'source',
    })
  }
  p.waterTempC = Math.round(Math.min(tr.max, Math.max(tr.min, p.waterTempC)))
  p.ratio = Math.round(p.ratio * 10) / 10
  p.yieldG = Math.round(targetYield(p.doseG, p.ratio) * 10) / 10
  if (ctx.method !== 'espresso') p.waterG = Math.round(p.doseG * p.ratio)

  // Ein Rezept, das nicht in die Kammer passt, ist kein Rezept.
  // Statt die Dosis heimlich zu senken wird das Verhältnis zurückgenommen —
  // der Nutzer hat seine Bohnen schon abgewogen.
  const maxW = maxWaterG(ctx.method)
  if (maxW && p.waterG && p.waterG > maxW) {
    p.waterG = maxW
    p.ratio = Math.round((maxW / p.doseG) * 10) / 10
    p.yieldG = Math.round(targetYield(p.doseG, p.ratio) * 10) / 10
    lines.push({
      text: `Auf ${maxW} g Wasser begrenzt — mehr fasst die Kammer nicht.`,
      kind: 'modifier',
    })
  }
  p.targetTimeS = targetTimeRange(ctx.method, p.doseG, ctx.bean.roastLevel, p.yieldG, p.steepS) ?? undefined
  return p
}

function applyPreferenceBias(p: Proposal, ctx: EngineContext, lines: RationaleLine[]): Proposal {
  const pref = ctx.learned.preference[ctx.method]
  if (!pref || pref.sampleSize < LEARN_THRESHOLDS.bias) return p
  const out = { ...p }
  if (pref.ratioBias) out.ratio = Math.round((out.ratio + pref.ratioBias) * 10) / 10
  if (pref.tempBiasC) out.waterTempC = Math.round(out.waterTempC + pref.tempBiasC)
  if (pref.grindBiasSteps && out.grindSetting !== undefined)
    out.grindSetting = Math.max(0, roundToStep(out.grindSetting + pref.grindBiasSteps, ctx.grinder))
  out.yieldG = Math.round(targetYield(out.doseG, out.ratio) * 10) / 10
  if (ctx.method !== 'espresso') out.waterG = Math.round(out.doseG * out.ratio)
  out.targetTimeS = targetTimeRange(ctx.method, out.doseG, ctx.bean.roastLevel, out.yieldG, out.steepS) ?? undefined
  lines.push({
    text: pref.statement ?? 'An deine bisherigen Bewertungen angepasst.',
    kind: 'learning',
  })
  return out
}

// ── Basisvorschlag aus der Methode ────────────────────────────────────

function methodBase(ctx: EngineContext): Proposal {
  const d = getMethodDefaults(ctx.method, ctx.bean.roastLevel)
  const grind = suggestedSetting(ctx.grinder, ctx.method) ?? undefined
  const p: Proposal = {
    method: ctx.method,
    doseG: d.doseG,
    ratio: d.ratio,
    yieldG: Math.round(targetYield(d.doseG, d.ratio) * 10) / 10,
    waterTempC: d.waterTempC,
    grindSetting: grind,
    bloomWaterG: d.bloomRatio ? Math.round(d.doseG * d.bloomRatio) : undefined,
    bloomTimeS: d.bloomTimeS,
    pourCount: d.pourCount,
    steepS: d.steepS,
    stirCount: d.stirCount,
    inverted: d.inverted,
  }
  if (ctx.method !== 'espresso') p.waterG = Math.round(d.doseG * d.ratio)
  p.targetTimeS = targetTimeRange(ctx.method, d.doseG, ctx.bean.roastLevel, p.yieldG) ?? undefined
  return p
}

function proposalFromBrew(b: Brew, ctx: EngineContext): Proposal {
  const a = b.actual
  const ratio = a.yieldG ? a.yieldG / a.doseG : a.waterG ? a.waterG / a.doseG : 2
  return {
    method: ctx.method,
    doseG: a.doseG,
    ratio: Math.round(ratio * 10) / 10,
    yieldG: a.yieldG ?? Math.round(a.doseG * ratio * 10) / 10,
    waterG: a.waterG,
    waterTempC: a.waterTempC ?? getMethodDefaults(ctx.method, ctx.bean.roastLevel).waterTempC,
    grindSetting: a.grindSetting?.value,
    targetTimeS:
      targetTimeRange(ctx.method, a.doseG, ctx.bean.roastLevel, a.yieldG) ??
      [Math.round(b.actual.timeS * 0.93), Math.round(b.actual.timeS * 1.07)],
    stirCount: a.stirCount,
    pourCount: a.pourCount,
    inverted: a.inverted,
  }
}

// ── Hauptfunktion ─────────────────────────────────────────────────────

export function startingPoint(ctx: EngineContext): StartingPoint {
  const lines: RationaleLine[] = []
  const fresh = assessFreshness(
    ctx.bag,
    ctx.method,
    ctx.bean.roastLevel,
    !!ctx.bean.isDecaf,
    ctx.today,
    ctx.bean.process,
  )
  const nowDays = daysOffRoast(ctx.bag, ctx.today)

  // 1 — Eigene Referenz für genau diese Bohne
  const own = ctx.beanHistory
    .filter((b) => (b.tasting?.rating ?? 0) >= 4)
    .sort((a, b) => (b.tasting!.rating - a.tasting!.rating) || (b.createdAt > a.createdAt ? 1 : -1))

  if (own.length > 0) {
    const ref = own[0]!
    let p = proposalFromBrew(ref, ctx)
    const refDate = new Date(ref.createdAt).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
    })
    lines.push({
      text: `Aus deinem besten Shot vom ${refDate} (${ref.tasting!.rating}★).`,
      kind: 'source',
    })

    const learned = ctx.learned.perBean[beanKey(ctx.bean.id, ctx.method)]
    const drift = driftCorrection(ctx.method, learned?.refDaysOffRoast ?? null, nowDays)
    if (drift.steps !== 0 && p.grindSetting !== undefined) {
      p = { ...p, grindSetting: Math.max(0, p.grindSetting + drift.steps) }
      lines.push({ text: drift.reason!, kind: 'modifier' })
    }

    if (fresh.hint) lines.push({ text: fresh.hint, kind: 'warning' })

    return {
      proposal: p,
      source: 'personal',
      headline: 'Dein Referenzpunkt',
      rationale: lines,
      warning: fresh.state === 'too-fresh' || fresh.state === 'stale' ? fresh.label : undefined,
    }
  }

  // 2 — Eigener bester Versuch, auch wenn er noch nicht überzeugt hat.
  //     Übernahme aus der alten PWA (docs/03 §2.3): Wer fünfmal gebrüht hat,
  //     will beim sechsten Mal nicht wieder beim Standard anfangen.
  //
  //     Aber nur, wenn der Versuch nicht selbst ein Fehler war: Ein mit
  //     „sauer" oder „bitter" bewerteter Durchgang ist nach der eigenen
  //     Logik der App falsch eingestellt gewesen. Ihn als Startpunkt
  //     anzubieten heißt, denselben Fehler noch einmal zu machen — der
  //     Standard aus der Wissensbasis ist dann die bessere Ausgangslage.
  const brauchbar = (b: Brew) => {
    const r = b.tasting?.rating ?? 0
    if (r >= 3) return true
    return r >= 2 && !(b.tasting?.defects?.length)
  }
  const attempts = ctx.beanHistory
    .filter(brauchbar)
    .sort(
      (a, b) =>
        (b.tasting!.rating - a.tasting!.rating) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )

  // Zwei Durchgänge zeigen, dass jemand an dieser Bohne arbeitet — gemessen
  // an der Historie, nicht am gefilterten Feld. Sonst hinge die Schwelle
  // daran, wie viele der Versuche brauchbar waren.
  if (ctx.beanHistory.length >= 2 && attempts.length >= 1) {
    const ref = attempts[0]!
    const p = proposalFromBrew(ref, ctx)
    lines.push({
      text: `Dein bisher bester Versuch mit dieser Bohne (${ref.tasting!.rating}★ von ${ctx.beanHistory.length} Durchgängen) — noch nicht perfekt, aber näher dran als der Standard.`,
      kind: 'source',
    })
    if (fresh.hint) lines.push({ text: fresh.hint, kind: 'warning' })
    return {
      proposal: p,
      source: 'own-attempt',
      headline: 'Dein bester Versuch',
      rationale: lines,
      warning: fresh.state === 'too-fresh' || fresh.state === 'stale' ? fresh.label : undefined,
      brewsUntilPersonal: Math.max(0, LEARN_THRESHOLDS.perBean - own.length),
    }
  }

  // 3 — Transfer von einer ähnlichen Bohne
  const candidates = ctx.methodHistory
    .filter((b) => (b.tasting?.rating ?? 0) >= 4 && b.beanId !== ctx.bean.id)
    .map((b) => ({ brew: b, bean: b.beanId }))

  const scored: { brew: Brew; score: number; bean: Bean }[] = []
  for (const c of candidates) {
    const other = ctx.allBeans?.find((x) => x.id === c.bean)
    if (!other) continue
    const s = similarity(ctx.bean, other)
    if (s >= 5) scored.push({ brew: c.brew, score: s, bean: other })
  }
  scored.sort((a, b) => b.score - a.score)

  if (scored.length > 0) {
    const best = scored[0]!
    let p = proposalFromBrew(best.brew, ctx)
    lines.push({
      text: `Übertragen von „${best.bean.name}" — ähnlicher Röstgrad und ähnliche Aufbereitung.`,
      kind: 'source',
    })
    p = applyBeanModifiers({ ...p, grindSetting: p.grindSetting }, ctx.bean, ctx, lines)
    if (fresh.hint) lines.push({ text: fresh.hint, kind: 'warning' })
    return {
      proposal: p,
      source: 'transfer',
      headline: 'Von einer ähnlichen Bohne',
      rationale: lines,
      warning: fresh.state === 'too-fresh' ? fresh.label : undefined,
      brewsUntilPersonal: LEARN_THRESHOLDS.perBean,
    }
  }

  // 4 — Methodendefault, angereichert mit Bohnenprofil
  let p = methodBase(ctx)
  lines.push({
    text: `Standard für ${ctx.bean.roastLevel === 'light' ? 'helle' : ctx.bean.roastLevel === 'dark' ? 'dunkle' : 'mittlere'} Röstung.`,
    kind: 'source',
  })
  p = applyBeanModifiers(p, ctx.bean, ctx, lines)
  p = applyPreferenceBias(p, ctx, lines)
  if (fresh.hint) lines.push({ text: fresh.hint, kind: 'warning' })

  return {
    proposal: p,
    source: 'default',
    headline: 'Startpunkt',
    rationale: lines,
    warning:
      fresh.state === 'too-fresh' || fresh.state === 'stale' ? fresh.label : undefined,
    brewsUntilPersonal: LEARN_THRESHOLDS.perBean,
  }
}
