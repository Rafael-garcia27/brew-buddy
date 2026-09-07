/**
 * Laufkontrolle: die Stufe, die vor der Verkostung urteilt.
 *
 * Der Anlass für diese Tests ist ein konkreter Ausfall: Ein Espresso mit
 * 19 s bei 25 s Zielmitte und leerem Tasting bekam „keine klare Korrektur".
 * Die Zeit allein enthielt die Antwort — die Engine hat sie nur nicht
 * gelesen, weil sie auf einen Fehlertag gewartet hat.
 */
import { describe, it, expect } from 'vitest'
import type { Bean, Bag, Brew, Grinder, Defect, SpeedFeel, Observation } from '@domain'
import type { EngineContext } from '@/domain'
import { DEFAULT_SETTINGS, EMPTY_LEARNED } from '@/domain'
import { checkRun, timeBand } from './runcheck'
import { diagnose } from './diagnose'
import { targetTimeRange } from '@/kb'

const TODAY = new Date('2026-08-18T08:00:00Z')
const daysAgo = (n: number) => new Date(TODAY.getTime() - n * 86_400_000).toISOString()

const bean = (over: Partial<Bean> = {}): Bean => ({
  id: 'b1',
  name: 'Testbohne',
  origins: [{ country: 'Kolumbien' }],
  process: 'washed',
  roastLevel: 'medium',
  createdAt: daysAgo(30),
  ...over,
})

const bag = (over: Partial<Bag> = {}): Bag => ({
  id: 'g1',
  beanId: 'b1',
  roastDate: daysAgo(14),
  depleted: false,
  createdAt: daysAgo(14),
  ...over,
})

const grinder: Grinder = {
  id: 'gr1',
  name: 'Test JX-Pro',
  burrType: 'conical',
  scaleType: 'stepped',
  micronPerStep: 12.5,
  zeroPointOffsetMicron: 0,
  usableRange: [0, 100],
  confidence: 'vendor',
}

const ctx = (over: Partial<EngineContext> = {}): EngineContext => ({
  bean: bean(),
  bag: bag(),
  method: 'espresso',
  grinder,
  settings: { ...DEFAULT_SETTINGS },
  learned: { ...EMPTY_LEARNED },
  beanHistory: [],
  methodHistory: [],
  allBeans: [bean()],
  today: TODAY,
  ...over,
})

/** Espresso 18 g → 36 g, medium: Zielband [22, 28], Mitte 25, Toleranz 3 s. */
const ESPRESSO_ZIEL = targetTimeRange('espresso', 18, 'medium', 36)!

function espresso(timeS: number, obs: Observation = {}, over: Partial<EngineContext> = {}) {
  return checkRun({
    ctx: ctx(over),
    actual: {
      doseG: 18,
      yieldG: 36,
      timeS,
      waterTempC: 93,
      grindSetting: { equipmentId: 'gr1', value: 40, unit: 'clicks' },
    },
    observations: obs,
    targetTimeS: ESPRESSO_ZIEL,
  })
}

describe('Zeitband', () => {
  it('behandelt die Kurstoleranz nicht als Fehler', () => {
    expect(timeBand(25, 25, 3)).toBe('onTarget')
    expect(timeBand(28, 25, 3)).toBe('onTarget')
    expect(timeBand(22, 25, 3)).toBe('onTarget')
  })

  it('trennt leicht daneben von deutlich daneben', () => {
    expect(timeBand(21, 25, 3)).toBe('fast')
    expect(timeBand(19, 25, 3)).toBe('farFast')
    expect(timeBand(29, 25, 3)).toBe('slow')
    expect(timeBand(31, 25, 3)).toBe('farSlow')
  })

  it('erkennt einen Abbruch als Abbruch, nicht als Extraktionsfehler', () => {
    expect(timeBand(8, 25, 3)).toBe('aborted')
  })
})

describe('Espresso ohne jede Geschmacksangabe', () => {
  it('empfiehlt bei 19 s feiner — das ist der gemeldete Ausfall', () => {
    const r = espresso(19)
    expect(r.band).toBe('farFast')
    expect(r.timeUsable).toBe(true)
    expect(r.suggestion?.variable).toBe('grindSetting')
    expect(r.suggestion?.direction).toBe('decrease')
    expect(r.suggestion?.what).toMatch(/feiner/)
    // Deutlich daneben heißt: nicht „Versuch".
    expect(r.suggestion?.confidence).toBe('sicher')
  })

  it('empfiehlt bei 40 s gröber und nennt die neue Einstellung', () => {
    const r = espresso(40)
    expect(r.band).toBe('farSlow')
    expect(r.suggestion?.direction).toBe('increase')
    expect(r.suggestion?.what).toMatch(/gröber/)
    expect(r.suggestion?.newValue).toBeGreaterThan(40)
  })

  it('schweigt, wenn die Zeit im Band liegt', () => {
    const r = espresso(25)
    expect(r.band).toBe('onTarget')
    expect(r.suggestion).toBeUndefined()
    expect(r.headline).toBe('Die Zeit sitzt')
  })

  it('nennt Choked und Gusher beim Namen', () => {
    expect(espresso(50).headline).toMatch(/Choked/)
    expect(espresso(13).headline).toMatch(/Gusher/)
    // Beim Gusher gehört die Verteilungsprüfung in die Erwartung, sonst
    // korrigiert der Nutzer einen Kanal mit dem Mahlgrad.
    expect(espresso(13).suggestion?.expectation).toMatch(/Verteilung/)
  })

  it('gibt die Durchflussrate aus, nicht nur die Zeit', () => {
    const r = espresso(20)
    expect(r.flowRateGs).toBeCloseTo(1.8, 1)
    expect(r.targetFlowGs).toBeGreaterThan(0)
  })
})

describe('Der eigene Eindruck als zweites Signal', () => {
  const feel = (t: number, f: SpeedFeel) => espresso(t, { perceivedSpeed: f })

  it('macht aus „zu langsam" bei getroffener Zeit einen einzelnen Schritt', () => {
    const r = feel(25, 'tooSlow')
    expect(r.suggestion?.direction).toBe('increase')
    expect(r.suggestion?.delta).toBe(1)
    expect(r.suggestion?.what).toBe('1 Klick gröber')
    // Ein Eindruck ohne Messabweichung trägt keine hohe Konfidenz.
    expect(r.suggestion?.confidence).toBe('Versuch')
  })

  it('macht aus „zu schnell" bei getroffener Zeit einen Schritt feiner — plus Kanalhinweis', () => {
    const r = feel(25, 'tooFast')
    expect(r.suggestion?.direction).toBe('decrease')
    expect(r.notes.some((n) => /Kanal/.test(n.text))).toBe(true)
  })

  it('hebt die Konfidenz, wenn Eindruck und Uhr sich decken', () => {
    const bestaetigt = feel(21, 'tooFast')
    const stumm = espresso(21)
    expect(stumm.suggestion?.confidence).toBe('wahrscheinlich')
    expect(bestaetigt.suggestion?.confidence).toBe('sicher')
  })

  it('lässt bei Widerspruch die Zahl gewinnen und senkt die Konfidenz', () => {
    const r = feel(19, 'tooSlow')
    // Die Uhr sagt zu schnell — also feiner, entgegen dem Eindruck.
    expect(r.suggestion?.direction).toBe('decrease')
    expect(r.suggestion?.confidence).toBe('wahrscheinlich')
    expect(r.notes.some((n) => n.tone === 'warn')).toBe(true)
  })

  it('bestätigt eine getroffene Zeit ohne etwas zu empfehlen', () => {
    const r = feel(25, 'onPoint')
    expect(r.suggestion).toBeUndefined()
    expect(r.notes.some((n) => n.tone === 'good')).toBe(true)
  })
})

describe('Sperren — Fälle, in denen die Zeit nichts über den Mahlgrad sagt', () => {
  it('bei Channeling gar keine Mahlgradempfehlung', () => {
    const r = espresso(19, { flowState: 'spritzing' })
    expect(r.timeUsable).toBe(false)
    expect(r.blockedBy).toBe('channeling')
    expect(r.suggestion).toBeUndefined()
    expect(r.techniqueSteps?.length).toBeGreaterThan(0)
  })

  it('ein Krater im Puck sperrt genauso', () => {
    const r = espresso(19, { flowState: 'normal', puckState: 'crater' })
    expect(r.blockedBy).toBe('channeling')
    expect(r.suggestion).toBeUndefined()
  })

  it('ein abgebrochener Durchgang liefert keine Korrektur', () => {
    const r = espresso(7)
    expect(r.band).toBe('aborted')
    expect(r.suggestion).toBeUndefined()
    expect(r.tastingWorthwhile).toBe(false)
  })

  it('CO₂ statt Mahlgrad, solange die Bohne im Ruhefenster ist', () => {
    const r = espresso(35, {}, { bag: bag({ roastDate: daysAgo(2) }) })
    expect(r.blockedBy).toBe('tooFresh')
    expect(r.suggestion).toBeUndefined()
    expect(r.headline).toMatch(/CO₂/)
  })

  it('senkt die Konfidenz, wenn die eigenen Zeiten stärker streuen als die Abweichung', () => {
    const brew = (timeS: number, i: number): Brew => ({
      id: `x${i}`,
      bagId: 'g1',
      beanId: 'b1',
      method: 'espresso',
      actual: { doseG: 18, yieldG: 36, timeS },
      isBest: false,
      createdAt: daysAgo(i),
    })
    const streuend = [22, 34, 19, 31, 24].map(brew)
    const r = espresso(21, {}, { methodHistory: streuend })
    expect(r.suggestion?.confidence).toBe('Versuch')
    expect(r.notes.some((n) => /streuen/.test(n.text))).toBe(true)
  })
})

describe('Immersion — die Zeit ist gewählt, nicht Ergebnis', () => {
  const fp = (timeS: number, obs: Observation = {}) =>
    checkRun({
      ctx: ctx({ method: 'frenchpress' }),
      actual: {
        doseG: 18,
        waterG: 288,
        timeS,
        waterTempC: 94,
        grindSetting: { equipmentId: 'gr1', value: 80, unit: 'clicks' },
      },
      observations: obs,
      targetTimeS: targetTimeRange('frenchpress', 18, 'medium')!,
    })

  it('leitet aus einer langen Gesamtzeit KEINE Mahlgradkorrektur ab', () => {
    const r = fp(600)
    expect(r.timeUsable).toBe(false)
    expect(r.blockedBy).toBe('chosenTime')
    expect(r.suggestion).toBeUndefined()
  })

  it('meldet die Abweichung von der geplanten Zeit als Reproduzierbarkeitsthema', () => {
    // Ohne Empfehlung trägt die Zusammenfassung den Befund …
    expect(fp(600).summary).toMatch(/Geplant waren/)
    // … mit Empfehlung rutscht er in die Nebenbefunde, damit er nicht
    // zweimal auf dem Bildschirm steht.
    const mitPressen = fp(600, { pressResistance: 'heavy' })
    expect(mitPressen.summary).not.toMatch(/Geplant waren/)
    expect(mitPressen.notes.some((n) => /Geplant waren/.test(n.text))).toBe(true)
  })

  it('liest den Presswiderstand auch ohne eingetragene Zeit', () => {
    // Der Widerstand am Kolben hängt nicht an der Uhr. Vorher hat die
    // Zeitprüfung ihn verschluckt, weil sie zuerst lief.
    const r = fp(0, { pressResistance: 'heavy' })
    expect(r.suggestion?.direction).toBe('increase')
    expect(r.blockedBy).toBe('chosenTime')
  })

  it('liest den Presswiderstand als Mahlgradsignal', () => {
    const schwer = fp(275, { perceivedSpeed: 'tooSlow' })
    expect(schwer.suggestion?.direction).toBe('increase')
    expect(schwer.suggestion?.why).toMatch(/Sieb/)
    // Bei der French Press ist der Grind der schwächste Hebel — das muss
    // in der Alternative stehen (kb/10b §1).
    expect(schwer.suggestion?.alternative).toMatch(/Ratio/)

    const leicht = fp(275, { pressResistance: 'light' })
    expect(leicht.suggestion?.direction).toBe('decrease')
  })
})

describe('V60 — der Drawdown schlägt die Gesamtzeit', () => {
  const v60 = (timeS: number, drawdownS: number) =>
    checkRun({
      ctx: ctx({ method: 'v60' }),
      actual: {
        doseG: 20,
        waterG: 320,
        timeS,
        waterTempC: 94,
        grindSetting: { equipmentId: 'gr1', value: 60, unit: 'clicks' },
      },
      observations: { drawdownS },
      targetTimeS: targetTimeRange('v60', 20, 'medium')!,
    })

  it('meldet ein zusetzendes Bett auch bei getroffener Gesamtzeit', () => {
    const r = v60(165, 90)
    expect(r.band).toBe('onTarget')
    expect(r.suggestion?.direction).toBe('increase')
    expect(r.headline).toMatch(/zu/)
  })

  it('überstimmt eine Feiner-Empfehlung aus der Gesamtzeit', () => {
    // 120 s ist zu schnell (feiner), der Drawdown sagt zusetzend (gröber).
    // Der Drawdown ist das nähere Signal.
    const r = v60(120, 70)
    expect(r.suggestion?.direction).toBe('increase')
  })
})

// ── Zusammenspiel der beiden Stufen ───────────────────────────────────

describe('diagnose() führt Laufkontrolle und Sensorik zusammen', () => {
  const dia = (timeS: number, defects: Defect[], rating: 1 | 2 | 3 | 4 | 5 = 2) =>
    diagnose({
      ctx: ctx(),
      actual: {
        doseG: 18,
        yieldG: 36,
        timeS,
        waterTempC: 93,
        grindSetting: { equipmentId: 'gr1', value: 40, unit: 'clicks' },
      },
      observations: { flowState: 'normal' },
      tasting: defects.length || rating ? { rating, defects, characters: [], wouldRepeat: false } : undefined,
      targetTimeS: ESPRESSO_ZIEL,
    })

  it('gibt eine Korrektur, auch wenn kein Fehler markiert ist', () => {
    const d = dia(19, [], 3)
    expect(d.suggestions).toHaveLength(1)
    expect(d.suggestions[0]!.variable).toBe('grindSetting')
    expect(d.suggestions[0]!.direction).toBe('decrease')
  })

  it('zieht die Konfidenz nicht hoch, wenn die Streuung sie gedrückt hat', () => {
    // Zwei gleichgerichtete Signale sind viel wert — aber nicht mehr als
    // die eigene Wiederholgenauigkeit hergibt (D-9A/D-08).
    const brew = (timeS: number, i: number): Brew => ({
      id: `y${i}`,
      bagId: 'g1',
      beanId: 'b1',
      method: 'espresso',
      actual: { doseG: 18, yieldG: 36, timeS },
      isBest: false,
      createdAt: daysAgo(i),
    })
    const streuend = [22, 34, 19, 31, 24].map(brew)
    const d = diagnose({
      ctx: ctx({ methodHistory: streuend }),
      actual: {
        doseG: 18,
        yieldG: 36,
        timeS: 31,
        waterTempC: 93,
        grindSetting: { equipmentId: 'gr1', value: 40, unit: 'clicks' },
      },
      observations: { flowState: 'normal' },
      tasting: { rating: 2, defects: ['bitter'], characters: [], wouldRepeat: false },
      targetTimeS: ESPRESSO_ZIEL,
    })
    expect(d.suggestions[0]!.why).toMatch(/Geschmack bestätigt/)
    expect(d.suggestions[0]!.confidence).toBe('wahrscheinlich')
  })

  it('verrechnet gleichgerichtete Signale zu einer sicheren Empfehlung', () => {
    const d = dia(40, ['bitter'])
    const s = d.suggestions[0]!
    expect(s.variable).toBe('grindSetting')
    expect(s.direction).toBe('increase')
    expect(s.confidence).toBe('sicher')
    // Beide Signale, aber die Beobachtung nur einmal.
    expect(s.why).toMatch(/40 s/)
    expect(s.why).toMatch(/Geschmack bestätigt es: zu viel extrahiert/)
    expect(s.why.match(/40 s/g)).toHaveLength(1)
  })

  it('erklärt den Widerspruch „lange gelaufen und trotzdem sauer" statt zu raten', () => {
    const d = dia(40, ['sour'])
    expect(d.suggestions).toHaveLength(0)
    expect(d.blocked).toBe(true)
    expect(d.headline).toMatch(/widersprechen/)
    expect(d.techniqueSteps?.length).toBeGreaterThan(0)
    expect(d.escalation?.length).toBeGreaterThan(0)
  })

  it('greift bei „bitter trotz kurzer Zeit" zur Temperatur, nicht zum Mahlgrad', () => {
    const d = dia(19, ['bitter'])
    expect(d.suggestions[0]?.variable).toBe('waterTempC')
    expect(d.suggestions[0]?.direction).toBe('decrease')
    expect(d.headline).toMatch(/schnell/)
  })

  it('hängt die Laufkontrolle an das Ergebnis, damit beide Stufen sichtbar bleiben', () => {
    expect(dia(19, [], 3).run?.band).toBe('farFast')
  })
})
