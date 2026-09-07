/**
 * Diagnose-Engine — das Herzstück.
 *
 * Vier Stufen (Solution Design §6.2). Eine Stufe darf erst feuern, wenn alle
 * vorherigen leer sind. Ausgegeben wird GENAU EINE Korrektur.
 *
 * Aufteilung Code/Daten: Die Bedingungen stehen als Code hier, weil sich
 * Ausdrücke aus JSON nicht sicher auswerten lassen. Alles andere —
 * Erklärtexte, Schwellen, Technikschritte, Konfidenz — kommt aus
 * `data/diagnostics.json`. Fachliche Textänderungen brauchen keinen Codeeingriff.
 */
import type { BrewActual, Observation, Measurement, Tasting, Defect, BrewMethod } from '@domain'
import { extractionYield, beverageMass, flowRate } from '@domain'
import type { EngineContext } from '@/domain'
import { daysOffRoast } from '@/domain'
import { getRule, lrrFor, TARGET_RANGES, HARD_LIMITS, tolerances, roastRuleFor, tempRange, targetTimeRange, isImmersion, correctionOrder } from '@/kb'
import { correctionFromTime, describeCorrection, cappedNote, timeIsTrustworthy } from './grinder'
import { restWindow } from './freshness'
import { checkRun, detectLoop } from './runcheck'
import { de, fmtDauer, fmtSpanne, tage } from './text'
import type { Confidence, Suggestion, RunCheck } from './runcheck'

// Die Ausgabetypen gehören der unteren Stufe: Die Laufkontrolle liefert
// dieselben Vorschläge wie die Sensorik, nur aus objektiven Größen. Ein
// zweiter Typ mit gleichem Inhalt wäre eine Fehlerquelle.
export type { Confidence, Suggestion, RunCheck, RunNote, TimeBand, LoopInfo } from './runcheck'
export { detectLoop, checkRun, timeBand } from './runcheck'

export interface Diagnosis {
  stage: 0 | 1 | 2 | 3
  blocked: boolean
  headline: string
  summary: string
  suggestions: Suggestion[]
  techniqueSteps?: string[]
  checklist?: string[]
  escalation?: string[]
  saveAsReference?: boolean
  /** Berechnete Kennzahlen zur Anzeige */
  metrics?: { ey?: number; tds?: number; flowRateGs?: number }
  /**
   * Die vorgelagerte Laufkontrolle, damit die Ergebnisseite beide Stufen
   * zeigen kann: erst was die Uhr sagte, dann was der Geschmack ergänzt.
   */
  run?: RunCheck
}

export interface DiagnoseInput {
  ctx: EngineContext
  actual: BrewActual
  observations?: Observation
  measurement?: Measurement
  tasting?: Tasting
  targetTimeS?: [number, number]
}

const CONF_MAP: Record<string, Confidence> = {
  high: 'sicher',
  medium: 'wahrscheinlich',
  low: 'Versuch',
}

function ruleText(id: string, fallback: string): string {
  return getRule(id)?.explanation ?? fallback
}
function ruleConf(id: string): Confidence {
  return CONF_MAP[getRule(id)?.confidence ?? 'medium'] ?? 'wahrscheinlich'
}
function has(d: Defect[] | undefined, ...want: Defect[]): boolean {
  if (!d) return false
  return want.every((w) => d.includes(w))
}
function hasAny(d: Defect[] | undefined, ...want: Defect[]): boolean {
  if (!d) return false
  return want.some((w) => d.includes(w))
}

function blocked(
  ruleId: string,
  headline: string,
  summary: string,
  extra: Partial<Diagnosis> = {},
): Diagnosis {
  const r = getRule(ruleId)
  return {
    stage: 0,
    blocked: true,
    headline,
    summary,
    suggestions: [],
    techniqueSteps: r?.techniqueSteps,
    checklist: r?.checklist,
    ...extra,
  }
}

/**
 * Jede Empfehlung braucht einen nächsten Schritt für den Fall, dass sie nicht
 * wirkt — sonst steht der Nutzer beim zweiten Versuch ohne Plan da.
 * Reihenfolge nach Wirkstärke (kb/03 §1): Mahlgrad → Ratio → Temperatur.
 */
function fallbackAlternative(
  primary: Suggestion,
  actual: BrewActual,
  defects: Defect[] | undefined,
  method: string,
): string {
  const tooMuch = hasAny(defects, 'bitter', 'astringent', 'harsh', 'ashy')
  const temp = actual.waterTempC ?? 93
  // Ein Ratschlag, den die Maschine nicht ausführen kann, ist keiner:
  // Am Brühkopf eines Siebträgers gibt es keine 98 °C.
  const tr = tempRange(method as BrewMethod)
  const machbar = (t: number) => Math.round(Math.min(tr.max, Math.max(tr.min, t)))
  const ratio = actual.yieldG ? actual.yieldG / actual.doseG : actual.waterG ? actual.waterG / actual.doseG : 2

  if (primary.variable === 'grindSetting') {
    const t = machbar(tooMuch ? temp - 2 : temp + 2)
    // Steht die Temperatur schon am Anschlag, hilft nur das Verhältnis.
    if (t === Math.round(temp)) {
      return `Falls das nicht hilft: Ratio auf 1:${de((ratio + (tooMuch ? -0.2 : 0.2)), 1)}.`
    }
    return `Falls das nicht hilft: Temperatur auf ${t} °C.`
  }
  if (primary.variable === 'waterTempC') {
    return method === 'aeropress'
      ? `Falls das nicht hilft: ${tooMuch ? 'gröber' : 'feiner'} mahlen.`
      : `Falls das nicht hilft: Ratio auf 1:${de((ratio + (tooMuch ? -0.2 : 0.2)), 1)}.`
  }
  if (primary.variable === 'ratio') {
    return `Falls das nicht hilft: ${tooMuch ? 'gröber' : 'feiner'} mahlen.`
  }
  if (primary.variable === 'stirCount') {
    const t = machbar(temp + 3)
    if (t === Math.round(temp)) return 'Falls das nicht hilft: einmal mehr rühren.'
    return `Falls das nicht hilft: Temperatur auf ${t} °C.`
  }
  return 'Falls das nicht hilft: eine Größe zurück und in halben Schritten weiter.'
}

/** Auf den Bereich klammern, den diese Methode wirklich fahren kann. */
function clampTemp(method: BrewMethod, t: number): number {
  const tr = tempRange(method)
  return Math.round(Math.min(tr.max, Math.max(tr.min, t)))
}

// ── Hauptfunktion ─────────────────────────────────────────────────────

export function diagnose(input: DiagnoseInput): Diagnosis {
  const { ctx, actual, observations: obs, measurement: meas, tasting } = input
  const defects = tasting?.defects
  const method = ctx.method
  const isEspresso = method === 'espresso'
  // „Shot" ist Espressosprache. Am Handfilter heißt es Durchgang.
  const lauf = isEspresso ? 'Der Shot lief' : 'Der Brew lief'

  // Kennzahlen
  const lrr = lrrFor(method, actual.inverted)
  const bevG =
    meas?.beverageMassG ??
    (isEspresso ? actual.yieldG : actual.waterG ? beverageMass(actual.waterG, actual.doseG, lrr) : undefined)
  const ey = meas && bevG ? extractionYield(meas.tdsPct, bevG, actual.doseG) : undefined
  const metrics = {
    ey: ey ? Math.round(ey * 10) / 10 : undefined,
    tds: meas?.tdsPct,
    flowRateGs:
      isEspresso && actual.yieldG ? Math.round(flowRate(actual.yieldG, actual.timeS) * 100) / 100 : undefined,
  }

  const targetT = input.targetTimeS
  const targetMid = targetT ? (targetT[0] + targetT[1]) / 2 : undefined
  const tol = tolerances(method)
  // Zielband plus Kurstoleranz — innerhalb davon gilt die Zeit als getroffen.
  const timeInTarget = targetMid !== undefined
    ? Math.abs(actual.timeS - targetMid) <= tol.timeS
    : true

  // ════ STUFE 0 — GATES ════════════════════════════════════════════════

  // D-00 Abgebrochener Durchgang
  //
  // Eine Zeit weit unter dem Ziel ist kein Extraktionsfehler, sondern ein
  // Abbruch — die große Stoppfläche lässt sich beim Hantieren leicht
  // auslösen. Daraus eine Mahlgradkorrektur abzuleiten und sie „sicher"
  // zu nennen, wäre schlicht falsch.
  // Fehlt das Ziel im Aufruf, wird es hier hergeleitet: Eine Schutzregel
  // darf nicht davon abhängen, was der Aufrufer mitgeschickt hat.
  const zielFuerSperre =
    targetT ??
    targetTimeRange(method, actual.doseG, ctx.bean.roastLevel, actual.yieldG)
  const zielMitte = zielFuerSperre ? (zielFuerSperre[0] + zielFuerSperre[1]) / 2 : null
  if (zielMitte && actual.timeS > 0 && actual.timeS < zielMitte * 0.35) {
    return blocked(
      'D-00',
      'Das war kein vollständiger Brew',
      `Aufgezeichnet sind ${fmtDauer(actual.timeS)} bei einem Ziel von ${fmtDauer(zielMitte)}. ` +
        `Aus einem abgebrochenen Brew lässt sich nichts ableiten — ` +
        `${isEspresso ? 'zieh den Shot noch einmal' : 'brüh noch einmal'} und trag die volle Zeit ein.`,
      { metrics },
    )
  }

  // D-05 Unplausible Messung
  if (ey !== undefined && (ey > (HARD_LIMITS.implausibleEyAbove as number) || ey < 12)) {
    return blocked(
      'D-05',
      'Messwert unplausibel',
      `${de(ey, 1)} % Extraktion liegt außerhalb des physikalisch Möglichen. ${ruleText('D-05', '')}`,
      { metrics },
    )
  }

  // D-01 Kanalbildung
  if (
    isEspresso &&
    (obs?.flowState === 'uneven' ||
      obs?.flowState === 'spritzing' ||
      obs?.puckState === 'crater' ||
      obs?.puckState === 'sideChannel')
  ) {
    return blocked(
      'D-01',
      'Channeling — zuerst die Verteilung',
      ruleText(
        'D-01',
        'Ein Teil des Wassers hat den Kaffee umgangen. Die Zeit sagt deshalb nichts über deinen Mahlgrad aus.',
      ),
      { metrics },
    )
  }

  // D-02 Sauer UND bitter
  if (has(defects, 'sour', 'bitter') || has(defects, 'sour', 'astringent')) {
    const r = getRule('D-02')
    return blocked(
      'D-02',
      'Ungleichmäßige Extraktion',
      ruleText('D-02', 'Sauer und bitter gleichzeitig heißt: ein Teil zu viel, ein Teil zu wenig.'),
      { metrics, techniqueSteps: r?.techniqueByMethod?.[method] ?? r?.techniqueSteps },
    )
  }

  // D-03 / D-04 Frische
  const days = daysOffRoast(ctx.bag, ctx.today)
  if (days !== null) {
    const win = restWindow(method, ctx.bean.roastLevel, !!ctx.bean.isDecaf)
    if (days > 60) {
      return blocked(
        'D-04',
        'Bohne überaltert',
        `${tage(days)} nach Röstung. Aromaverlust und oxidierte Fette lassen sich durch keine Einstellung reparieren.`,
        { metrics },
      )
    }
    if (days < win.min) {
      return blocked(
        'D-03',
        'Noch zu frisch',
        `Erst ${tage(days)} nach Röstung. Bis Tag ${win.min} verdrängt das CO₂ das Wasser — die Ergebnisse sind nicht stabil. Warte noch ${win.min - days} Tag${win.min - days === 1 ? '' : 'e'}.`,
        { metrics },
      )
    }
  }

  // D-06 Wasserverdacht: Extraktion objektiv gut, schmeckt trotzdem flach
  if (
    ey !== undefined &&
    ey >= ctx.settings.targetEy[0] &&
    ey <= ctx.settings.targetEy[1] &&
    (tasting?.rating ?? 5) <= 2 &&
    hasAny(defects, 'flat') &&
    !hasAny(defects, 'sour', 'bitter')
  ) {
    return blocked(
      'D-06',
      'Das liegt vermutlich am Wasser',
      ruleText('D-06', 'Deine Extraktion ist korrekt, der Kaffee schmeckt trotzdem flach.'),
      { metrics },
    )
  }

  // D-07 Röstungsverdacht durch Schleifenerkennung
  const loop = detectLoop(ctx.beanHistory)
  if (loop.stuck && loop.direction === 'finer' && hasAny(defects, 'sour') && hasAny(defects, 'bitter')) {
    return blocked(
      'D-07',
      'Das ist die Röstung, nicht deine Einstellung',
      ruleText('D-07', ''),
      {
        metrics,
        escalation: [
          'Röstdatum und Röstgrad prüfen',
          'Mit weiterer Ratio und höherer Temperatur versuchen',
          'Bohne wechseln',
        ],
      },
    )
  }

  // ════ STUFE 1 — OBJEKTIV (nur mit Messung) ══════════════════════════

  if (ey !== undefined && meas) {
    const [eyMin, eyMax] = ctx.settings.targetEy
    const tdsRange = isEspresso
      ? (TARGET_RANGES.espressoClassic.tds as [number, number])
      : (TARGET_RANGES.goldenCup.tdsFilter as [number, number])
    const tdsLow = meas.tdsPct < tdsRange[0]
    const tdsHigh = meas.tdsPct > tdsRange[1]
    const eyLow = ey < eyMin
    const eyHigh = ey > eyMax

    if (!eyLow && !eyHigh && !tdsLow && !tdsHigh) {
      return {
        stage: 1,
        blocked: false,
        headline: 'Im Zielkorridor',
        summary: `Extraktion ${de(ey, 1)} % und Stärke ${de(meas.tdsPct, 2)} % liegen beide im Ziel. Als Referenz speichern?`,
        suggestions: [],
        saveAsReference: true,
        metrics,
      }
    }

    const sugg: Suggestion[] = []
    if (eyLow || eyHigh) {
      const dir = eyLow ? 'decrease' : 'increase'
      const corr =
        targetMid && timeIsTrustworthy(obs?.flowState)
          ? correctionFromTime(actual.timeS, targetMid, method, ctx.grinder, actual.grindSetting?.value)
          : null
      const what = corr
        ? describeCorrection(corr, ctx.grinder)
        : `${eyLow ? '2 Schritte feiner' : '2 Schritte gröber'}`
      sugg.push({
        ruleId: eyLow ? 'D-11' : 'D-17',
        what,
        why: `Deine Extraktion liegt bei ${de(ey, 1)} % — Ziel sind ${eyMin}–${eyMax} %.`,
        expectation: corr?.expectedTimeS
          ? `Erwartete Zeit danach: ${corr.expectedTimeS} s. Extraktion sollte Richtung ${de(((eyMin + eyMax) / 2), 0)} % gehen.`
          : `Die Extraktion sollte sich Richtung ${de(((eyMin + eyMax) / 2), 0)} % bewegen.`,
        confidence: 'sicher',
        variable: 'grindSetting',
        direction: dir,
        delta: corr?.steps ?? (eyLow ? -2 : 2),
        newValue:
          actual.grindSetting?.value !== undefined
            ? actual.grindSetting.value + (corr?.steps ?? (eyLow ? -2 : 2))
            : undefined,
      })
    }
    if (tdsLow || tdsHigh) {
      const delta = tdsLow ? -0.2 : 0.2
      const cur = actual.yieldG ? actual.yieldG / actual.doseG : actual.waterG! / actual.doseG
      sugg.push({
        ruleId: tdsLow ? 'D-13' : 'D-15',
        what: `Ratio auf 1:${de((cur + delta), 1)} ${tdsLow ? 'enger' : 'weiter'}`,
        why: `Die Stärke liegt bei ${de(meas.tdsPct, 2)} % — Ziel sind ${tdsRange[0]}–${tdsRange[1]} %.`,
        expectation: `Das Getränk wird ${tdsLow ? 'dichter' : 'leichter'}, die Extraktion bleibt gleich.`,
        confidence: 'sicher',
        variable: 'ratio',
        direction: tdsLow ? 'decrease' : 'increase',
        delta,
        newValue: Math.round((cur + delta) * 10) / 10,
      })
    }
    return {
      stage: 1,
      blocked: false,
      headline: eyLow ? 'Unterextrahiert' : eyHigh ? 'Überextrahiert' : 'Stärke anpassen',
      summary: `Extraktion ${de(ey, 1)} %, Stärke ${de(meas.tdsPct, 2)} %.`,
      suggestions: sugg,
      metrics,
    }
  }

  // ════ STUFE 0,5 — LAUFKONTROLLE ══════════════════════════════════════
  //
  // Sie hat den Nutzer im Brüh-Screen schon gesehen; hier läuft sie noch
  // einmal, weil ihr Befund mit dem Geschmack zusammengeführt werden muss.
  // Reine Funktion, gleiche Eingaben, gleiches Ergebnis.
  const run = checkRun({ ctx, actual, observations: obs, targetTimeS: input.targetTimeS })

  // ════ STUFE 2 — SENSORISCH ═══════════════════════════════════════════

  const sugg: Suggestion[] = []
  // F-22 (√(t_ist/t_ziel)) ist Durchflussphysik und gilt nur für
  // Perkolation. Bei Immersion — AeroPress, French Press — ist die Zeit
  // GEWÄHLT, kein Ergebnis: Eine lange Gesamtzeit heißt dort nur, dass
  // länger gewartet wurde, und darf nie in eine Grind-Korrektur übersetzt
  // werden.
  const grindCorr =
    !isImmersion(method) && targetMid && timeIsTrustworthy(obs?.flowState)
      ? correctionFromTime(actual.timeS, targetMid, method, ctx.grinder, actual.grindSetting?.value)
      : null

  const push = (s: Suggestion) => {
    if (!sugg.some((x) => x.variable === s.variable)) sugg.push(s)
  }
  const grindSuggestion = (
    ruleId: string,
    finer: boolean,
    why: string,
    fallbackSteps = 2,
  ): Suggestion => {
    const steps = grindCorr ? grindCorr.steps : finer ? -fallbackSteps : fallbackSteps
    const what = grindCorr
      ? describeCorrection(grindCorr, ctx.grinder)
      : `${fallbackSteps} Schritt${fallbackSteps === 1 ? '' : 'e'} ${finer ? 'feiner' : 'gröber'}`
    return {
      ruleId,
      what,
      why,
      expectation: [
        // Bei gedeckelter Korrektur wäre eine präzise Zeitprognose unehrlich —
        // wir gehen ja bewusst nicht den ganzen Weg.
        grindCorr?.capped
          ? `Der Shot wird deutlich langsamer, aber noch nicht am Ziel — ${finer ? 'weniger Säure' : 'weniger Bitterkeit'} sollte schon spürbar sein.`
          : grindCorr?.expectedTimeS
            ? `Erwartete Zeit danach: ${grindCorr.expectedTimeS} s. ${finer ? 'Weniger Säure, mehr Süße.' : 'Weniger Bitterkeit und Trockenheit.'}`
            : finer
              ? 'Der Kaffee sollte süßer und runder werden.'
              : 'Der Kaffee sollte klarer und weniger bitter werden.',
        grindCorr ? cappedNote(grindCorr, ctx.grinder) : undefined,
      ]
        .filter(Boolean)
        .join(' '),
      confidence: ruleConf(ruleId),
      variable: 'grindSetting',
      direction: finer ? 'decrease' : 'increase',
      delta: steps,
      newValue:
        actual.grindSetting?.value !== undefined ? actual.grindSetting.value + steps : undefined,
    }
  }

  // ── Espresso: Flusszustände zuerst ──
  if (isEspresso && (obs?.flowState === 'choked' || actual.timeS > 45)) {
    push(grindSuggestion('D-50', false, `${lauf} ${fmtDauer(actual.timeS)} — das Bett ist deutlich zu dicht.`, 4))
  } else if (isEspresso && (obs?.flowState === 'gusher' || actual.timeS < 15)) {
    push(grindSuggestion('D-51', true, `${lauf} nur ${fmtDauer(actual.timeS)} — viel zu wenig Widerstand.`, 4))
  }

  // ── Unterextraktion ──
  if (hasAny(defects, 'sour', 'salty', 'thin', 'shortFinish') && !hasAny(defects, 'bitter')) {
    const salty = has(defects, 'sour', 'salty')
    // AeroPress: Agitation vor Mahlgrad (D-26, kb/10 §5.2)
    if (method === 'aeropress') {
      push({
        ruleId: 'D-26',
        what: `Ein Rührvorgang mehr (${(actual.stirCount ?? 2) + 1}×)`,
        why: salty
          ? 'Salzig zusammen mit sauer ist das eindeutigste Zeichen für Unterextraktion.'
          : 'Der Kaffee ist unterextrahiert.',
        expectation: 'Rühren wirkt etwa wie 30–45 s mehr Ziehzeit — bei gleichmäßigerer Extraktion.',
        confidence: 'sicher',
        variable: 'stirCount',
        direction: 'increase',
        delta: 1,
        newValue: (actual.stirCount ?? 2) + 1,
      })
    } else if (!timeInTarget && grindCorr) {
      push(
        grindSuggestion(
          'D-22',
          true,
          `${lauf} ${fmtDauer(actual.timeS)} statt ${fmtSpanne(targetT!)} — zu wenig Kontakt.`,
        ),
      )
    } else if ((actual.waterTempC ?? 93) < 96) {
      push({
        ruleId: 'D-23',
        what: `Temperatur auf ${clampTemp(method, (actual.waterTempC ?? 93) + 2)} °C`,
        why: salty
          ? 'Salzig und sauer ohne Süße heißt Unterextraktion — die Zeit stimmt aber schon.'
          : 'Die Zeit liegt im Ziel, es fehlt trotzdem Extraktion.',
        expectation: '+2 °C entsprechen etwa 0,5 Prozentpunkten mehr Extraktion. Mehr Süße, weniger Säure.',
        confidence: 'wahrscheinlich',
        variable: 'waterTempC',
        direction: 'increase',
        delta: 2,
        newValue: (actual.waterTempC ?? 93) + 2,
      })
    } else {
      push(grindSuggestion('D-20', true, 'Der Kaffee ist unterextrahiert.'))
    }
  }

  // ── Überextraktion ──
  if (hasAny(defects, 'bitter', 'astringent', 'harsh', 'ashy') && !hasAny(defects, 'sour')) {
    // French Press: Der einzige Fehler, der NACH dem Brühen passiert.
    // Stand der Kaffee auf dem Satz, ist die Bitterkeit erklärt — an den
    // Einstellungen zu drehen würde einen intakten Brew verschlimmbessern.
    if (method === 'frenchpress' && obs?.decantedImmediately === false) {
      return blocked(
        'D-FP-01',
        'Der Kaffee stand auf dem Satz',
        'In der Kanne extrahiert er weiter — nach zehn Minuten ist aus einem ' +
          'guten Brew ein bitterer geworden, ohne dass an der Einstellung etwas ' +
          'falsch war. Nächstes Mal sofort umfüllen und dieselben Werte noch ' +
          'einmal fahren, bevor du etwas änderst.',
        { metrics },
      )
    }
    // AeroPress: Temperatur ist der stärkste Bitterkeitshebel (D-35)
    if (method === 'aeropress') {
      push({
        ruleId: 'D-35',
        what: `Temperatur auf ${clampTemp(method, (actual.waterTempC ?? 92) - 5)} °C`,
        why: 'Bitterstoffe lösen sich stärker temperaturabhängig als Zucker und Säuren.',
        expectation: 'Weniger Bitterkeit bei gleicher Süße — die Extraktion wird selektiver, nicht nur geringer.',
        confidence: 'sicher',
        variable: 'waterTempC',
        direction: 'decrease',
        delta: -5,
        newValue: (actual.waterTempC ?? 92) - 5,
      })
    } else if (!timeInTarget && grindCorr) {
      push(
        grindSuggestion(
          'D-31',
          false,
          `${lauf} ${fmtDauer(actual.timeS)} statt ${fmtSpanne(targetT!)} — zu lange Kontaktzeit.`,
        ),
      )
    } else if ((ctx.bean.roastLevel === 'dark' || ctx.bean.roastLevel === 'medium-dark') && (actual.waterTempC ?? 93) > 88) {
      push({
        ruleId: 'D-36',
        what: `Temperatur auf ${clampTemp(method, (actual.waterTempC ?? 93) - 3)} °C`,
        why: 'Dunkle Röstungen sind porös, extrahieren leicht und kippen schnell in die Bitterkeit.',
        expectation: 'Weniger Bitterkeit und Trockenheit im Abgang.',
        confidence: 'sicher',
        variable: 'waterTempC',
        direction: 'decrease',
        delta: -3,
        newValue: (actual.waterTempC ?? 93) - 3,
      })
    } else if ((actual.waterTempC ?? 93) > 90) {
      push({
        ruleId: 'D-32',
        what: `Temperatur auf ${clampTemp(method, (actual.waterTempC ?? 93) - 2)} °C`,
        why: 'Die Zeit liegt im Ziel — dann ist die Temperatur der nächste Hebel.',
        expectation: 'Etwa 0,5 Prozentpunkte weniger Extraktion. Weniger Bitterkeit.',
        confidence: 'wahrscheinlich',
        variable: 'waterTempC',
        direction: 'decrease',
        delta: -2,
        newValue: (actual.waterTempC ?? 93) - 2,
      })
    } else {
      push(grindSuggestion('D-30', false, 'Der Kaffee ist überextrahiert.'))
    }
  }

  // ── Stärke ohne Extraktionsfehler ──
  if (hasAny(defects, 'thin') && !hasAny(defects, 'sour', 'bitter')) {
    const cur = actual.yieldG ? actual.yieldG / actual.doseG : actual.waterG! / actual.doseG
    const step = isEspresso ? 0.2 : 0.5
    push({
      ruleId: 'D-40',
      what: `Ratio auf 1:${de((cur - step), 1)} enger`,
      why: 'Kein Extraktionsfehler — es ist schlicht zu wenig Kaffee pro Wasser.',
      expectation: 'Mehr Substanz und Körper, gleicher Geschmackscharakter.',
      confidence: 'sicher',
      variable: 'ratio',
      direction: 'decrease',
      delta: -step,
      newValue: Math.round((cur - step) * 10) / 10,
    })
  }

  // ── V60: Drawdown ──
  if (method === 'v60' && obs?.drawdownS && actual.timeS > 0) {
    const pct = (obs.drawdownS / actual.timeS) * 100
    if (pct > 45) {
      push(
        grindSuggestion(
          'D-60',
          false,
          `Der Drawdown dauerte ${obs.drawdownS} s — ${de(pct, 0)} % der Gesamtzeit. Das Bett setzt sich zu.`,
        ),
      )
    }
  }

  // ── Die zwei Stufen zusammenführen ──────────────────────────────────
  //
  // Bisher ging die Zeitabweichung verloren, wenn kein Fehlertag gesetzt
  // war: Ein Shot mit 19 s bei 28 s Ziel und leerem Tasting bekam „keine
  // klare Korrektur", obwohl die Uhr die Antwort längst enthielt. Jetzt
  // gilt: Was die Laufkontrolle gefunden hat, geht nie verloren — es wird
  // mit dem Geschmack verrechnet.
  const runGrind =
    run.suggestion?.variable === 'grindSetting' ? run.suggestion : undefined
  const sensoryGrind = sugg.find((x) => x.variable === 'grindSetting')

  if (runGrind && sensoryGrind) {
    if (runGrind.direction === sensoryGrind.direction) {
      // Zwei unabhängige Signale, dieselbe Richtung. Die Zahl aus der Zeit
      // ist die genauere (F-22), die Begründung aus dem Geschmack die
      // verständlichere — beides zusammen, und die Konfidenz steigt.
      sensoryGrind.what = runGrind.what
      sensoryGrind.delta = runGrind.delta
      sensoryGrind.newValue = runGrind.newValue
      sensoryGrind.expectation = runGrind.expectation
      // Nicht die beiden Begründungen aneinanderhängen: Beide beschreiben
      // dieselbe Zeit, das ergäbe denselben Satz zweimal. Die Zeit kommt
      // aus der Laufkontrolle, der Geschmack fügt nur seine Bestätigung an.
      sensoryGrind.why = `${runGrind.why} Der Geschmack bestätigt es: ${
        hasAny(defects, 'bitter', 'astringent', 'harsh', 'ashy')
          ? 'zu viel extrahiert'
          : 'zu wenig extrahiert'
      }.`
      // „So sicher, wie es ohne Messung wird" — außer die Laufkontrolle
      // hat die Konfidenz schon gedrückt. Streut die eigene Vorbereitung
      // stärker als die Abweichung, schlagen auch zwei gleichgerichtete
      // Signale das Rauschen nicht; hier trotzdem „sicher" zu behaupten
      // würde der eigenen Regel D-9A widersprechen.
      sensoryGrind.confidence = run.confidenceHeldBack ? runGrind.confidence : 'sicher'
    } else {
      // Widerspruch. Der ist selbst der Befund — und zwar ein wertvoller:
      // Nach der Zeit müsste es andersherum schmecken, als es schmeckt.
      return conflictDiagnosis(run, sensoryGrind, actual, method, defects, metrics)
    }
  } else if (runGrind) {
    push(runGrind)
  }

  // ── Nichts gefunden ──
  if (sugg.length === 0) {
    const good = (tasting?.rating ?? 0) >= 4
    if (loop.oscillating && loop.lastTwoSettings) {
      const mid = Math.round((loop.lastTwoSettings[0] + loop.lastTwoSettings[1]) / 2)
      return {
        stage: 2,
        blocked: false,
        headline: 'Du kreist um das Optimum',
        summary: `Du bist zwischen ${loop.lastTwoSettings[1]} und ${loop.lastTwoSettings[0]} hin- und hergegangen. Du brauchst keine neue Richtung, sondern kleinere Schritte.`,
        suggestions: [
          {
            ruleId: 'loop-oscillation',
            what: `Mahlgrad ${mid} und ab jetzt in halben Schritten`,
            why: 'Das Optimum liegt zwischen deinen letzten beiden Einstellungen.',
            expectation: 'Ausgewogener als beide Vorgänger.',
            confidence: 'wahrscheinlich',
            variable: 'grindSetting',
            direction: 'adjust',
            newValue: mid,
          },
        ],
        metrics,
      }
    }
    return {
      stage: 3,
      blocked: false,
      headline: good ? 'Sitzt' : 'Keine klare Korrektur',
      summary: good
        ? 'Keine Fehler markiert und gut bewertet — als Referenz speichern?'
        : 'Zeit und Geschmack geben beide keine Richtung her. Markier beim nächsten Mal, was konkret stört.',
      suggestions: [],
      saveAsReference: good,
      metrics,
      run,
    }
  }

  // ── Röstgradabhängige Lesart ──
  // Sie ändert die Reihenfolge der Kaskade und liefert die Begründung,
  // warum derselbe Fehler hier etwas anderes bedeutet als anderswo.
  const rr = roastRuleFor(ctx.bean.roastLevel, defects ?? [])

  // ── Kardinalregel: genau EINE Empfehlung ──
  // Reihenfolge: Standard ist Grind → Ratio → Temperatur → Technik
  // (kb/14 §6). Methoden, die es anders wollen, sagen das in methods.json:
  // Die AeroPress rückt Agitation und Temperatur vor, die French Press
  // die Ratio — dort ist der Grind der schwächste Hebel.
  const order = rr
    ? // Röstgrad schlägt die Standardkaskade: bei dunkel+bitter zuerst die
      // Temperatur, bei dunkel+sauer zuerst die Technik.
      [...rr.order, 'grindSetting', 'ratio', 'waterTempC', 'stirCount', 'pourCount']
    : (correctionOrder(
        method,
        hasAny(defects, 'bitter', 'astringent', 'harsh', 'ashy')
          ? 'overextracted'
          : 'underextracted',
      ) ?? ['grindSetting', 'ratio', 'waterTempC', 'stirCount', 'pourCount'])
  const rank = (v: string) => {
    const i = order.indexOf(v)
    return i === -1 ? 99 : i
  }
  sugg.sort((a, b) => rank(a.variable) - rank(b.variable))

  const primary = sugg[0]!
  const secondary = sugg[1]
  primary.alternative = secondary
    ? `Falls das nicht hilft: ${secondary.what}.`
    : fallbackAlternative(primary, actual, defects, method)

  return {
    stage: 2,
    blocked: false,
    headline: headlineFor(primary, defects),
    summary: primary.why,
    suggestions: [primary],
    metrics,
    run,
  }
}

/**
 * Zeit und Geschmack zeigen in verschiedene Richtungen.
 *
 * Das ist kein Fehler der Engine, sondern eine eigene Diagnose — und eine
 * der wenigen Stellen, an denen die richtige Antwort „an keinem Parameter
 * drehen" lautet. Wer hier trotzdem einen Mahlgrad ausgibt, macht genau
 * die Hälfte der Tasse schlechter.
 */
function conflictDiagnosis(
  run: RunCheck,
  sensory: Suggestion,
  actual: BrewActual,
  method: BrewMethod,
  defects: Defect[] | undefined,
  metrics: Diagnosis['metrics'],
): Diagnosis {
  const zeitWillGroeber = run.suggestion!.direction === 'increase'
  /**
   * Der Zeitsatz gehört genau einmal auf den Bildschirm.
   *
   * Gibt dieser Zweig eine Empfehlung aus, blendet die Laufkontroll-Karte
   * ihren eigenen Befund aus — dann muss er hier stehen. Gibt er keine aus,
   * zeigt die Karte ihn selbst.
   */
  const zeitSatz = (mitEmpfehlung: boolean) => (mitEmpfehlung ? `${run.summary} ` : '')
  const technik: Record<string, string[]> = {
    espresso: ['WDT — das Mehl im Korb auflockern', 'Eben tampen, danach nicht klopfen', 'Präinfusion verlängern'],
    v60: ['Nach dem Bloom swirlen', 'Nicht auf das Papier gießen', 'Rao Spin am Ende'],
    aeropress: ['Gleichmäßig rühren', 'Mahlwerk auf Fines prüfen'],
    frenchpress: ['Kruste brechen und umrühren', 'Langsam pressen'],
  }

  if (zeitWillGroeber) {
    // Lange Zeit und trotzdem sauer. Bei so viel Kontakt fehlt keine
    // Extraktion — sie war ungleichmäßig. Gröber zu mahlen würde die
    // untererschöpfte Fraktion nur vergrößern (kb/14 D-02, kb/05 §1.2).
    return {
      stage: 2,
      blocked: true,
      headline: 'Zeit und Geschmack widersprechen sich',
      summary:
        `${zeitSatz(false)}Nach dieser Zeit dürfte nichts unterextrahiert schmecken — es schmeckt aber ` +
        `${defectWord(defects)}. Das heißt: nicht zu wenig Extraktion, sondern ungleichmäßige. Ein Teil des ` +
        'Kaffees ist erschöpft, ein anderer kaum berührt. Gröber mahlen würde die untererschöpfte Hälfte ' +
        'größer machen, feiner die erschöpfte — deshalb hier kein Mahlgrad, sondern erst die Gleichmäßigkeit.',
      suggestions: [],
      techniqueSteps: technik[method],
      escalation: [
        'Verteilung korrigieren und genau dieselben Werte wiederholen',
        'Röstdatum und Röstgrad prüfen — unterentwickelte Röstungen behalten die Säure',
        'Wasser prüfen: Karbonathärte über 80 mg/L puffert die Süße weg',
        'Bleibt es dabei, passt die Bohne nicht zur Methode',
      ],
      metrics,
      run,
    }
  }

  // Kurze Zeit und trotzdem bitter. Der Mahlgrad kann es nicht sein —
  // feiner wäre für die Zeit richtig und für den Geschmack falsch. Was
  // bleibt, ist die Selektivität: Bitterstoffe lösen sich stärker
  // temperaturabhängig als Zucker und Säuren (kb/10 §5.1).
  const tr = tempRange(method)
  const temp = actual.waterTempC ?? 93
  const ziel = clampTemp(method, temp - 3)
  const amBoden = ziel >= Math.round(temp)

  return {
    stage: 2,
    blocked: amBoden,
    headline: 'Bitter, obwohl es zu schnell lief',
    summary:
      `${zeitSatz(!amBoden)}Bei so kurzem Kontakt kommt Bitterkeit nicht vom Mahlgrad — feiner zu mahlen wäre ` +
      `für die Zeit richtig und für den Geschmack falsch. ` +
      (amBoden
        ? `Die Temperatur steht mit ${temp} °C schon am unteren Ende dieser Methode (${tr.min} °C), ` +
          'als Hebel fällt sie damit weg. Dann bleibt die Röstung oder die Verteilung.'
        : 'Der wirksame Hebel ist die Temperatur: Sie verschiebt die Selektivität zugunsten der süßen Fraktion.'),
    suggestions: amBoden
      ? []
      : [
          {
            ruleId: 'D-32',
            what: `Temperatur auf ${ziel} °C`,
            why: 'Bitterkeit bei kurzer Kontaktzeit ist ein Temperatur- und kein Mahlgradbefund.',
            expectation:
              'Weniger Bitterkeit bei gleicher Süße. Die Zeit bleibt, wo sie ist — die musst du im nächsten Durchgang getrennt angehen.',
            confidence: 'wahrscheinlich',
            variable: 'waterTempC',
            direction: 'decrease',
            delta: ziel - Math.round(temp),
            newValue: ziel,
            alternative: `Falls das nicht hilft: Verteilung prüfen — ein Kanal lässt einen Shot schnell UND bitter werden. Danach ${sensory.what.toLowerCase()}.`,
          },
        ],
    escalation: amBoden
      ? [
          'Verteilung prüfen — ein Kanal macht schnell und bitter gleichzeitig',
          'Dosis um 0,5 g erhöhen: mehr Bett, mehr Widerstand',
          'Röstgrad prüfen — dunkle Röstungen kippen früh in die Bitterkeit',
        ]
      : undefined,
    metrics,
    run,
  }
}

/** Die Fehlertags in einem lesbaren Satzteil. */
function defectWord(defects: Defect[] | undefined): string {
  const worte: Partial<Record<Defect, string>> = {
    sour: 'sauer',
    salty: 'salzig',
    thin: 'dünn',
    shortFinish: 'kurz im Abgang',
  }
  const gefunden = (defects ?? []).map((d) => worte[d]).filter(Boolean) as string[]
  if (!gefunden.length) return 'unterextrahiert'
  if (gefunden.length === 1) return gefunden[0]!
  return `${gefunden.slice(0, -1).join(', ')} und ${gefunden[gefunden.length - 1]}`
}

/**
 * Die Überschrift muss zur Empfehlung passen, nicht zu den Tags.
 * Sonst steht „Überextrahiert" über „feiner mahlen" — und der Nutzer glaubt
 * der App zu Recht nicht mehr.
 */
function headlineFor(s: Suggestion, defects: Defect[] | undefined): string {
  const finer = s.direction === 'decrease' && s.variable === 'grindSetting'
  const coarser = s.direction === 'increase' && s.variable === 'grindSetting'

  if (finer) return 'Zu wenig extrahiert'
  if (coarser) return 'Zu viel extrahiert'
  if (s.variable === 'ratio') return s.direction === 'decrease' ? 'Zu dünn' : 'Zu konzentriert'
  if (s.variable === 'waterTempC')
    return s.direction === 'decrease' ? 'Zu viel extrahiert' : 'Zu wenig extrahiert'
  if (s.variable === 'stirCount') return 'Zu wenig extrahiert'
  return hasAny(defects, 'bitter', 'astringent') ? 'Zu viel extrahiert' : 'Anpassung'
}
