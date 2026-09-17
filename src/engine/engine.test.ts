/**
 * Abnahmeszenarien G1–G12 aus dem Briefing (docs/01-briefing.md, Teil G).
 *
 * Diese Tests sind der Beleg, dass die App tut, was zugesagt wurde —
 * insbesondere die Fälle, in denen sie NICHT das Naheliegende tun darf.
 */
import type { RoastLevel } from '@domain'
import { describe, it, expect } from 'vitest'
import type { Bean, Bag, Brew, Grinder, Defect } from '@domain'
import type { EngineContext, PreferenceModel } from '@/domain'
import { DEFAULT_SETTINGS, EMPTY_LEARNED } from '@/domain'
import { startingPoint } from './starting'
import { diagnose } from './diagnose'
import { assessFreshness, driftCorrection, restWindow } from './freshness'
import { targetTimeRange, tolerances, roastRuleFor, GRINDER_CATALOG, grindRangeForVariant } from '@/kb'
import { correctionFromTime, calibrate, suggestedSetting, timeIsTrustworthy, formatSetting, grinderFromCatalog } from './grinder'
import { recompute } from './learn'

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
  roastDate: daysAgo(12),
  depleted: false,
  createdAt: daysAgo(12),
  ...over,
})

const grinder: Grinder = {
  id: 'gr1',
  name: 'Test JX-Pro',
  burrType: 'conical',
  scaleType: 'stepped',
  micronPerStep: 12.5,
  zeroPointOffsetMicron: 0,
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

const brew = (over: Partial<Brew> = {}): Brew => ({
  id: 'x' + Math.random().toString(36).slice(2),
  bagId: 'g1',
  beanId: 'b1',
  method: 'espresso',
  actual: { doseG: 18, yieldG: 36, timeS: 28, waterTempC: 93, grindSetting: { equipmentId: 'gr1', value: 24, unit: 'clicks' } },
  isBest: false,
  createdAt: daysAgo(5),
  ...over,
})

// ══════════════════════════════════════════════════════════════════════

describe('G1 — Startpunkt für eine neue Bohne', () => {
  it('leitet aus Röstgrad, Herkunft und Höhe ab und begründet sichtbar', () => {
    const sp = startingPoint(ctx())
    expect(sp.source).toBe('default')
    expect(sp.proposal.doseG).toBeGreaterThan(15)
    expect(sp.proposal.ratio).toBeGreaterThan(1.5)
    expect(sp.rationale.length).toBeGreaterThan(0)
    expect(sp.rationale[0]!.kind).toBe('source')
  })

  it('mahlt bei hoher Anbauhöhe feiner und brüht heißer', () => {
    const low = startingPoint(ctx({ bean: bean({ altitudeMasl: [1000, 1200] }) }))
    const high = startingPoint(ctx({ bean: bean({ altitudeMasl: [1900, 2100] }) }))
    expect(high.proposal.grindSetting!).toBeLessThan(low.proposal.grindSetting!)
    expect(high.proposal.waterTempC).toBeGreaterThan(low.proposal.waterTempC)
  })

  it('helle Röstung: feiner, heißer, weitere Ratio als dunkle', () => {
    const light = startingPoint(ctx({ bean: bean({ roastLevel: 'light' }) }))
    const dark = startingPoint(ctx({ bean: bean({ roastLevel: 'dark' }) }))
    expect(light.proposal.grindSetting!).toBeLessThan(dark.proposal.grindSetting!)
    expect(light.proposal.waterTempC).toBeGreaterThan(dark.proposal.waterTempC)
    expect(light.proposal.ratio).toBeGreaterThan(dark.proposal.ratio)
  })

  it('Decaf wird gröber und kühler gefahren', () => {
    const normal = startingPoint(ctx())
    const decaf = startingPoint(ctx({ bean: bean({ isDecaf: true }) }))
    expect(decaf.proposal.grindSetting!).toBeGreaterThan(normal.proposal.grindSetting!)
    expect(decaf.proposal.waterTempC).toBeLessThan(normal.proposal.waterTempC)
  })
})

describe('G2 — Zeitabweichung wird zu einer konkreten Klickzahl', () => {
  it('35 s statt 28 s ergibt rund 3 Klicks gröber mit Zeitvorhersage', () => {
    const c = correctionFromTime(35, 28, 'espresso', grinder, 24)
    expect(c).not.toBeNull()
    expect(c!.steps).toBe(3)
    expect(c!.hasSteps).toBe(true)
    expect(c!.expectedTimeS).toBeGreaterThanOrEqual(26)
    expect(c!.expectedTimeS).toBeLessThanOrEqual(30)
  })

  it('ohne Mühle gibt es Prozent statt Klicks — aber immer eine Zahl', () => {
    const c = correctionFromTime(35, 28, 'espresso', undefined, undefined)
    expect(c!.hasSteps).toBe(false)
    expect(Math.round(c!.percent)).toBe(12)
  })

  it('winzige Abweichungen erzeugen keinen Vorschlag', () => {
    expect(correctionFromTime(29, 28, 'espresso', grinder, 24)).toBeNull()
  })

  it('die Diagnose liefert alle fünf Pflichtteile', () => {
    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 36, timeS: 36, waterTempC: 93, grindSetting: { equipmentId: 'gr1', value: 24, unit: 'clicks' } },
      observations: { flowState: 'slow' },
      tasting: { rating: 2, defects: ['bitter', 'astringent'], characters: [], wouldRepeat: false },
      targetTimeS: [26, 30],
    })
    expect(d.blocked).toBe(false)
    expect(d.suggestions).toHaveLength(1)
    const s = d.suggestions[0]!
    expect(s.what).toBeTruthy()
    expect(s.why).toBeTruthy()
    expect(s.expectation).toBeTruthy()
    expect(s.confidence).toBeTruthy()
    expect(s.variable).toBe('grindSetting')
    expect(s.delta!).toBeGreaterThan(0) // gröber
  })
})

describe('G3 — sauer UND bitter blockiert jede Parameterempfehlung', () => {
  it('gibt keine Mahlgradempfehlung, sondern Technikhinweise', () => {
    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 36, timeS: 28 },
      tasting: { rating: 2, defects: ['sour', 'bitter'], characters: [], wouldRepeat: false },
      targetTimeS: [26, 30],
    })
    expect(d.blocked).toBe(true)
    expect(d.suggestions).toHaveLength(0)
    expect(d.techniqueSteps?.length).toBeGreaterThan(0)
  })

  it('gilt auch für sauer + adstringierend', () => {
    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 36, timeS: 28 },
      tasting: { rating: 2, defects: ['sour', 'astringent'], characters: [], wouldRepeat: false },
    })
    expect(d.blocked).toBe(true)
  })

  it('bei Channeling ist die Zeit gesperrt', () => {
    expect(timeIsTrustworthy('uneven')).toBe(false)
    expect(timeIsTrustworthy('spritzing')).toBe(false)
    expect(timeIsTrustworthy('normal')).toBe(true)

    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 36, timeS: 19 },
      observations: { flowState: 'spritzing' },
      tasting: { rating: 2, defects: ['sour'], characters: [], wouldRepeat: false },
      targetTimeS: [26, 30],
    })
    expect(d.blocked).toBe(true)
    expect(d.headline).toContain('Channeling')
  })

  it('AeroPress verweist bei diesem Muster NICHT auf Kanalbildung', () => {
    const d = diagnose({
      ctx: ctx({ method: 'aeropress' }),
      actual: { doseG: 16, waterG: 240, timeS: 90 },
      tasting: { rating: 2, defects: ['sour', 'bitter'], characters: [], wouldRepeat: false },
    })
    expect(d.blocked).toBe(true)
    const txt = (d.techniqueSteps ?? []).join(' ')
    expect(txt).toMatch(/Mahlwerk|Röstung/)
  })
})

describe('G4 — Frische-Drift korrigiert den Referenzpunkt', () => {
  it('14 Tage älter ergibt etwa einen Klick feiner', () => {
    const d = driftCorrection('espresso', 8, 22)
    expect(d.steps).toBeLessThan(0)
    expect(Math.abs(d.steps)).toBe(1)
    expect(d.reason).toContain('älter')
  })

  it('kleine Altersunterschiede lösen nichts aus', () => {
    expect(driftCorrection('espresso', 10, 13).steps).toBe(0)
  })

  it('gilt nicht für Filtermethoden', () => {
    expect(driftCorrection('v60', 8, 30).steps).toBe(0)
  })

  it('wird im Startpunkt tatsächlich angewendet', () => {
    const history = [brew({ tasting: { rating: 5, defects: [], characters: [], wouldRepeat: true }, createdAt: daysAgo(20) })]
    const learned = {
      ...EMPTY_LEARNED,
      perBean: { 'b1:espresso': { bestBrewId: history[0]!.id, medianParams: {}, refDaysOffRoast: 6, sampleSize: 3, avgRating: 5 } },
    }
    const sp = startingPoint(ctx({ beanHistory: history, learned, bag: bag({ roastDate: daysAgo(26) }) }))
    expect(sp.source).toBe('personal')
    expect(sp.rationale.some((r) => r.text.includes('älter'))).toBe(true)
  })
})

describe('G5 — zu frische Bohne wird nicht eingemessen', () => {
  it('blockiert bei 3 Tagen nach Röstung', () => {
    const d = diagnose({
      ctx: ctx({ bag: bag({ roastDate: daysAgo(3) }) }),
      actual: { doseG: 18, yieldG: 36, timeS: 22 },
      tasting: { rating: 2, defects: ['sour'], characters: [], wouldRepeat: false },
      targetTimeS: [26, 30],
    })
    expect(d.blocked).toBe(true)
    expect(d.headline).toContain('frisch')
  })

  it('Ruhefenster: Espresso braucht länger als V60', () => {
    expect(restWindow('espresso', 'medium').min).toBeGreaterThan(restWindow('v60', 'medium').min)
  })

  it('Decaf altert schneller', () => {
    expect(restWindow('espresso', 'medium', true).max).toBeLessThan(restWindow('espresso', 'medium', false).max)
  })

  it('überalterte Bohne wird als unreparierbar gemeldet', () => {
    const d = diagnose({
      ctx: ctx({ bag: bag({ roastDate: daysAgo(90) }) }),
      actual: { doseG: 18, yieldG: 36, timeS: 28 },
      tasting: { rating: 2, defects: ['flat'], characters: [], wouldRepeat: false },
    })
    expect(d.blocked).toBe(true)
    expect(d.headline).toContain('überaltert')
  })

  it('Frische-Score ist im Fenster hoch und außerhalb niedrig', () => {
    const good = assessFreshness(bag({ roastDate: daysAgo(12) }), 'espresso', 'medium', false, TODAY)
    const bad = assessFreshness(bag({ roastDate: daysAgo(45) }), 'espresso', 'medium', false, TODAY)
    expect(good.state).toBe('peak')
    expect(good.score).toBeGreaterThan(bad.score)
  })
})

describe('G6 — Schleifenerkennung bricht ergebnisloses Drehen ab', () => {
  it('erkennt drei Korrekturen in dieselbe Richtung ohne Besserung', () => {
    const hist = [
      brew({ actual: { doseG: 18, yieldG: 36, timeS: 30, grindSetting: { equipmentId: 'gr1', value: 18, unit: 'clicks' } }, tasting: { rating: 2, defects: ['sour', 'bitter'], characters: [], wouldRepeat: false }, createdAt: daysAgo(1) }),
      brew({ actual: { doseG: 18, yieldG: 36, timeS: 29, grindSetting: { equipmentId: 'gr1', value: 20, unit: 'clicks' } }, tasting: { rating: 2, defects: ['sour'], characters: [], wouldRepeat: false }, createdAt: daysAgo(2) }),
      brew({ actual: { doseG: 18, yieldG: 36, timeS: 28, grindSetting: { equipmentId: 'gr1', value: 22, unit: 'clicks' } }, tasting: { rating: 2, defects: ['sour'], characters: [], wouldRepeat: false }, createdAt: daysAgo(3) }),
      brew({ actual: { doseG: 18, yieldG: 36, timeS: 27, grindSetting: { equipmentId: 'gr1', value: 24, unit: 'clicks' } }, tasting: { rating: 2, defects: ['sour'], characters: [], wouldRepeat: false }, createdAt: daysAgo(4) }),
    ]
    const d = diagnose({
      ctx: ctx({ beanHistory: hist }),
      actual: { doseG: 18, yieldG: 36, timeS: 30, grindSetting: { equipmentId: 'gr1', value: 18, unit: 'clicks' } },
      tasting: { rating: 2, defects: ['sour', 'bitter'], characters: [], wouldRepeat: false },
      targetTimeS: [26, 30],
    })
    expect(d.blocked).toBe(true)
    expect(d.suggestions).toHaveLength(0)
  })
})

describe('G7 — persönlicher Startpunkt ersetzt den Standard', () => {
  it('nutzt ab drei guten Durchgängen die eigene Referenz', () => {
    const good = [1, 2, 3].map((i) =>
      brew({
        actual: { doseG: 18.5, yieldG: 41, timeS: 30, waterTempC: 94, grindSetting: { equipmentId: 'gr1', value: 21, unit: 'clicks' } },
        tasting: { rating: 5, defects: [], characters: ['balanced'], wouldRepeat: true },
        createdAt: daysAgo(i),
      }),
    )
    const sp = startingPoint(ctx({ beanHistory: good }))
    expect(sp.source).toBe('personal')
    expect(sp.proposal.doseG).toBe(18.5)
    expect(sp.proposal.grindSetting).toBe(21)
    expect(sp.headline).toContain('Referenz')
  })

  it('überträgt von einer ähnlichen Bohne, wenn keine eigene existiert', () => {
    const other = bean({ id: 'b2', name: 'Nachbarbohne', roastLevel: 'medium', process: 'washed', origins: [{ country: 'Kolumbien' }] })
    const hist = [
      brew({ beanId: 'b2', actual: { doseG: 18, yieldG: 38, timeS: 29, waterTempC: 93, grindSetting: { equipmentId: 'gr1', value: 23, unit: 'clicks' } }, tasting: { rating: 5, defects: [], characters: [], wouldRepeat: true } }),
    ]
    const sp = startingPoint(ctx({ methodHistory: hist, allBeans: [bean(), other] }))
    expect(sp.source).toBe('transfer')
    expect(sp.rationale[0]!.text).toContain('Nachbarbohne')
  })
})

describe('G8 — persönliche Tendenz wird erkannt und benannt', () => {
  it('erkennt systematisch engere Verhältnisse', () => {
    const beans = [bean()]
    const bags = [bag()]
    const brews = Array.from({ length: 22 }, (_, i) =>
      brew({
        id: 'n' + i,
        actual: { doseG: 18, yieldG: 31, timeS: 28, waterTempC: 93 }, // 1:1,72 statt Standard 1:2,1
        tasting: { rating: 5, defects: [], characters: [], wouldRepeat: true },
        createdAt: daysAgo(i),
      }),
    )
    const learned = recompute(brews, beans, bags, TODAY)
    const pref = learned.preference.espresso!
    expect(pref.ratioBias).toBeLessThan(-0.15)
    expect(pref.statement).toBeTruthy()
    expect(pref.statement).toContain('enger')
  })

  it('schweigt bei zu dünner Datenlage', () => {
    const brews = [brew({ tasting: { rating: 5, defects: [], characters: [], wouldRepeat: true } })]
    const learned = recompute(brews, [bean()], [bag()], TODAY)
    expect(learned.preference.espresso?.statement).toBeUndefined()
  })

  it('merkt sich die beste Einstellung pro Bohne', () => {
    const brews = [1, 2, 3].map((i) =>
      brew({ id: 'p' + i, tasting: { rating: 5, defects: [], characters: [], wouldRepeat: true }, createdAt: daysAgo(i) }),
    )
    const learned = recompute(brews, [bean()], [bag()], TODAY)
    expect(learned.perBean['b1:espresso']).toBeDefined()
    expect(learned.perBean['b1:espresso']!.sampleSize).toBe(3)
  })
})

describe('Wasser-Notausgang (Briefing C6)', () => {
  it('meldet Wasserverdacht statt einer Mahlgradkorrektur', () => {
    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 36, timeS: 28 },
      measurement: { tdsPct: 10, beverageMassG: 36 }, // ergibt EY 20 %
      tasting: { rating: 2, defects: ['flat'], characters: [], wouldRepeat: false },
      targetTimeS: [26, 30],
    })
    expect(d.blocked).toBe(true)
    expect(d.headline).toContain('Wasser')
    expect(d.suggestions).toHaveLength(0)
  })
})

describe('Methodenspezifische Korrekturreihenfolge', () => {
  it('AeroPress: Rühren vor Mahlgrad bei Unterextraktion', () => {
    const d = diagnose({
      ctx: ctx({ method: 'aeropress' }),
      actual: { doseG: 16, waterG: 240, timeS: 90, stirCount: 2, waterTempC: 92 },
      tasting: { rating: 2, defects: ['sour', 'salty'], characters: [], wouldRepeat: false },
      targetTimeS: [85, 95],
    })
    expect(d.suggestions[0]!.variable).toBe('stirCount')
  })

  it('AeroPress: Temperatur vor Mahlgrad bei Bitterkeit', () => {
    const d = diagnose({
      ctx: ctx({ method: 'aeropress' }),
      actual: { doseG: 16, waterG: 240, timeS: 90, waterTempC: 95 },
      tasting: { rating: 2, defects: ['bitter'], characters: [], wouldRepeat: false },
      targetTimeS: [85, 95],
    })
    expect(d.suggestions[0]!.variable).toBe('waterTempC')
    expect(d.suggestions[0]!.delta).toBe(-5)
  })

  it('Espresso: Mahlgrad zuerst', () => {
    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 36, timeS: 37, waterTempC: 93, grindSetting: { equipmentId: 'gr1', value: 24, unit: 'clicks' } },
      tasting: { rating: 2, defects: ['bitter'], characters: [], wouldRepeat: false },
      targetTimeS: [26, 30],
    })
    expect(d.suggestions[0]!.variable).toBe('grindSetting')
  })

  it('V60: Zielzeit skaliert mit der Dosis (Anti-Regel D-66)', async () => {
    const { targetTimeRange } = await import('@/kb')
    const small = targetTimeRange('v60', 12)!
    const large = targetTimeRange('v60', 30)!
    expect(large[0]).toBeGreaterThan(small[1])
  })
})

describe('Kardinalregel: genau eine Empfehlung', () => {
  it('gibt nie mehr als eine Korrektur aus', () => {
    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 36, timeS: 40, waterTempC: 96, grindSetting: { equipmentId: 'gr1', value: 24, unit: 'clicks' } },
      tasting: { rating: 1, defects: ['bitter', 'astringent', 'thin'], characters: [], wouldRepeat: false },
      targetTimeS: [26, 30],
    })
    expect(d.suggestions.length).toBeLessThanOrEqual(1)
    if (d.suggestions[0]) expect(d.suggestions[0].alternative).toBeTruthy()
  })

  it('guter Kaffee ohne Fehler wird als Referenz vorgeschlagen', () => {
    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 36, timeS: 28 },
      tasting: { rating: 5, defects: [], characters: ['balanced'], wouldRepeat: true },
      targetTimeS: [26, 30],
    })
    expect(d.saveAsReference).toBe(true)
    expect(d.suggestions).toHaveLength(0)
  })
})

describe('Mühlen-Selbstkalibrierung', () => {
  it('berechnet die Schrittweite aus zwei Shots', () => {
    const r = calibrate({ time1S: 34, setting1: 20, time2S: 24, setting2: 24, method: 'espresso' })
    expect('micronPerStep' in r).toBe(true)
    if ('micronPerStep' in r) {
      expect(r.micronPerStep).toBeGreaterThan(10)
      expect(r.micronPerStep).toBeLessThan(20)
      expect(r.confidence).toBe('measured')
    }
  })

  it('weist unplausible Eingaben zurück statt Unsinn zu rechnen', () => {
    // Gröber gestellt, aber langsamer gelaufen -> physikalisch unmöglich
    const r = calibrate({ time1S: 24, setting1: 20, time2S: 34, setting2: 24, method: 'espresso' })
    expect('error' in r).toBe(true)
  })

  it('schlägt sinnvolle Startwerte je Methode vor', () => {
    const esp = suggestedSetting(grinder, 'espresso')!
    const v60 = suggestedSetting(grinder, 'v60')!
    expect(esp).toBeLessThan(v60)
  })
})

describe('Messungen', () => {
  it('unplausible Extraktion wird abgefangen statt interpretiert', () => {
    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 36, timeS: 28 },
      measurement: { tdsPct: 14, beverageMassG: 36 }, // EY 28 % -> unmöglich
      tasting: { rating: 3, defects: [], characters: [], wouldRepeat: false },
    })
    expect(d.blocked).toBe(true)
    expect(d.checklist?.length).toBeGreaterThan(0)
  })

  it('rechnet die Extraktion beim Filter mit Retentionswasser', () => {
    const d = diagnose({
      ctx: ctx({ method: 'v60' }),
      actual: { doseG: 18, waterG: 300, timeS: 165 },
      measurement: { tdsPct: 1.38, beverageMassG: 264 },
      tasting: { rating: 4, defects: [], characters: [], wouldRepeat: true },
    })
    expect(d.metrics?.ey).toBeCloseTo(20.2, 1)
  })
})

// ══════════════════════════════════════════════════════════════════════
// Iteration 2 — Übernahmen aus der alten barista-pwa (docs/03)
// ══════════════════════════════════════════════════════════════════════

describe('Bohnen-Eignung je Methode (docs/03 §2.1)', () => {
  it('heller Washed ist im Espresso schwierig, im V60 ideal', async () => {
    const { suitability } = await import('./suitability')
    const b = bean({ roastLevel: 'light', process: 'washed', origins: [{ country: 'Äthiopien' }] })
    const esp = suitability(b, 'espresso')
    const v60 = suitability(b, 'v60')
    expect(esp.score).toBeLessThan(v60.score)
    expect(esp.isWarning).toBe(true)
    expect(v60.level).toBe('ideal')
  })

  it('dunkler Natural ist im Espresso ideal', async () => {
    const { suitability } = await import('./suitability')
    const b = bean({ roastLevel: 'dark', process: 'natural', origins: [{ country: 'Brasilien' }] })
    expect(suitability(b, 'espresso').level).toBe('ideal')
  })

  it('schlägt die passendste Methode vor', async () => {
    const { bestMethodFor } = await import('./suitability')
    expect(bestMethodFor(bean({ roastLevel: 'light', process: 'washed', origins: [{ country: 'Kenia' }] })).method).toBe('v60')
    expect(bestMethodFor(bean({ roastLevel: 'dark', process: 'natural', origins: [{ country: 'Brasilien' }] })).method).toBe('espresso')
  })

  it('begründet die Warnung im Klartext statt mit einer Zahl', async () => {
    const { suitability } = await import('./suitability')
    const s = suitability(bean({ roastLevel: 'light', process: 'washed' }), 'espresso')
    expect(s.reason.length).toBeGreaterThan(40)
    expect(s.reason).toContain('V60')
  })
})

const REST_BASE_MEDIUM_ESPRESSO: [number, number] = [7, 21]

describe('Ruhefenster nach Aufbereitung (korrigiert, docs/04 §3-4)', () => {
  // barista-pwa verschob hier das UNTERE Ende und widersprach dabei dem
  // eigenen Quellkommentar. ASC sagt zur Ruhezeit nach Aufbereitung nichts.
  // Belegbar ist nur: fruchtbetonte Aufbereitungen verlieren ihr Aroma früher.
  it('Aufbereitung verschiebt NUR das obere Fensterende', () => {
    const washed = restWindow('espresso', 'medium', false, 'washed')
    const natural = restWindow('espresso', 'medium', false, 'natural')
    expect(natural.min).toBe(washed.min)
    expect(natural.max).toBeLessThan(washed.max)
  })

  it('der Effekt bleibt klein — höchstens 5 Tage Spanne', () => {
    const washed = restWindow('espresso', 'medium', false, 'washed')
    const anaerobic = restWindow('espresso', 'medium', false, 'anaerobic')
    expect(washed.max - anaerobic.max).toBeLessThanOrEqual(5)
  })

  it('wird als schwach belegt ausgewiesen', () => {
    const natural = restWindow('espresso', 'medium', false, 'natural')
    const r = natural.reasons.find((x) => x.text.includes('Aufbereitung'))
    expect(r?.confidence).toBe('low')
  })

  it('Röstgrad bleibt der dominante Faktor', () => {
    // Der Unterschied hell/dunkel muss deutlich größer sein als washed/natural
    const roastSpan =
      restWindow('espresso', 'light').max - restWindow('espresso', 'dark').max
    const processSpan =
      restWindow('espresso', 'medium', false, 'washed').max -
      restWindow('espresso', 'medium', false, 'natural').max
    expect(roastSpan).toBeGreaterThan(processSpan * 2)
  })

  it('Anbauhöhe über 1800 m verschiebt das Fenster nach hinten', () => {
    const flach = restWindow('espresso', 'medium', false, 'washed', [1200, 1400])
    const hoch = restWindow('espresso', 'medium', false, 'washed', [1900, 2100])
    expect(hoch.min).toBeGreaterThan(flach.min)
    expect(hoch.max).toBeGreaterThan(flach.max)
  })

  it('ohne Aufbereitungsangabe bleibt es beim Röstgrad-Fenster', () => {
    const a = restWindow('espresso', 'medium')
    const b = REST_BASE_MEDIUM_ESPRESSO
    expect([a.min, a.max]).toEqual(b)
  })
})

describe('Startpunkt aus dem eigenen besten Versuch (docs/03 §2.3)', () => {
  it('nutzt den besten Versuch auch unter vier Sternen', () => {
    const hist = [
      brew({ id: 'a', actual: { doseG: 18, yieldG: 34, timeS: 27, grindSetting: { equipmentId: 'gr1', value: 22, unit: 'clicks' } }, tasting: { rating: 3, defects: ['sour'], characters: [], wouldRepeat: false }, createdAt: daysAgo(1) }),
      brew({ id: 'b', actual: { doseG: 18, yieldG: 36, timeS: 25, grindSetting: { equipmentId: 'gr1', value: 26, unit: 'clicks' } }, tasting: { rating: 2, defects: ['sour'], characters: [], wouldRepeat: false }, createdAt: daysAgo(2) }),
    ]
    const sp = startingPoint(ctx({ beanHistory: hist }))
    expect(sp.source).toBe('own-attempt')
    expect(sp.proposal.grindSetting).toBe(22) // der besser bewertete
    expect(sp.headline).toContain('Versuch')
  })

  it('ein einzelner schlechter Versuch reicht nicht — dann Standard', () => {
    const hist = [brew({ tasting: { rating: 2, defects: ['sour'], characters: [], wouldRepeat: false } })]
    expect(startingPoint(ctx({ beanHistory: hist })).source).toBe('default')
  })

  it('gute Referenz schlägt den bloßen Versuch', () => {
    const hist = [
      brew({ id: 'g', tasting: { rating: 5, defects: [], characters: [], wouldRepeat: true }, createdAt: daysAgo(1) }),
      brew({ id: 'h', tasting: { rating: 3, defects: ['sour'], characters: [], wouldRepeat: false }, createdAt: daysAgo(2) }),
    ]
    expect(startingPoint(ctx({ beanHistory: hist })).source).toBe('personal')
  })
})

describe('Mahlgrad-Plausibilität (docs/03 §2.4)', () => {
  it('meldet absurd feine Einstellungen für V60', async () => {
    const { grindPlausibility } = await import('./grinder')
    const r = grindPlausibility(5, 'v60', grinder) // 62 µm — Türkisch-Bereich
    expect(r.ok).toBe(false)
    expect(r.suggestion).toBeGreaterThan(20)
  })

  it('lässt sinnvolle Einstellungen durch', async () => {
    const { grindPlausibility } = await import('./grinder')
    expect(grindPlausibility(24, 'espresso', grinder).ok).toBe(true)
    expect(grindPlausibility(54, 'v60', grinder).ok).toBe(true)
  })

  it('ohne Mühle wird nicht geraten', async () => {
    const { grindPlausibility } = await import('./grinder')
    expect(grindPlausibility(5, 'v60', undefined).ok).toBe(true)
  })
})

describe('Iteration 3 — Konsistenz der Ausgabe', () => {
  it('deckelt absurd große Mahlgradsprünge und erklärt die Deckelung', async () => {
    const { correctionFromTime, cappedNote, MAX_STEPS_PER_ROUND } = await import('./grinder')
    const c = correctionFromTime(2, 28, 'espresso', grinder, 24)!
    expect(Math.abs(c.steps)).toBeLessThanOrEqual(MAX_STEPS_PER_ROUND)
    expect(c.capped).toBe(true)
    expect(Math.abs(c.fullSteps)).toBeGreaterThan(MAX_STEPS_PER_ROUND)
    expect(cappedNote(c)).toContain('Klicks')
  })

  it('normale Korrekturen werden nicht gedeckelt', async () => {
    const { correctionFromTime, cappedNote } = await import('./grinder')
    const c = correctionFromTime(35, 28, 'espresso', grinder, 24)!
    expect(c.capped).toBe(false)
    expect(cappedNote(c)).toBeUndefined()
  })

  it('Überschrift widerspricht nie der Empfehlung', () => {
    // Durchgerauschter Shot mit Tag „bitter": die Empfehlung muss feiner
    // lauten, die Überschrift darf dann nicht „Zu viel extrahiert" sagen.
    //
    // 14 s statt der früheren 2 s: Eine Zeit weit unter dem Ziel gilt
    // inzwischen als abgebrochener Durchgang und wird gar nicht mehr
    // ausgewertet. 14 s sind ein echter Gusher, kein Bedienfehler.
    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 36, timeS: 14, grindSetting: { equipmentId: 'gr1', value: 24, unit: 'clicks' } },
      tasting: { rating: 2, defects: ['bitter'], characters: [], wouldRepeat: false },
      targetTimeS: [26, 30],
    })
    const s = d.suggestions[0]!
    expect(s.direction).toBe('decrease') // feiner
    expect(d.headline).toBe('Zu wenig extrahiert')
  })

  it('Überschrift bei echter Überextraktion', () => {
    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 36, timeS: 40, grindSetting: { equipmentId: 'gr1', value: 24, unit: 'clicks' } },
      tasting: { rating: 2, defects: ['bitter', 'astringent'], characters: [], wouldRepeat: false },
      targetTimeS: [26, 30],
    })
    expect(d.suggestions[0]!.direction).toBe('increase')
    expect(d.headline).toBe('Zu viel extrahiert')
  })

  it('jede Empfehlung hat eine Alternative', () => {
    const cases = [
      { defects: ['sour'] as const, timeS: 20 },
      { defects: ['bitter'] as const, timeS: 40 },
      { defects: ['thin'] as const, timeS: 28 },
    ]
    for (const c of cases) {
      const d = diagnose({
        ctx: ctx(),
        actual: { doseG: 18, yieldG: 36, timeS: c.timeS, waterTempC: 93, grindSetting: { equipmentId: 'gr1', value: 24, unit: 'clicks' } },
        tasting: { rating: 2, defects: [...c.defects], characters: [], wouldRepeat: false },
        targetTimeS: [26, 30],
      })
      // Erst die Voraussetzung prüfen, dann die Zusage. Vorher stand hier
      // `if (d.suggestions[0]) expect(...)` — ohne Empfehlung lief der Test
      // durch, ohne irgendetwas festzustellen. Vom Linter gefunden
      // (`vitest(expect-expect)`), siehe P7.
      expect(d.suggestions[0], JSON.stringify(c.defects)).toBeTruthy()
      expect(d.suggestions[0]!.alternative).toBeTruthy()
    }
  })

  it('jede Methode hat einen eigenen Mahlgrad-Zielbereich', async () => {
    const { referenceMicron } = await import('@/kb')
    const e = referenceMicron('espresso')
    const a = referenceMicron('aeropress')
    const v = referenceMicron('v60')
    expect(e).toBeLessThan(a)
    expect(a).toBeLessThan(v)
  })
})

// ════════════════════════════════════════════════════════════════════
//  ASC-Kursrezept und Toleranzen (docs/04-faktencheck.md)
// ════════════════════════════════════════════════════════════════════

describe('ASC-Basisrezept', () => {
  it('reproduziert die Kurszeiten bei 18 g → 36 g', () => {
    const cases: [RoastLevel, [number, number]][] = [
      ['light', [27, 30]],
      ['medium', [24, 26]],
      ['dark', [20, 23]],
    ]
    for (const [roast, asc] of cases) {
      const range = targetTimeRange('espresso', 18, roast, 36)!
      const mid = (range[0] + range[1]) / 2
      // Kursspanne plus die zulässige ±1,5 s Rundung
      expect(mid).toBeGreaterThanOrEqual(asc[0] - 1.5)
      expect(mid).toBeLessThanOrEqual(asc[1] + 1.5)
    }
  })

  it('Zielzeit reagiert auf die Ratio — der alte Fehler', () => {
    const eng = targetTimeRange('espresso', 18, 'light', 36)!
    const weit = targetTimeRange('espresso', 18, 'light', 48.6)!
    expect(weit[0]).toBeGreaterThan(eng[0])
  })

  it('Zielzeit reagiert auf die Dosis', () => {
    const klein = targetTimeRange('espresso', 14, 'medium', 28)!
    const gross = targetTimeRange('espresso', 22, 'medium', 44)!
    expect(gross[0]).toBeGreaterThan(klein[0])
  })

  it('dunkler röstet schneller aus als hell', () => {
    const hell = targetTimeRange('espresso', 18, 'light', 36)!
    const dunkel = targetTimeRange('espresso', 18, 'dark', 36)!
    expect(dunkel[1]).toBeLessThan(hell[0])
  })
})

describe('Toleranzen (ASC: Dosis ±1 g · Zeit ±3 s · Ausbringung ±3 g)', () => {
  it('sind hinterlegt', () => {
    const t = tolerances('espresso')
    expect(t.doseG).toBe(1)
    expect(t.timeS).toBe(3)
    expect(t.yieldG).toBe(3)
  })

  it('innerhalb der Zeittoleranz wird NICHT korrigiert', () => {
    // 27 s bei Ziel 25 s = 2 s Abweichung, liegt innerhalb ±3 s
    expect(correctionFromTime(27, 25, 'espresso')).toBeNull()
    expect(correctionFromTime(23, 25, 'espresso')).toBeNull()
  })

  it('außerhalb der Toleranz wird korrigiert', () => {
    const c = correctionFromTime(31, 25, 'espresso')
    expect(c).not.toBeNull()
    expect(c!.percent).toBeGreaterThan(0) // gröber
  })

  it('Filter verzeiht mehr als Espresso', () => {
    expect(tolerances('v60').timeS).toBeGreaterThan(tolerances('espresso').timeS)
  })
})

describe('Röstgradabhängige Lesart (wenn Light Roast und sauer, dann …)', () => {
  it('hell + sauer → Mahlgrad zuerst, Säure als Normalfall gelesen', () => {
    const r = roastRuleFor('light', ['sour'])
    expect(r?.id).toBe('R-LIGHT-SOUR')
    expect(r?.order[0]).toBe('grindSetting')
    expect(r?.reading).toContain('Normalfall')
  })

  it('dunkel + sauer → Technik zuerst, weil Säure dort ungewöhnlich ist', () => {
    const r = roastRuleFor('dark', ['sour'])
    expect(r?.id).toBe('R-DARK-SOUR')
    expect(r?.order[0]).toBe('technique')
  })

  it('dunkel + bitter → Temperatur vor Mahlgrad', () => {
    const r = roastRuleFor('dark', ['bitter'])
    expect(r?.order[0]).toBe('waterTempC')
  })

  it('hell + bitter → Verdacht auf unterentwickelte Röstung', () => {
    const r = roastRuleFor('light', ['bitter'])
    expect(r?.suspectRoast).toBe(true)
  })

  it('hell + flach → zuerst das Wasser, nicht die Brühparameter', () => {
    const r = roastRuleFor('light', ['flat'])
    expect(r?.order[0]).toBe('water')
  })

  it('derselbe Fehler wird bei hell und dunkel verschieden gelesen', () => {
    const hell = roastRuleFor('light', ['sour'])
    const dunkel = roastRuleFor('dark', ['sour'])
    expect(hell?.order[0]).not.toBe(dunkel?.order[0])
  })

  it('mittlere Röstung nutzt die Standardkaskade', () => {
    expect(roastRuleFor('medium', ['sour'])).toBeUndefined()
  })
})

describe('Mylo-Skala gegen bekannte Partikelgrößen (docs/04 §9)', () => {
  // Das Datenblatt nennt 20 µm/Klick — das beschreibt den Mahlscheibenabstand,
  // nicht die Partikelgröße. Aus dem Aufdruck hergeleitet: 12,5 µm/Klick.
  const mylo = GRINDER_CATALOG.find((g) => g.id === 'mylo-sg2')!
  const micron = (clicks: number) => mylo.zeroPointOffsetMicron + clicks * mylo.micronPerStep

  const STANDARD: Record<string, [number, number]> = {
    espresso: [200, 400],
    moka: [350, 500],
    v60: [550, 800],
    frenchpress: [900, 1200],
  }

  it('jede Werksempfehlung liegt im Standardbereich ihrer Methode', () => {
    for (const [key, [lo, hi]] of Object.entries(STANDARD)) {
      const preset = mylo.presets?.[key]
      expect(preset, `Preset fehlt: ${key}`).toBeDefined()
      const a = micron(preset![0])
      const b = micron(preset![1])
      // Bereiche müssen sich überlappen
      expect(a, `${key} zu grob`).toBeLessThan(hi)
      expect(b, `${key} zu fein`).toBeGreaterThan(lo)
    }
  })

  it('die Datenblattangabe 20 µm/Klick ist nachweislich falsch', () => {
    // Gegenprobe: Mit 20 µm/Klick läge KEINE Werksempfehlung mehr in ihrem
    // Standardbereich. French Press ist der eindeutigste Fall.
    const fpAt20 = [80 * 20, 90 * 20] // 1600–1800 µm
    expect(fpAt20[0]).toBeGreaterThan(STANDARD.frenchpress![1]) // > 1200
    // Und Espresso läge im Mittel bei 500 µm statt bei 300
    const espMidAt20 = (20 * 20 + 30 * 20) / 2
    expect(espMidAt20).toBeGreaterThan(STANDARD.espresso![1])
    // Mit dem hergeleiteten Wert stimmt beides
    expect(micron(85)).toBeGreaterThan(STANDARD.frenchpress![0])
    expect(micron(85)).toBeLessThan(STANDARD.frenchpress![1])
  })

  it('AeroPress liegt zwischen Espresso und Pour Over', () => {
    const ap = mylo.presets!['aeropress']!
    expect(ap[0]).toBeGreaterThan(mylo.presets!['espresso']![1])
    expect(ap[1]).toBeLessThan(mylo.presets!['v60']![1])
  })

  it('AeroPress-Standard trifft 450-600 µm', () => {
    const ap = mylo.presets!['aeropress']!
    expect(micron(ap[0])).toBeGreaterThanOrEqual(430)
    expect(micron(ap[1])).toBeLessThanOrEqual(620)
  })

  it('Mahlgrad folgt der Rezeptvariante', () => {
    const espStyle = grindRangeForVariant('Mylo SG2', 'aeropress', 'espresso-style')!
    const std = grindRangeForVariant('Mylo SG2', 'aeropress', 'standard')!
    const cold = grindRangeForVariant('Mylo SG2', 'aeropress', 'cold-brew')!
    expect(espStyle[1]).toBeLessThan(std[0])
    expect(cold[0]).toBeGreaterThan(std[1])
  })

  it('unbekannte Variante fällt auf den Methodenwert zurück', () => {
    expect(grindRangeForVariant('Mylo SG2', 'aeropress', 'gibt-es-nicht')).toEqual(
      mylo.presets!['aeropress'],
    )
  })
})

describe('Mylo-Skala: 1 Klick = 0,1 (vom Nutzer bestätigt)', () => {
  const mylo = GRINDER_CATALOG.find((g) => g.id === 'mylo-sg2')!
  const g = grinderFromCatalog('mylo-sg2', 't')!

  it('10 Klicks ergeben eine Skalenzahl', () => {
    expect(mylo.clicksPerNumber).toBe(10)
    expect(formatSetting(10, g)).toBe('1,0')
    expect(formatSetting(100, g)).toBe('10,0')
  })

  it('25 Klicks sind die Espresso-Standardeinstellung — Skala 2,5', () => {
    expect(formatSetting(25, g)).toBe('2,5')
    expect(suggestedSetting(g, 'espresso')).toBe(25)
  })

  it('jeder Methoden-Startpunkt liegt im Standardbereich seiner Partikelgröße', () => {
    const bands: Record<string, [number, number]> = {
      espresso: [200, 400],
      v60: [550, 800],
      aeropress: [450, 600],
    }
    for (const [m, [lo, hi]] of Object.entries(bands)) {
      const clicks = suggestedSetting(g, m as 'espresso' | 'v60' | 'aeropress')!
      const micron = clicks * g.micronPerStep
      expect(micron, `${m}: ${micron} µm außerhalb ${lo}-${hi}`).toBeGreaterThanOrEqual(lo)
      expect(micron, `${m}: ${micron} µm außerhalb ${lo}-${hi}`).toBeLessThanOrEqual(hi)
    }
  })

  it('Korrekturen kommen in ganzen Klicks, nicht in Skalenzahlen', () => {
    const c = correctionFromTime(35, 25, 'espresso', g, 25)!
    expect(Number.isInteger(c.steps)).toBe(true)
    expect(Math.abs(c.steps)).toBeGreaterThanOrEqual(1)
  })
})

describe('Blend als Herkunft', () => {
  it('greift auf keine Herkunfts-Modifikatoren zu und stürzt nicht ab', () => {
    const blend: Bean = {
      ...bean({ roastLevel: 'medium', process: 'washed' }),
      origins: [{ country: 'Blend' }],
    }
    const sp = startingPoint(ctx({ bean: blend }))
    expect(sp.proposal.doseG).toBeGreaterThan(0)
    expect(sp.proposal.ratio).toBeGreaterThan(0)
    expect(sp.rationale.length).toBeGreaterThan(0)
  })

  it('liefert denselben Startpunkt wie eine unbekannte Einzelherkunft', () => {
    const a = startingPoint(ctx({ bean: { ...bean({}), origins: [{ country: 'Blend' }] } }))
    const b = startingPoint(ctx({ bean: { ...bean({}), origins: [{ country: 'Fantasialand' }] } }))
    expect(a.proposal.ratio).toBe(b.proposal.ratio)
    expect(a.proposal.waterTempC).toBe(b.proposal.waterTempC)
  })
})

describe('Filterkaffeemaschine: kein Vorschlag, der nicht ausführbar ist', () => {
  /**
   * kb/10c §1: Die Brühtemperatur liegt geräteseitig bei 92–96 °C. Die
   * Röstgrad-Modifikatoren rechnen trotzdem — eine dunkle Röstung will
   * kühler —, und das Ergebnis wäre ein Startpunkt, der eine
   * Einstellmöglichkeit behauptet, die das Gerät nicht hat.
   */
  const proben: RoastLevel[] = ['light', 'medium', 'dark']

  it('schlägt für jeden Röstgrad dieselbe Temperatur vor', () => {
    const temps = proben.map(
      (roastLevel) =>
        startingPoint(ctx({ method: 'batchbrew', bean: bean({ roastLevel }) })).proposal.waterTempC,
    )
    expect(new Set(temps).size).toBe(1)
  })

  it('bleibt im Bereich, den das Gerät wirklich liefert', () => {
    for (const roastLevel of proben) {
      const t = startingPoint(ctx({ method: 'batchbrew', bean: bean({ roastLevel }) })).proposal
        .waterTempC
      expect(t).toBeGreaterThanOrEqual(92)
      expect(t).toBeLessThanOrEqual(96)
    }
  })

  it('sagt, dass die Temperatur nicht zur Auswahl steht', () => {
    const sp = startingPoint(ctx({ method: 'batchbrew' }))
    expect(sp.rationale.some((r) => /geräteseitig/.test(r.text))).toBe(true)
  })

  it('lässt die Temperatur bei den anderen Methoden dem Röstgrad folgen', () => {
    // Die Sperre darf nicht auf Methoden übergreifen, bei denen die
    // Temperatur der stärkste Hebel gegen Bitterkeit ist.
    for (const method of ['espresso', 'v60'] as const) {
      const hell = startingPoint(ctx({ method, bean: bean({ roastLevel: 'light' }) })).proposal
        .waterTempC
      const dunkel = startingPoint(ctx({ method, bean: bean({ roastLevel: 'dark' }) })).proposal
        .waterTempC
      expect(hell).toBeGreaterThan(dunkel)
    }
  })

  it('rechnet die Ratio in den Golden-Cup-Korridor', () => {
    // SCA Golden Cup: 55 g/L ± 10 %, also 50–60 g Kaffee je Liter Wasser
    // (kb/10c §2). In der Schreibweise dieser App: Ratio 16,7–20.
    for (const roastLevel of proben) {
      const p = startingPoint(ctx({ method: 'batchbrew', bean: bean({ roastLevel }) })).proposal
      const gPerL = (p.doseG / p.waterG!) * 1000
      expect(gPerL, `${roastLevel}: ${gPerL.toFixed(1)} g/L`).toBeGreaterThanOrEqual(48)
      expect(gPerL, `${roastLevel}: ${gPerL.toFixed(1)} g/L`).toBeLessThanOrEqual(62)
    }
  })
})

describe('Die Begründung nennt nur, was auch geschieht', () => {
  // Der Startpunkt der Filterkaffeemaschine schrieb „dichtere Bohne,
  // deshalb feiner und heißer" — und zwei Zeilen darunter „die
  // Brühtemperatur ist nicht einstellbar". Beides stand gleichzeitig auf
  // dem Bildschirm.
  const hochland = bean({ altitudeMasl: [1500, 1900] })

  it('verspricht keine Temperaturänderung, wo keine möglich ist', () => {
    const sp = startingPoint(ctx({ method: 'batchbrew', bean: hochland }))
    const versprochen = sp.rationale.filter((r) => /heißer|kühler/.test(r.text))
    expect(versprochen).toEqual([])
  })

  it('tut es weiter, wo sie möglich ist', () => {
    const sp = startingPoint(ctx({ method: 'v60', bean: hochland }))
    expect(sp.rationale.some((r) => /heißer/.test(r.text))).toBe(true)
  })

  it('gilt auch für entkoffeinierte Bohnen', () => {
    const koffeinfrei = bean({ isDecaf: true })
    const maschine = startingPoint(ctx({ method: 'batchbrew', bean: koffeinfrei }))
    expect(maschine.rationale.filter((r) => /kühler/.test(r.text))).toEqual([])
    const v60 = startingPoint(ctx({ method: 'v60', bean: koffeinfrei }))
    expect(v60.rationale.some((r) => /kühler/.test(r.text))).toBe(true)
  })
})

// ── Die Vorhersage muss maschinenlesbar sein ──────────────────────────

describe('Wer eine Zeit verspricht, liefert sie auch als Zahl', () => {
  /**
   * Seit 2.0 löst die App ihre Vorhersagen ein. Das geht nur, wenn der
   * Satz „Erwartete Zeit danach: 28 s" denselben Wert auch strukturiert
   * mitbringt. Eine Regel, die das vergisst, fällt im Betrieb nicht auf —
   * die Empfehlung sieht vollständig aus und wird trotzdem nie
   * abgerechnet. Genau so ist D-31 durchgerutscht.
   *
   * Deshalb hier keine Einzelfallprüfung, sondern eine Eigenschaft über
   * alle Zeitbefunde.
   */
  const faelle: { name: string; timeS: number; defects?: Defect[] }[] = [
    // Mit Geschmack — der sensorische Pfad in diagnose.ts
    { name: 'deutlich zu langsam, bitter', timeS: 40, defects: ['bitter'] },
    { name: 'etwas zu langsam, bitter', timeS: 32, defects: ['bitter'] },
    { name: 'deutlich zu schnell, sauer', timeS: 16, defects: ['sour'] },
    { name: 'etwas zu schnell, sauer', timeS: 20, defects: ['sour'] },
    { name: 'im Band, aber sauer', timeS: 26, defects: ['sour'] },
    // OHNE Geschmack — die reine Laufkontrolle in runcheck.ts. Genau
    // dieser Pfad hat D-31 durchrutschen lassen.
    { name: 'nur die Uhr, zu langsam', timeS: 34 },
    { name: 'nur die Uhr, weit zu langsam', timeS: 45 },
    { name: 'nur die Uhr, zu schnell', timeS: 18 },
    { name: 'nur die Uhr, weit zu schnell', timeS: 12 },
  ]

  for (const f of faelle) {
    it(`${f.name} (${f.timeS} s)`, () => {
      const d = diagnose({
        ctx: ctx(),
        actual: {
          doseG: 18, yieldG: 36, timeS: f.timeS, waterTempC: 93,
          grindSetting: { equipmentId: 'gr1', value: 24, unit: 'clicks' },
        },
        ...(f.defects
          ? { tasting: { rating: 2, defects: [...f.defects], characters: [], wouldRepeat: false } }
          : {}),
        targetTimeS: [26, 30],
      })
      const alle = [...d.suggestions, ...(d.run?.suggestion ? [d.run.suggestion] : [])]
      expect(alle.length, 'kein Befund — der Fall prüft nichts').toBeGreaterThan(0)
      for (const sg of alle) {
        // Nennt der Text eine Sekundenzahl als Erwartung, muss sie auch
        // als Zahl danebenstehen.
        const nenntZeit = /Erwartete Zeit danach|sollte sich Richtung \d/.test(sg.expectation)
        if (nenntZeit) {
          expect(sg.erwartung, `${sg.ruleId}: „${sg.expectation}"`).toBeDefined()
          expect(sg.erwartung!.groesse).toBe('zeit')
          expect(sg.erwartung!.wert).toBeGreaterThan(0)
        }
      }
    })
  }
})

// ── Die Vorliebe zählt so weit, wie sie trägt ─────────────────────────

describe('Gelernter Bias wird gewichtet, nicht geschaltet', () => {
  /**
   * Vorher stand hier eine Kante: unter zwölf guten Durchgängen gar kein
   * Bias, ab zwölf der volle. Seit 2.0 skaliert das Gewicht aus
   * `ueberzeugung.ts` — Anzahl, Einigkeit und Alter der Belege.
   */
  const mitVorliebe = (over: Partial<PreferenceModel>) =>
    ctx({
      learned: {
        ...EMPTY_LEARNED,
        preference: {
          espresso: {
            ratioBias: 0.4,
            tempBiasC: 0,
            grindBiasSteps: 0,
            confidence: 1,
            sampleSize: 12,
            streuungRatio: 0,
            alterTage: 0,
            gewicht: 0,
            ...over,
          } as PreferenceModel,
        },
      },
    })

  const ratio = (over: Partial<PreferenceModel>) =>
    startingPoint(mitVorliebe(over)).proposal.ratio

  it('viele einige Belege verschieben weiter als wenige', () => {
    const wenige = ratio({ sampleSize: 12, gewicht: 0.6 })
    const viele = ratio({ sampleSize: 40, gewicht: 0.83 })
    expect(viele).toBeGreaterThan(wenige)
  })

  it('uneinige Belege verschieben weniger als einige', () => {
    const einig = ratio({ sampleSize: 20, streuungRatio: 0, gewicht: 0.71 })
    const uneinig = ratio({ sampleSize: 20, streuungRatio: 1.5, gewicht: 0.28 })
    expect(einig).toBeGreaterThan(uneinig)
  })

  it('ohne Gewicht bleibt der Standard stehen', () => {
    expect(ratio({ gewicht: 0 })).toBe(startingPoint(ctx()).proposal.ratio)
  })

  it('unterhalb der Schwelle passiert weiterhin nichts', () => {
    // Zu dünne Datenlage, um überhaupt etwas zu behaupten.
    expect(ratio({ sampleSize: 3, gewicht: 0.27 })).toBe(startingPoint(ctx()).proposal.ratio)
  })
})
