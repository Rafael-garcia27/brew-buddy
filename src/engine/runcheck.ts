/**
 * Laufkontrolle — die erste von zwei Auswertungsstufen.
 *
 * Sie beantwortet die Frage, für die niemand den Kaffee probieren muss:
 * Ist der Durchgang so gelaufen, wie er laufen sollte? Zeit, Menge, Fluss,
 * Beobachtungen, Frische und Historie reichen dafür — und eine Abweichung
 * von zehn Sekunden ist ein härteres Signal als jeder Geschmackseindruck.
 *
 * Warum das eine eigene Stufe ist und nicht Teil von `diagnose()`:
 * kb/15 §3.1 trennt Phase C (den Mahlgrad über die Zeit finden) von
 * Phase D (den Geschmack feinjustieren). Wer beides in einem Schritt
 * abfragt, mischt zwei Signale und kann das Ergebnis hinterher keinem von
 * beiden zuordnen. Vorher lief die App genau in diese Falle: Ein Shot mit
 * 19 s bei 28 s Ziel bekam ohne Fehlertag die Antwort „keine klare
 * Korrektur" — obwohl die Zeit allein die Antwort schon enthielt.
 */
import type {
  BrewActual,
  Observation,
  Brew,
  BrewMethod,
  SpeedFeel,
  Grinder,
} from '@domain'
import { flowRate } from '@domain'
import type { EngineContext } from '@/domain'
import { daysOffRoast } from '@/domain'
import {
  tolerances,
  targetTimeRange,
  isImmersion,
  timeSignalsGrind,
  tempRange,
  targetFlowRate,
  RUN_BANDS,
  getRunRule,
} from '@/kb'
import { correctionFromTime, describeCorrection, cappedNote, timeIsTrustworthy, roundToStep } from './grinder'
import { restWindow } from './freshness'
import { de, fmtDauer, fmtSpanne, vorz, tage, tagen } from './text'

// ── Gemeinsame Ausgabetypen ───────────────────────────────────────────
//
// Sie leben hier und nicht in diagnose.ts, weil beide Stufen sie brauchen
// und die Laufkontrolle die untere von beiden ist. diagnose.ts reicht sie
// unverändert weiter, damit die Oberfläche nur einen Typ kennt.

export type Confidence = 'sicher' | 'wahrscheinlich' | 'Versuch'

export interface Suggestion {
  ruleId: string
  what: string
  why: string
  expectation: string
  confidence: Confidence
  alternative?: string
  variable: string
  direction: 'increase' | 'decrease' | 'adjust' | 'technique' | 'none'
  delta?: number
  /** Direkt anwendbarer neuer Wert, wenn berechenbar */
  newValue?: number
  /**
   * Die Erwartung als Zahl, nicht als Satz.
   *
   * `expectation` ist der Text für den Nutzer. Damit die App nachprüfen
   * kann, ob die Vorhersage eingetroffen ist, braucht sie denselben Wert
   * maschinenlesbar — sonst bliebe „danach 28 s" eine Behauptung, die
   * niemand je einlöst.
   */
  erwartung?: { groesse: 'zeit' | 'ausbringung'; wert: number }
}

/** Wie die Zeit zum Zielband steht. */
export type TimeBand =
  | 'unknown'
  | 'aborted'
  | 'farFast'
  | 'fast'
  | 'onTarget'
  | 'slow'
  | 'farSlow'

/** Warum aus der Zeit nichts über den Mahlgrad folgt. */
export type TimeBlock =
  | 'channeling'
  | 'aborted'
  /** Immersion: Die Kontaktzeit hat der Mensch gewählt. */
  | 'chosenTime'
  /** Filtermaschine: Die Zeit gehört der Pumpe, nicht dem Mahlgrad. */
  | 'deviceTime'
  | 'tooFresh'
  | 'noTarget'

export interface RunNote {
  text: string
  tone: 'info' | 'warn' | 'good'
}

export interface RunCheck {
  band: TimeBand
  /** Darf aus der Zeit auf den Mahlgrad geschlossen werden? */
  timeUsable: boolean
  blockedBy?: TimeBlock
  headline: string
  summary: string
  /** Ist minus Zielmitte in Sekunden. Negativ = zu schnell. */
  deltaS: number | null
  targetS: [number, number] | null
  /** Nur Espresso: g pro Sekunde, die aussagekräftigere Größe. */
  flowRateGs: number | null
  targetFlowGs: number | null
  suggestion?: Suggestion
  /**
   * Ein Vorbehalt hat die Konfidenz der Empfehlung schon gedrückt.
   *
   * Nötig, damit `diagnose()` sie nicht wieder hochzieht: Streut die
   * eigene Vorbereitung stärker als die Abweichung, dann schlagen auch
   * zwei gleichgerichtete Signale das Rauschen nicht (D-9A/D-08).
   */
  confidenceHeldBack?: boolean
  techniqueSteps?: string[]
  /** Zusatzbefunde aus dem übrigen Kaffeewissen — Frische, Streuung, Bloom. */
  notes: RunNote[]
  /** Lohnt die Verkostung, oder ist der Durchgang schon disqualifiziert? */
  tastingWorthwhile: boolean
}

export interface RunCheckInput {
  ctx: EngineContext
  actual: BrewActual
  observations?: Observation
  targetTimeS?: [number, number]
}

const CONF_MAP: Record<string, Confidence> = {
  high: 'sicher',
  medium: 'wahrscheinlich',
  low: 'Versuch',
}

const CONF_ORDER: Confidence[] = ['Versuch', 'wahrscheinlich', 'sicher']

/** Eine Stufe rauf oder runter, ohne über die Enden hinauszulaufen. */
function shiftConf(c: Confidence, by: number): Confidence {
  const i = CONF_ORDER.indexOf(c)
  return CONF_ORDER[Math.max(0, Math.min(CONF_ORDER.length - 1, i + by))]!
}

function runConf(id: string): Confidence {
  return CONF_MAP[getRunRule(id)?.confidence ?? 'medium'] ?? 'wahrscheinlich'
}

function runText(id: string, fallback = ''): string {
  return getRunRule(id)?.explanation ?? fallback
}

// ── Schleifenerkennung (Briefing D, kb/14 §7) ─────────────────────────
//
// Liegt hier, weil beide Stufen sie brauchen: Die Laufkontrolle halbiert
// bei Oszillation die Schrittweite, die Diagnose bricht bei Feststecken
// in die Eskalationsleiter aus.

export interface LoopInfo {
  stuck: boolean
  oscillating: boolean
  direction?: 'finer' | 'coarser'
  lastTwoSettings?: [number, number]
}

export function detectLoop(history: Brew[]): LoopInfo {
  const withGrind = history
    .filter((b) => b.actual.grindSetting?.value !== undefined)
    .slice(0, 4)
  if (withGrind.length < 3) return { stuck: false, oscillating: false }

  const settings = withGrind.map((b) => b.actual.grindSetting!.value)
  const ratings = withGrind.map((b) => b.tasting?.rating ?? 0)
  const deltas: number[] = []
  for (let i = 0; i < settings.length - 1; i++) deltas.push(settings[i]! - settings[i + 1]!)

  const last3 = deltas.slice(0, 3).filter((d) => d !== 0)
  if (last3.length < 2) return { stuck: false, oscillating: false }

  const allFiner = last3.every((d) => d < 0)
  const allCoarser = last3.every((d) => d > 0)
  const improved = ratings[0]! > Math.max(...ratings.slice(1))

  if (last3.length >= 2 && !last3.every((d) => Math.sign(d) === Math.sign(last3[0]!))) {
    return {
      stuck: false,
      oscillating: true,
      lastTwoSettings: [settings[0]!, settings[1]!],
    }
  }
  if ((allFiner || allCoarser) && last3.length >= 3 && !improved) {
    return { stuck: true, oscillating: false, direction: allFiner ? 'finer' : 'coarser' }
  }
  return { stuck: false, oscillating: false }
}

// ── Zeitband ──────────────────────────────────────────────────────────

export function timeBand(timeS: number, targetMid: number | null, tolS: number): TimeBand {
  if (targetMid === null || timeS <= 0) return 'unknown'
  if (timeS < targetMid * RUN_BANDS.abortedBelowFactor) return 'aborted'
  const d = timeS - targetMid
  if (Math.abs(d) <= tolS) return 'onTarget'
  // „Deutlich daneben" ist relativ zur Zielzeit definiert, nicht absolut:
  // 6 s auf 28 s sind ein anderer Befund als 6 s auf 3:30 min.
  const far = Math.abs(d) > targetMid * RUN_BANDS.farOffRelative
  if (d < 0) return far ? 'farFast' : 'fast'
  return far ? 'farSlow' : 'slow'
}

const ZU_SCHNELL: TimeBand[] = ['fast', 'farFast']
const ZU_LANGSAM: TimeBand[] = ['slow', 'farSlow']

/** Was das Band über den Fluss sagt, in der Sprache der Chips. */
function feelOfBand(band: TimeBand): SpeedFeel | null {
  if (ZU_SCHNELL.includes(band)) return 'tooFast'
  if (ZU_LANGSAM.includes(band)) return 'tooSlow'
  if (band === 'onTarget') return 'onPoint'
  return null
}

// ── Streuung (D-9A, verweist auf D-08) ────────────────────────────────

/**
 * Standardabweichung der letzten Durchgänge mit vergleichbarer Dosis.
 *
 * Streut die eigene Vorbereitung stärker als die Abweichung, die korrigiert
 * werden soll, dann korrigiert man Rauschen. Das darf die Empfehlung nicht
 * unterdrücken — aber es muss ihre Konfidenz kosten.
 */
export function timeSpreadS(history: Brew[], doseG: number, tolDoseG: number): number | null {
  const zeiten = history
    .filter((b) => b.actual.timeS > 0 && Math.abs(b.actual.doseG - doseG) <= tolDoseG)
    .slice(0, 5)
    .map((b) => b.actual.timeS)
  if (zeiten.length < 3) return null
  const mittel = zeiten.reduce((a, b) => a + b, 0) / zeiten.length
  const varianz = zeiten.reduce((a, t) => a + (t - mittel) ** 2, 0) / zeiten.length
  return Math.sqrt(varianz)
}

// ── Hauptfunktion ─────────────────────────────────────────────────────

export function checkRun(input: RunCheckInput): RunCheck {
  const { ctx, actual, observations: obs } = input
  const method = ctx.method
  const isEspresso = method === 'espresso'
  const immersion = isImmersion(method)
  /**
   * Darf aus der Zeit auf den Mahlgrad geschlossen werden?
   *
   * Kommt aus dem `scope` von D-90/D-91 und nicht mehr aus der Physik:
   * Die Filterkaffeemaschine ist Perkolation wie der V60, aber ihre Zeit
   * gehört der Pumpe (kb/10c §4). Physik und Zeitdeutung sind also zwei
   * verschiedene Fragen, auch wenn sie bei vier Methoden dieselbe Antwort
   * hatten.
   */
  const zeitSagtMahlgrad = timeSignalsGrind(method)
  const lauf = isEspresso ? 'Der Shot lief' : 'Der Brew lief'

  const tol = tolerances(method)
  const target =
    input.targetTimeS ??
    targetTimeRange(method, actual.doseG, ctx.bean.roastLevel, actual.yieldG) ??
    null
  const mid = target ? (target[0] + target[1]) / 2 : null
  const band = timeBand(actual.timeS, mid, tol.timeS)
  const delta = mid !== null && actual.timeS > 0 ? Math.round(actual.timeS - mid) : null

  const flowRateGs =
    isEspresso && actual.yieldG && actual.timeS > 0
      ? Math.round(flowRate(actual.yieldG, actual.timeS) * 100) / 100
      : null
  const targetFlowGs = isEspresso
    ? Math.round(targetFlowRate(ctx.bean.roastLevel, (actual.yieldG ?? actual.doseG * 2) / actual.doseG) * 100) / 100
    : null

  const notes: RunNote[] = []
  const feel = obs?.perceivedSpeed
  const gemessen = feelOfBand(band)

  const basis = {
    band,
    deltaS: delta,
    targetS: target,
    flowRateGs,
    targetFlowGs,
  }

  // ── Frische zuerst: sie erklärt Widerstand, den kein Mahlgrad erklärt ──
  const days = daysOffRoast(ctx.bag, ctx.today)
  const win = restWindow(method, ctx.bean.roastLevel, !!ctx.bean.isDecaf, ctx.bean.process)
  const zuFrisch = days !== null && days < win.min
  const alt = days !== null && days > win.max

  // ── Immersion: Zeit ist gewählt, nicht Ergebnis ──
  //
  // kb/10b §6 sperrt jede Mahlgradkorrektur aus der Durchlaufzeit. Was
  // bleibt, ist der Widerstand am Kolben — das einzige mechanische
  // Mahlgradsignal, das die Immersion überhaupt hergibt.
  //
  // Dieser Block steht vor allen Zeitprüfungen, weil er keine Zeit
  // braucht: Sonst hätte eine fehlende oder unplausible Zeit den
  // Presswiderstand mitverschluckt, obwohl er von ihr unabhängig ist.
  if (!zeitSagtMahlgrad) {
    const press = immersion ? obs?.pressResistance : undefined
    // Ohne eingetragene Zeit gibt es keine Abweichung — aber der
    // Presswiderstand bleibt trotzdem auswertbar. Genau deshalb steht
    // dieser Block VOR den Zeitprüfungen.
    const abweichung = delta !== null && actual.timeS > 0 && Math.abs(delta) > tol.timeS

    /**
     * Das mechanische Ersatzsignal — nur wo es eines gibt.
     *
     * Bei Immersion ist es der Widerstand am Kolben. An der Maschine gibt
     * es keines: Man greift nichts an, was Auskunft gäbe. Dann bleibt der
     * Geschmack, und das ist die ehrliche Auskunft — nicht der Eindruck
     * „lief schnell", denn wie schnell die Maschine läuft, entscheidet
     * die Maschine.
     */
    let sug: Suggestion | undefined
    if (immersion) {
      if (press && press !== 'normal') {
        const zuGrob = press === 'none' || press === 'light'
        sug = pressSuggestion(zuGrob, method, actual, ctx.grinder)
      } else if (feel && feel !== 'onPoint') {
        sug = pressSuggestion(feel === 'tooFast', method, actual, ctx.grinder)
      }
    }

    // Der Zeitbefund gehört genau einmal in die Ausgabe: als Nebenbefund,
    // wenn eine Presswiderstands-Empfehlung die Karte belegt, sonst als
    // deren Zusammenfassung.
    const zeitSatz = abweichung
      ? `Geplant waren ${fmtDauer(mid!)}, gelaufen ${fmtDauer(actual.timeS)}. ${runText('D-96')}`
      : null
    if (zeitSatz && sug) notes.push({ tone: 'info', text: zeitSatz })
    pushKnowledgeNotes(notes, { ctx, actual, obs, band, days, win, alt, isEspresso })

    /**
     * Warum die Zeit hier nichts sagt — und was stattdessen zu prüfen ist.
     *
     * Der Satz ist bei der Maschine kein Achselzucken, sondern ein
     * Hinweis: Eine Kanne außerhalb ihres Bandes hat eine Ursache, nur
     * eben nicht im Mahlwerk (kb/10c §4).
     */
    const ohneBefund = immersion
      ? 'Bei Immersion ist die Kontaktzeit gewählt, nicht Ergebnis — aus ihr folgt kein Mahlgradbefund. Der Geschmack entscheidet.'
      : 'Die Durchlaufzeit bestimmt hier die Maschine, nicht das Mahlgut — aus ihr folgt kein Mahlgradbefund. Der Geschmack entscheidet.'
    const geraetHinweis =
      !immersion && abweichung
        ? `Auffällig ist die Zeit trotzdem: ${
            (delta ?? 0) > 0
              ? 'Eine Kanne, die deutlich länger braucht, deutet auf Kalk im Gerät oder einen überfüllten Korb'
              : 'Eine Kanne, die deutlich schneller durchläuft, deutet auf zu wenig Mehl im Korb oder ein undichtes Bett'
          } — beides ist am Gerät zu prüfen, nicht am Mahlwerk.`
        : null
    if (geraetHinweis) notes.push({ tone: 'warn', text: geraetHinweis })

    return {
      ...basis,
      timeUsable: false,
      blockedBy: immersion ? 'chosenTime' : 'deviceTime',
      headline: sug
        ? headlineForPress(press, feel)
        : abweichung
          ? 'Andere Zeit als geplant'
          : 'Zeit ist hier kein Befund',
      summary: sug ? sug.why : (zeitSatz ?? ohneBefund),
      suggestion: sug,
      notes,
      tastingWorthwhile: true,
    }
  }

  // ── Sperren: Fälle, in denen die Zeit nichts über den Mahlgrad sagt ──

  if (band === 'unknown') {
    // Zwei verschiedene Lücken, zwei verschiedene Ansagen: Fehlt die Zeit,
    // ist der Nutzer am Zug. Fehlt das Zielband, ist es die App.
    const ohneZeit = actual.timeS <= 0
    return {
      ...basis,
      timeUsable: false,
      blockedBy: 'noTarget',
      headline: ohneZeit ? 'Keine Zeit eingetragen' : 'Keine Zielzeit ableitbar',
      summary: ohneZeit
        ? 'Ohne die gelaufene Zeit gibt es nichts zu vergleichen. Trag sie im Schritt davor ein — dann rechne ich mit.'
        : 'Für diese Kombination aus Methode und Menge liegt kein Zielband vor. Die Zeit lässt sich damit nicht einordnen; es bleibt beim Geschmack.',
      notes,
      tastingWorthwhile: true,
    }
  }

  if (band === 'aborted') {
    return {
      ...basis,
      timeUsable: false,
      blockedBy: 'aborted',
      headline: 'Das war kein vollständiger Durchgang',
      summary:
        `Aufgezeichnet sind ${fmtDauer(actual.timeS)} bei einem Ziel von ${fmtDauer(mid!)}. ` +
        `Aus einem abgebrochenen Durchgang lässt sich nichts ableiten — ` +
        `${isEspresso ? 'zieh den Shot noch einmal' : 'brüh noch einmal'} und trag die volle Zeit ein.`,
      notes,
      tastingWorthwhile: false,
    }
  }

  // Channeling: Ein Teil des Wassers ist am Kaffee vorbeigelaufen. Die Zeit
  // ist dann physikalisch bedeutungslos (kb/14 D-01) — und ein Mahlgrad­
  // vorschlag wäre geraten.
  if (isEspresso && !timeIsTrustworthy(obs?.flowState)) {
    return {
      ...basis,
      timeUsable: false,
      blockedBy: 'channeling',
      headline: 'Channeling — die Zeit sagt hier nichts',
      summary:
        `${lauf} ${fmtDauer(actual.timeS)}, aber ein Teil des Wassers hat den Kaffee umgangen. ` +
        'Die Zeit ist damit kein Maß für den Mahlgrad. Zuerst die Verteilung, dann wieder die Zahlen.',
      techniqueSteps: ['WDT — das Mehl im Korb auflockern', 'Eben tampen, danach nicht mehr klopfen', 'Dosis prüfen (Headspace)', 'Korb auf Verformung prüfen'],
      notes,
      tastingWorthwhile: false,
    }
  }
  if (isEspresso && (obs?.puckState === 'crater' || obs?.puckState === 'sideChannel')) {
    return {
      ...basis,
      timeUsable: false,
      blockedBy: 'channeling',
      headline: 'Der Puck zeigt einen Kanal',
      summary:
        `${lauf} ${fmtDauer(actual.timeS)}, aber ${obs.puckState === 'crater' ? 'der Krater' : 'der seitliche Kanal'} ` +
        'im Puck belegt eine ungleichmäßige Durchströmung. Solange das so ist, ist die Zeit kein Mahlgradsignal.',
      techniqueSteps: ['WDT', 'Eben tampen', 'Nach dem Tampen nicht klopfen'],
      notes,
      tastingWorthwhile: false,
    }
  }

  if (zuFrisch && ZU_LANGSAM.includes(band)) {
    return {
      ...basis,
      timeUsable: false,
      blockedBy: 'tooFresh',
      headline: 'Das bremst das CO₂, nicht der Mahlgrad',
      summary:
        `${lauf} ${fmtDauer(actual.timeS)} statt ${fmtDauer(mid!)} — bei erst ${tagen(days!)} nach Röstung ` +
        `ist das erwartbar. ${runText('D-98')} Ab Tag ${win.min} wird die Zeit stabil.`,
      notes,
      tastingWorthwhile: true,
    }
  }

  // ── Perkolation: hier trägt die Zeit ──

  pushKnowledgeNotes(notes, { ctx, actual, obs, band, days, win, alt, isEspresso })

  // Streuung senkt die Konfidenz, unterdrückt die Empfehlung aber nicht:
  // „mach es erst wiederholbar" ist richtig, hilft aber niemandem, dessen
  // Shot 45 s braucht.
  const spread = isEspresso ? timeSpreadS(ctx.methodHistory, actual.doseG, tol.doseG) : null
  const streut = spread !== null && spread > RUN_BANDS.spreadWarnS
  if (streut) {
    notes.push({
      tone: 'warn',
      // Zwei Fälle, zwei Aussagen: Wird korrigiert, jagt die Korrektur
      // womöglich Rauschen. Sitzt die Zeit, war es vielleicht Zufall —
      // „die Empfehlung bleibt stehen" wäre dort sinnlos, es gibt keine.
      // Der Regeltext setzt hinter der Zahl an, sonst stünde die Streuung
      // zweimal im selben Satz.
      text:
        band === 'onTarget'
          ? `Deine letzten Zeiten streuen um ±${de(spread!, 0)} s. Diesmal hat es gepasst — ` +
            'verlässlich ist es damit noch nicht. Auf 0,1 g wiegen, RDT und ein gleichmäßiger ' +
            'Tamp machen aus einem Treffer eine Einstellung.'
          : `Deine letzten Zeiten streuen um ±${de(spread!, 0)} s — stärker als die Abweichung, ` +
            `die hier korrigiert werden soll. ${runText('D-9A')}`,
    })
  }

  const loop = detectLoop(ctx.beanHistory)

  // Extremfälle zuerst — sie haben eigene Regeln und eigene Zusatzmaßnahme.
  const choked = isEspresso && actual.timeS > RUN_BANDS.espressoChokedAboveS
  const gusher = isEspresso && actual.timeS < RUN_BANDS.espressoGusherBelowS

  let sug: Suggestion | undefined
  let headline: string
  let summary: string
  let zurueckgehalten = false

  if (band === 'onTarget') {
    if (feel && feel !== 'onPoint') {
      // Genau der Fall, den der Nutzer meldet: Die Zahl liegt im Ziel, der
      // Eindruck nicht. Zu wenig für eine berechnete Korrektur, genug für
      // einen einzelnen Schritt.
      const finer = feel === 'tooFast'
      sug = singleStep(
        'D-95',
        finer,
        `${lauf} ${fmtDauer(actual.timeS)} und damit im Zielband ${fmtSpanne(target!)} — ` +
          `du hast ihn trotzdem als ${finer ? 'zu schnell' : 'zu langsam'} empfunden.`,
        actual,
        ctx.grinder,
        method,
      )
      headline = finer ? 'Fühlte sich zu schnell an' : 'Fühlte sich zu langsam an'
      summary = sug.why
      if (finer) {
        notes.push({
          tone: 'info',
          text: 'Ein Durchlauf, der sich schneller anfühlt als die Uhr sagt, hat oft einen kleinen Kanal. Prüf beim nächsten Mal den Puck, bevor du am Mahlgrad drehst.',
        })
      }
    } else {
      headline = 'Die Zeit sitzt'
      summary =
        `${lauf} ${fmtDauer(actual.timeS)} im Zielband ${fmtSpanne(target!)}. ` +
        runText('D-92')
      if (feel === 'onPoint') notes.push({ tone: 'good', text: 'Dein Eindruck deckt sich mit der Uhr.' })
    }
  } else {
    const finer = ZU_SCHNELL.includes(band)
    const ruleId = choked ? 'D-50' : gusher ? 'D-51' : finer ? 'D-90' : 'D-91'

    const corr = correctionFromTime(actual.timeS, mid!, method, ctx.grinder, actual.grindSetting?.value)

    // Bei Oszillation nicht die volle Rechnung gehen: Das Optimum ist
    // eingegrenzt, gebraucht wird eine kleinere Schrittweite (kb/14 §7).
    const halbiere = loop.oscillating && !!corr && Math.abs(corr.steps) > 1

    const steps = corr
      ? halbiere
        ? roundToStep(corr.steps / 2, ctx.grinder)
        : corr.steps
      : (choked || gusher ? 4 : 2) * (finer ? -1 : 1)

    const was = corr
      ? halbiere
        ? `${de(Math.abs(steps), Math.abs(steps) % 1 ? 1 : 0)} ${finer ? 'feiner' : 'gröber'} — halber Schritt`
        : describeCorrection(corr, ctx.grinder)
      : `${Math.abs(steps)} Schritt${Math.abs(steps) === 1 ? '' : 'e'} ${finer ? 'feiner' : 'gröber'}`

    const warum = choked
      ? `${lauf} ${fmtDauer(actual.timeS)} — das Bett ist so dicht, dass kaum noch etwas durchkommt.`
      : gusher
        ? `${lauf} nur ${fmtDauer(actual.timeS)} — viel zu wenig Widerstand für die Menge.`
        : `${lauf} ${fmtDauer(actual.timeS)} statt ${fmtSpanne(target!)}. ` +
          `Das sind ${vorz(delta!)} s auf die Zielmitte.`

    // Konfidenz: die Schwere der Abweichung setzt die Basis, Eindruck und
    // Streuung verschieben sie. Nicht die Regel selbst — F-22 ist immer
    // dieselbe Physik, aber vier Sekunden auf fünfundzwanzig sind ein
    // schwächeres Signal als zehn.
    //
    // Ausnahme Gusher: Ein Shot ohne Widerstand kann genauso gut ein
    // großer Kanal sein (kb/14 D-51, Vorbedingung D-01). Deshalb dort die
    // Konfidenz der Regel und nicht die des Bandes.
    let conf: Confidence = gusher
      ? runConf('D-51')
      : choked || ['farFast', 'farSlow'].includes(band)
        ? 'sicher'
        : 'wahrscheinlich'
    if (feel && gemessen && feel === gemessen) conf = shiftConf(conf, +1)
    if (feel && gemessen && feel !== gemessen && feel !== 'onPoint') conf = shiftConf(conf, -1)
    if (streut) {
      conf = shiftConf(conf, -1)
      zurueckgehalten = true
    }

    sug = {
      ruleId,
      what: was,
      why: warum,
      expectation: [
        corr?.capped
          ? `${isEspresso ? 'Der Shot' : 'Der Brew'} wird deutlich ${finer ? 'langsamer' : 'schneller'}, aber noch nicht am Ziel.`
          : corr?.expectedTimeS
            ? `Erwartete Zeit danach: ${fmtDauer(halbiere ? (actual.timeS + corr.expectedTimeS) / 2 : corr.expectedTimeS)}.`
            : `Die Zeit sollte sich Richtung ${fmtDauer(mid!)} bewegen.`,
        corr ? cappedNote(corr, ctx.grinder) : undefined,
        choked ? 'Zusätzlich hilft eine halbe Gramm weniger Dosis — mehr Headspace, weniger Kompression.' : undefined,
        gusher ? 'Prüf vorher die Verteilung: Ein großer Kanal sieht genauso aus wie zu grobes Mahlgut.' : undefined,
      ]
        .filter(Boolean)
        .join(' '),
      confidence: conf,
      variable: 'grindSetting',
      direction: finer ? 'decrease' : 'increase',
      delta: steps,
      newValue:
        actual.grindSetting?.value !== undefined
          ? roundToStep(actual.grindSetting.value + steps, ctx.grinder)
          : undefined,
      /**
       * Die Erwartung als Zahl — Grundlage der Einlösung.
       *
       * Drei Fälle, drei Antworten: Bei gedeckelter Korrektur gehen wir
       * bewusst nicht den ganzen Weg, da wäre eine Prognose unehrlich.
       * Bei halbierter Korrektur ist der erwartete Wert die Mitte
       * zwischen jetzt und Ziel — genau der Wert, der auch im Text
       * steht. Sonst die Zielmitte.
       */
      ...(corr?.capped
        ? {}
        : corr?.expectedTimeS
          ? {
              erwartung: {
                groesse: 'zeit' as const,
                wert: Math.round(
                  halbiere ? (actual.timeS + corr.expectedTimeS) / 2 : corr.expectedTimeS,
                ),
              },
            }
          : mid !== undefined && mid !== null
            ? { erwartung: { groesse: 'zeit' as const, wert: Math.round(mid) } }
            : {}),
      alternative: grindAlternative(finer, actual, method),
    }

    headline = choked
      ? 'Choked — deutlich zu fein'
      : gusher
        ? 'Gusher — deutlich zu grob'
        : finer
          ? 'Zu schnell durchgelaufen'
          : 'Zu langsam durchgelaufen'
    summary = warum

    if (feel && gemessen && feel !== gemessen && feel !== 'onPoint') {
      notes.push({ tone: 'warn', text: runText('D-94') })
    } else if (feel && feel === gemessen) {
      notes.push({ tone: 'good', text: runText('D-93') })
    }
    if (halbiere) {
      notes.push({
        tone: 'info',
        text: 'Du bist zuletzt hin- und hergegangen. Deshalb nur der halbe Weg — das Optimum liegt dazwischen.',
      })
    }
    if (alt && finer) {
      notes.push({ tone: 'info', text: runText('D-99') })
    }
  }

  // V60: Der Drawdown schlägt die Gesamtzeit (kb/14 D-60). Ein Bett, das
  // sich zusetzt, ist ein Befund, auch wenn die Gesamtzeit passt.
  if (method === 'v60' && obs?.drawdownS && actual.timeS > 0) {
    const pct = (obs.drawdownS / actual.timeS) * 100
    if (pct > 45) {
      const anteil = `Der Drawdown dauerte ${fmtDauer(obs.drawdownS)} — ${de(pct, 0)} % der Gesamtzeit. Das Bett setzt sich zu.`
      if (!sug || sug.direction === 'decrease') {
        // Zusetzendes Bett und „feiner mahlen" widersprechen sich. Der
        // Drawdown ist das nähere Signal.
        sug = singleStep('D-60', false, anteil, actual, ctx.grinder, method, 2)
        headline = 'Das Bett setzt sich zu'
        summary = anteil
      } else {
        notes.push({ tone: 'warn', text: anteil })
      }
    }
  }

  return {
    ...basis,
    timeUsable: true,
    headline,
    summary,
    suggestion: sug,
    confidenceHeldBack: zurueckgehalten,
    notes,
    tastingWorthwhile: true,
  }
}

// ── Bausteine ─────────────────────────────────────────────────────────

/** Ein einzelner Schritt in eine Richtung — wenn für mehr die Grundlage fehlt. */
function singleStep(
  ruleId: string,
  finer: boolean,
  why: string,
  actual: BrewActual,
  grinder: Grinder | undefined,
  method: BrewMethod,
  betrag = 1,
): Suggestion {
  const st = grinder?.scaleType === 'stepless' ? (grinder.step ?? 0.5) : 1
  const schritte = betrag * st * (finer ? -1 : 1)
  const betragText = de(Math.abs(schritte), Math.abs(schritte) % 1 ? 1 : 0)
  const richtung = finer ? 'feiner' : 'gröber'
  // Eine stufenlose Skala kennt keine Klicks — dort wird eine Zahl am
  // Regler abgelesen, keine Rastung gezählt.
  const was =
    grinder?.scaleType === 'stepless'
      ? `${betragText} ${richtung} auf der Skala`
      : `${betragText} Klick${Math.abs(schritte) === 1 ? '' : 's'} ${richtung}`
  return {
    ruleId,
    what: was,
    why,
    expectation: `${finer ? 'Etwas mehr Widerstand und Kontakt' : 'Etwas weniger Widerstand'} — die Zeit sollte sich um wenige Sekunden ${finer ? 'verlängern' : 'verkürzen'}.`,
    confidence: runConf(ruleId),
    variable: 'grindSetting',
    direction: finer ? 'decrease' : 'increase',
    delta: schritte,
    newValue:
      actual.grindSetting?.value !== undefined
        ? roundToStep(actual.grindSetting.value + schritte, grinder)
        : undefined,
    alternative: grindAlternative(finer, actual, method),
  }
}

/** Immersion: aus dem Presswiderstand auf die Partikelgröße schließen. */
function pressSuggestion(
  zuGrob: boolean,
  method: BrewMethod,
  actual: BrewActual,
  grinder: Grinder | undefined,
): Suggestion {
  const s = singleStep(
    'D-97',
    zuGrob,
    zuGrob
      ? 'Der Kolben ging fast ohne Gegendruck durch — das Mahlgut ist zu grob für die Menge.'
      : 'Der Kolben war schwer zu drücken. Zu fein: Fines gehen durch das Sieb und extrahieren in der Tasse weiter.',
    actual,
    grinder,
    method,
  )
  s.expectation = zuGrob
    ? 'Mehr Oberfläche, mehr Körper und Süße bei gleicher Ziehzeit.'
    : 'Weniger Trübung und weniger Bitterkeit im Abgang, ohne dass du an der Zeit drehen musst.'
  if (method === 'frenchpress') {
    s.alternative =
      'Der Mahlgrad ist hier der schwächste Hebel. Falls das nicht reicht: Ratio ' +
      `${zuGrob ? 'enger' : 'weiter'} — das wirkt deutlicher als der Grind.`
  }
  return s
}

function headlineForPress(press: Observation['pressResistance'], feel: SpeedFeel | undefined): string {
  const leicht = press === 'none' || press === 'light' || feel === 'tooFast'
  return leicht ? 'Zu wenig Widerstand beim Pressen' : 'Zu viel Widerstand beim Pressen'
}

/**
 * Jede Empfehlung braucht einen nächsten Schritt, falls sie nicht wirkt.
 * Reihenfolge nach Wirkstärke (kb/03 §1): Mahlgrad → Ratio → Temperatur.
 */
function grindAlternative(finer: boolean, actual: BrewActual, method: BrewMethod): string {
  const tr = tempRange(method)
  const temp = actual.waterTempC ?? 93
  const ziel = Math.round(Math.min(tr.max, Math.max(tr.min, temp + (finer ? 2 : -2))))
  if (ziel === Math.round(temp)) {
    const ratio = actual.yieldG
      ? actual.yieldG / actual.doseG
      : actual.waterG
        ? actual.waterG / actual.doseG
        : 2
    return `Falls das nicht reicht: Ratio auf 1:${de(ratio + (finer ? 0.2 : -0.2), 1)}.`
  }
  return `Falls das nicht reicht: Temperatur auf ${ziel} °C.`
}

/**
 * Befunde, die neben der Zeit stehen und aus dem übrigen Wissen kommen.
 * Sie ändern die Empfehlung nicht, sie erklären sie — oder warnen davor,
 * eine Ursache am falschen Ort zu suchen.
 */
function pushKnowledgeNotes(
  notes: RunNote[],
  a: {
    ctx: EngineContext
    actual: BrewActual
    obs?: Observation
    band: TimeBand
    days: number | null
    win: { min: number; max: number }
    alt: boolean
    isEspresso: boolean
  },
): void {
  const { ctx, actual, obs, band, days, win, alt } = a

  // „Zu frisch" steht seit dem 24.09.2026 als Vorbehalt über dem ganzen
  // Ergebnis (siehe `diagnose`). Ihn hier zu wiederholen hieße, dieselbe
  // Einschränkung zweimal in zwei Formulierungen zu lesen — und die
  // zweite stünde tiefer und klänge dringender als die erste.
  if (alt && days !== null && !ZU_SCHNELL.includes(band)) {
    notes.push({
      tone: 'info',
      text: `${tage(days)} nach Röstung, das Fenster endet bei Tag ${win.max}. Ein Teil der Abweichung kann Entgasung sein (F-32).`,
    })
  }

  // Bloom liest die Frische von der anderen Seite — er zeigt sie am Kaffee
  // statt am Kalender (kb/14 D-62/D-63).
  if (obs?.bloomBehavior === 'vigorous') {
    notes.push({
      tone: 'info',
      text: 'Der kräftige Bloom bestätigt eine sehr frische Bohne. Bloom auf 45 s verlängern lässt mehr CO₂ entweichen.',
    })
  } else if (obs?.bloomBehavior === 'flat') {
    notes.push({
      tone: 'warn',
      text: 'Kaum Bloom-Reaktion: entweder ist die Bohne alt, oder das Wasser war zu kalt.',
    })
  } else if (obs?.bloomBehavior === 'uneven') {
    notes.push({
      tone: 'warn',
      text: 'Trockene Stellen im Bloom heißen ungleichmäßige Benetzung. Nach dem Bloom swirlen, bevor du am Mahlgrad drehst.',
    })
  }

  if (obs?.puckState === 'wet-soupy') {
    notes.push({
      tone: 'info',
      text: 'Suppiger Puck: zu viel Headspace. Eine halbe Gramm mehr Dosis oder eine engere Ratio.',
    })
  }

  // Temperatur am Anschlag der Methode zu melden ist ehrlicher, als sie
  // später als Alternative anzubieten, die die Maschine nicht kann.
  const tr = tempRange(ctx.method)
  if (actual.waterTempC !== undefined) {
    if (actual.waterTempC >= tr.max) {
      notes.push({ tone: 'info', text: `${actual.waterTempC} °C ist das Maximum dieser Methode — als Hebel steht die Temperatur nicht mehr zur Verfügung.` })
    } else if (actual.waterTempC <= tr.min) {
      notes.push({ tone: 'info', text: `${actual.waterTempC} °C ist das Minimum dieser Methode — nach unten geht nichts mehr.` })
    }
  }
}
