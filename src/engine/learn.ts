/**
 * Lernmodelle.
 *
 * Briefing B5: „wie ich brühe" und „was mir schmeckt" sind ZWEI verschiedene
 * Probleme. Ein einziges „Lernen"-Feature erfüllt die Anforderung nicht.
 *
 *   Prozessmodell    → wie zuverlässig treffe ich meine Zielwerte?
 *   Präferenzmodell  → wohin weicht mein Geschmack vom Standard ab?
 *   Pro-Bohne-Modell → was hat bei genau dieser Bohne funktioniert?
 */
import type { Brew, Bean, Bag, BrewMethod } from '@domain'
import { METHODS } from '@/labels'
import type { LearnedModels, PerBeanModel, PreferenceModel, ProcessModel } from '@/domain'
import { beanKey, daysOffRoast, EMPTY_LEARNED } from '@/domain'
import { getMethodDefaults, targetTimeRange } from '@/kb'
import { gewicht, streuung } from './ueberzeugung'
import { GOOD_RATING, LEARN_THRESHOLDS } from '@/config'

/** Tage zwischen einem ISO-Zeitpunkt und heute, nie negativ. */
function tageSeit(iso: string, heute: Date): number {
  return Math.max(0, Math.round((heute.getTime() - new Date(iso).getTime()) / 86_400_000))
}

/**
 * Zahl in deutscher Schreibweise für Texte, die der Nutzer liest.
 *
 * Die Engine formuliert ganze Sätze — dort darf kein „1:2.8" stehen,
 * während die Oberfläche daneben „1:2,8" zeigt.
 */
function de(v: number, decimals = 1): string {
  return v.toFixed(decimals).replace('.', ',')
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1))
}

export function ratioOf(b: Brew): number | null {
  const a = b.actual
  if (a.yieldG) return a.yieldG / a.doseG
  if (a.waterG) return a.waterG / a.doseG
  return null
}

export function recompute(brews: Brew[], beans: Bean[], bags: Bag[], today: Date): LearnedModels {
  const out: LearnedModels = {
    process: {},
    preference: {},
    perBean: {},
    computedAt: today.toISOString(),
  }
  if (brews.length === 0) return { ...EMPTY_LEARNED, computedAt: out.computedAt }

  const beanById = new Map(beans.map((b) => [b.id, b]))
  const bagById = new Map(bags.map((b) => [b.id, b]))
  const methods = METHODS

  // ── Pro Bohne und Methode ───────────────────────────────────────────
  const groups = new Map<string, Brew[]>()
  for (const b of brews) {
    const key = beanKey(b.beanId, b.method)
    const list = groups.get(key) ?? []
    list.push(b)
    groups.set(key, list)
  }

  for (const [key, list] of groups) {
    const good = list.filter((b) => (b.tasting?.rating ?? 0) >= GOOD_RATING)
    if (good.length < LEARN_THRESHOLDS.perBean) continue

    const best = [...good].sort(
      (a, b) =>
        (b.tasting!.rating - a.tasting!.rating) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0]!

    const bag = bagById.get(best.bagId)
    const model: PerBeanModel = {
      bestBrewId: best.id,
      medianParams: {
        doseG: median(good.map((b) => b.actual.doseG)),
        timeS: median(good.map((b) => b.actual.timeS)),
        waterTempC: median(good.map((b) => b.actual.waterTempC ?? 93)),
      },
      medianGrindSteps: median(
        good.map((b) => b.actual.grindSetting?.value).filter((v): v is number => v !== undefined),
      ),
      refDaysOffRoast: daysOffRoast(bag, new Date(best.createdAt)) ?? undefined,
      sampleSize: good.length,
      avgRating: good.reduce((a, b) => a + b.tasting!.rating, 0) / good.length,
    }
    out.perBean[key] = model
  }

  // ── Prozess- und Präferenzmodell je Methode ─────────────────────────
  for (const m of methods) {
    const ofMethod = brews.filter((b) => b.method === m)
    if (ofMethod.length === 0) continue

    // Prozessmodell: Treffe ich meine Zielzeit? Wie stark streue ich?
    const deviations: number[] = []
    const times: number[] = []
    for (const b of ofMethod) {
      const bean = beanById.get(b.beanId)
      const range = targetTimeRange(m, b.actual.doseG, bean?.roastLevel, b.actual.yieldG)
      times.push(b.actual.timeS)
      if (range) deviations.push(b.actual.timeS - (range[0] + range[1]) / 2)
    }
    const process: ProcessModel = {
      timeBiasS: Math.round(median(deviations) * 10) / 10,
      consistencyS: Math.round(stdDev(times) * 10) / 10,
      sampleSize: ofMethod.length,
    }
    out.process[m] = process

    // Präferenzmodell: Wohin weichen meine GUTEN Brews vom Standard ab?
    const good = ofMethod.filter((b) => (b.tasting?.rating ?? 0) >= GOOD_RATING)
    if (good.length === 0) continue

    const ratioDeltas: number[] = []
    const tempDeltas: number[] = []
    for (const b of good) {
      const bean = beanById.get(b.beanId)
      if (!bean) continue
      const def = getMethodDefaults(m, bean.roastLevel)
      const r = ratioOf(b)
      if (r !== null) ratioDeltas.push(r - def.ratio)
      if (b.actual.waterTempC) tempDeltas.push(b.actual.waterTempC - def.waterTempC)
    }

    const n = good.length
    const confidence = Math.min(1, n / LEARN_THRESHOLDS.biasStatement)
    const ratioBias = ratioDeltas.length ? Math.round(median(ratioDeltas) * 100) / 100 : 0
    const tempBiasC = tempDeltas.length ? Math.round(median(tempDeltas)) : 0

    // Wie tragfähig diese Vorliebe ist: aus Anzahl, Einigkeit und Alter.
    // Ersetzt die harte Schwelle, ab der der Bias vorher sprunghaft galt.
    const streuungRatio = streuung(ratioDeltas)
    const juengster = good.reduce(
      (a, b) => Math.min(a, tageSeit(b.createdAt, today)),
      Number.POSITIVE_INFINITY,
    )
    const alterTage = Number.isFinite(juengster) ? juengster : 0

    const pref: PreferenceModel = {
      ratioBias,
      tempBiasC,
      streuungRatio,
      alterTage,
      gewicht: gewicht({ n, streuung: streuungRatio, alter: alterTage }),
      // Mahlgrad bewusst NICHT global gemittelt: Mahlgradwerte sind nur
      // innerhalb derselben Mühle UND vergleichbarer Bohnendichte sinnvoll
      // vergleichbar. Das deckt bereits das Pro-Bohne-Modell ab.
      grindBiasSteps: 0,
      confidence,
      sampleSize: n,
      statement: statementFor(ratioBias, tempBiasC, n),
    }
    out.preference[m] = pref
  }

  return out
}

function statementFor(ratioBias: number, tempBias: number, n: number): string | undefined {
  if (n < LEARN_THRESHOLDS.biasStatement) return undefined
  const parts: string[] = []
  if (Math.abs(ratioBias) >= 0.15) {
    parts.push(
      `du magst es ${de(Math.abs(ratioBias), 1)} ${ratioBias < 0 ? 'enger' : 'weiter'} als der Standard`,
    )
  }
  if (Math.abs(tempBias) >= 2) {
    parts.push(`und ${Math.abs(tempBias)} °C ${tempBias > 0 ? 'heißer' : 'kühler'}`)
  }
  if (parts.length === 0) return undefined
  return `Nach ${n} guten Tassen: ${parts.join(' ')}.`
}

/** Methode eines Brews. Seit Schema 1 explizit gespeichert. */
export function methodOf(b: Brew): BrewMethod {
  return b.method
}

/** Wie viele gute Brews fehlen noch bis zur Personalisierung? */
export function brewsUntilPersonal(
  learned: LearnedModels,
  beanId: string,
  method: BrewMethod,
): number {
  const m = learned.perBean[beanKey(beanId, method)]
  const have = m?.sampleSize ?? 0
  return Math.max(0, LEARN_THRESHOLDS.perBean - have)
}

/**
 * Streuungswarnung (D-08): Bevor das Rezept geändert wird, muss der Vorgang
 * überhaupt wiederholbar sein.
 */
export function consistencyWarning(learned: LearnedModels, method: BrewMethod): string | null {
  const p = learned.process[method]
  if (!p || p.sampleSize < 5) return null
  if (method === 'espresso' && p.consistencyS > 4) {
    return `Deine Shotzeiten streuen um ±${de(p.consistencyS, 1)} s. Bevor du das Rezept änderst, mach es erst wiederholbar: auf 0,1 g wiegen, RDT, gleichmäßig tampen.`
  }
  return null
}
