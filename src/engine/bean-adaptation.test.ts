/**
 * Aufgabe 1 + 2: Phasenmodell der AeroPress und bohnenabhängige Rezepte.
 *
 * Der Kern von Aufgabe 2 ist nicht „irgendetwas ändert sich", sondern:
 * dasselbe Bohnenmerkmal muss je Brühmethode UNTERSCHIEDLICH wirken.
 * Genau das prüfen die Tests hier.
 */
import { describe, it, expect } from 'vitest'
import type { Bean, Bag, Brew, Grinder, Defect } from '@domain'
import type { EngineContext } from '@/domain'
import { DEFAULT_SETTINGS, EMPTY_LEARNED } from '@/domain'
import { startingPoint } from './starting'
import { diagnose } from './diagnose'
import { targetTimeRange, aeropressPhases } from '@/kb'
import { bestMethodFor } from './suitability'
import { assessFreshness } from './freshness'

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
  id: 'g1', beanId: 'b1', roastDate: daysAgo(12), depleted: false, createdAt: daysAgo(12), ...over,
})
const grinder: Grinder = {
  id: 'gr1', name: 'Test', burrType: 'conical', scaleType: 'stepped',
  micronPerStep: 12.5, zeroPointOffsetMicron: 0, confidence: 'vendor',
}
const ctx = (over: Partial<EngineContext> = {}): EngineContext => ({
  bean: bean(), bag: bag(), method: 'espresso', grinder,
  settings: { ...DEFAULT_SETTINGS }, learned: { ...EMPTY_LEARNED },
  beanHistory: [], methodHistory: [], allBeans: [bean()], today: TODAY, ...over,
})

// ══ Aufgabe 1: AeroPress-Phasen ═════════════════════════════════════

describe('AeroPress: Phasenmodell', () => {
  it('liefert überhaupt eine Zielzeit (vorher null → Animation fiel auf 30 s)', () => {
    const t = targetTimeRange('aeropress', 16, 'medium')
    expect(t).not.toBeNull()
    expect(t![0]).toBeGreaterThan(90)
  })

  it('„Pressen" beginnt erst nach der Ziehzeit, nicht nach 24 s', () => {
    const ph = aeropressPhases(90)
    expect(ph.steepEnd).toBe(90)
    // Der ursprüngliche Fehler: bei Sekunde 24 stand „Pressen" auf dem Schirm.
    expect(24).toBeLessThan(ph.transferEnd)
    expect(ph.total).toBeGreaterThan(ph.transferEnd)
  })

  it('Phasen sind lückenlos und aufsteigend', () => {
    for (const steep of [45, 75, 90, 105, 120]) {
      const ph = aeropressPhases(steep)
      expect(ph.bloomEnd).toBeGreaterThan(0)
      expect(ph.bloomEnd).toBeLessThan(ph.steepEnd)
      expect(ph.steepEnd).toBeLessThan(ph.transferEnd)
      expect(ph.transferEnd).toBeLessThan(ph.total)
    }
  })

  it('Bloom ist gedeckelt — auch eine 4-Minuten-Ziehzeit rührt nicht 96 s', () => {
    expect(aeropressPhases(240).bloomEnd).toBeLessThanOrEqual(35)
  })

  it('Ziehzeiten der Röstgrade liegen im Bereich gängiger Rezepte (45–150 s)', () => {
    for (const roast of ['light', 'medium', 'dark'] as const) {
      const p = startingPoint(ctx({ method: 'aeropress', bean: bean({ roastLevel: roast }) })).proposal
      expect(p.steepS).toBeGreaterThanOrEqual(45)
      expect(p.steepS).toBeLessThanOrEqual(150)
    }
  })

  it('Zielzeit folgt der bohnenspezifischen Ziehzeit', () => {
    const kurz = targetTimeRange('aeropress', 16, 'medium', undefined, 60)
    const lang = targetTimeRange('aeropress', 16, 'medium', undefined, 120)
    expect(lang![0] - kurz![0]).toBe(60)
  })

  it('lange Gesamtzeit erzeugt KEINE Mahlgradkorrektur (Zeit ist gewählt, nicht Ergebnis)', () => {
    const c = ctx({ method: 'aeropress' })
    const p = startingPoint(c).proposal
    const d = diagnose({
      ctx: c,
      actual: {
        doseG: p.doseG, waterG: p.waterG, timeS: (p.targetTimeS?.[1] ?? 120) + 60,
        waterTempC: p.waterTempC, grindSetting: { equipmentId: 'gr1', value: 45, unit: 'clicks' },
      },
    })
    expect(JSON.stringify(d)).not.toMatch(/Mahlgrad.*(feiner|gröber)/i)
  })
})

// ══ Aufgabe 2: Bohne wirkt je Methode anders ════════════════════════

describe('Bohnenmerkmale wirken methodenspezifisch', () => {
  const hochland = bean({ altitudeMasl: [2000, 2200], roastLevel: 'light' })

  it('Espresso reagiert stärker im Mahlgrad als die AeroPress', () => {
    const flach = bean({ altitudeMasl: [900, 1100], roastLevel: 'light' })
    const dE = startingPoint(ctx({ method: 'espresso', bean: hochland })).proposal.grindSetting!
      - startingPoint(ctx({ method: 'espresso', bean: flach })).proposal.grindSetting!
    const dA = startingPoint(ctx({ method: 'aeropress', bean: hochland })).proposal.grindSetting!
      - startingPoint(ctx({ method: 'aeropress', bean: flach })).proposal.grindSetting!
    expect(Math.abs(dE)).toBeGreaterThan(Math.abs(dA))
  })

  it('AeroPress leitet die Höhenlage stattdessen in die Ziehzeit', () => {
    const flach = bean({ altitudeMasl: [900, 1100], roastLevel: 'light' })
    const hoch = startingPoint(ctx({ method: 'aeropress', bean: hochland })).proposal
    const tief = startingPoint(ctx({ method: 'aeropress', bean: flach })).proposal
    expect(hoch.steepS!).toBeGreaterThan(tief.steepS!)
  })

  it('Höhe wirkt stetig — 1799 m und 1801 m springen nicht auseinander', () => {
    const a = startingPoint(ctx({ bean: bean({ altitudeMasl: [1799, 1799] }) })).proposal
    const b = startingPoint(ctx({ bean: bean({ altitudeMasl: [1801, 1801] }) })).proposal
    expect(Math.abs(a.grindSetting! - b.grindSetting!)).toBeLessThanOrEqual(1)
  })

  it('ohne Höhenangabe zieht die App die Herkunft heran', () => {
    const aeth = startingPoint(ctx({ bean: bean({ origins: [{ country: 'Äthiopien' }] }) }))
    const bras = startingPoint(ctx({ bean: bean({ origins: [{ country: 'Brasilien' }] }) }))
    expect(aeth.proposal.grindSetting!).toBeLessThan(bras.proposal.grindSetting!)
    expect(aeth.rationale.some((r) => /Herkunftstypisch/.test(r.text))).toBe(true)
  })

  it('anaerobe Aufbereitung verkürzt die Ziehzeit der AeroPress', () => {
    const an = startingPoint(ctx({ method: 'aeropress', bean: bean({ process: 'anaerobic' }) })).proposal
    const wa = startingPoint(ctx({ method: 'aeropress', bean: bean({ process: 'washed' }) })).proposal
    expect(an.steepS!).toBeLessThan(wa.steepS!)
  })

  it('Röstgrad verschiebt die V60-Zielzeit — hell länger, dunkel kürzer', () => {
    const hell = targetTimeRange('v60', 15, 'light')!
    const dunkel = targetTimeRange('v60', 15, 'dark')!
    expect(hell[0]).toBeGreaterThan(dunkel[0])
  })

  it('jede Methode gibt für dieselbe Bohne eine eigene Zielzeit aus', () => {
    const b = bean({ roastLevel: 'light', altitudeMasl: [1900, 2100] })
    const zeiten = (['espresso', 'v60', 'aeropress'] as const).map(
      (m) => startingPoint(ctx({ method: m, bean: b })).proposal.targetTimeS,
    )
    expect(zeiten.every((t) => t !== undefined)).toBe(true)
    expect(new Set(zeiten.map((t) => t![0])).size).toBe(3)
  })

  it('Vorschläge bleiben in physikalisch sinnvollen Grenzen', () => {
    for (const m of ['espresso', 'v60', 'aeropress'] as const) {
      for (const roast of ['light', 'medium', 'dark'] as const) {
        for (const proc of ['washed', 'natural', 'anaerobic'] as const) {
          const p = startingPoint(ctx({ method: m, bean: bean({ roastLevel: roast, process: proc, altitudeMasl: [2100, 2300] }) })).proposal
          expect(p.waterTempC).toBeGreaterThanOrEqual(85)
          expect(p.waterTempC).toBeLessThanOrEqual(100)
          expect(p.grindSetting!).toBeGreaterThan(0)
          expect(p.ratio).toBeGreaterThan(1)
        }
      }
    }
  })
})

// ══ Prüfung: Methodenempfehlung und Frische ═════════════════════════

describe('Methodenempfehlung folgt der Bohne, nicht der Fehlertoleranz', () => {
  const mit = (over: Partial<Bean>) => bestMethodFor(bean(over)).method

  it('brasilianische Natural ist eine Espressobohne', () => {
    // Vorher gewann hier die AeroPress, weil sie am fehlerverzeihendsten
    // ist — nicht, weil die Bohne dort besser schmeckt.
    expect(mit({ origins: [{ country: 'Brasilien' }], process: 'natural' })).toBe('espresso')
    expect(mit({ origins: [{ country: 'Brasilien' }], process: 'natural', roastLevel: 'dark' })).toBe('espresso')
  })

  it('helle ostafrikanische Washed gehört in den Handfilter', () => {
    for (const land of ['Äthiopien', 'Kenia']) {
      expect(mit({ origins: [{ country: land }], process: 'washed', roastLevel: 'light' })).toBe('v60')
    }
  })

  it('empfiehlt nie eine Methode, in der die Bohne als schwierig gilt', () => {
    for (const land of ['Brasilien', 'Äthiopien', 'Kenia', 'Indien', 'Kolumbien']) {
      for (const roast of ['light', 'medium', 'dark'] as const) {
        const b = bean({ origins: [{ country: land }], roastLevel: roast })
        expect(bestMethodFor(b).suitability.score).toBeGreaterThanOrEqual(2.5)
      }
    }
  })
})

describe('Eingefrorene Tüte hält die Frische-Uhr an', () => {
  const bag2 = (over: Partial<Bag>): Bag => ({
    id: 'g2', beanId: 'b1', depleted: false, createdAt: daysAgo(100), ...over,
  })

  it('zählt bis zum Einfrieren, nicht bis heute', () => {
    const eingefroren = bag2({ roastDate: daysAgo(120), storage: 'frozen', frozenAt: daysAgo(100) })
    const offen = bag2({ roastDate: daysAgo(120) })
    const f1 = assessFreshness(eingefroren, 'espresso', 'medium', false, TODAY)
    const f2 = assessFreshness(offen, 'espresso', 'medium', false, TODAY)
    expect(f1.days).toBe(20)
    expect(f2.days).toBe(120)
    expect(f1.state).not.toBe('stale')
  })

  it('ohne Einfrierdatum gilt der Tag, an dem die Tüte angelegt wurde', () => {
    // Sonst liefe die Uhr weiter — genau der Fehler, der eine im Mai
    // eingefrorene Bohne im August als überaltert auswies.
    const b = bag2({ roastDate: daysAgo(120), storage: 'frozen', createdAt: daysAgo(90) })
    expect(assessFreshness(b, 'espresso', 'medium', false, TODAY).days).toBe(30)
  })
})

describe('Ein fehlerhafter Brew wird nicht zum Startpunkt', () => {
  const mitHistorie = (hist: Brew[]) => startingPoint(ctx({ beanHistory: hist }))
  const b = (rating: 1 | 2 | 3 | 4 | 5, defects: Defect[], grind: number, id: string): Brew => ({
    id, bagId: 'g1', beanId: 'b1', method: 'espresso',
    actual: { doseG: 18, yieldG: 36, timeS: 26, grindSetting: { equipmentId: 'gr1', value: grind, unit: 'clicks' } },
    tasting: { rating, defects, characters: [], wouldRepeat: rating >= 4 },
    isBest: false, createdAt: daysAgo(2),
  })

  it('zwei saure 2★-Versuche führen zurück zum Standard, nicht zur Wiederholung', () => {
    // Ein Durchgang, den die App selbst als unterextrahiert erkannt hat,
    // ist keine bessere Ausgangslage als die Wissensbasis.
    const sp = mitHistorie([b(2, ['sour'], 30, 'x'), b(2, ['sour'], 31, 'y')])
    expect(sp.source).toBe('default')
  })

  it('ein fehlerfreier 2★-Versuch darf dagegen weiterhin dienen', () => {
    const sp = mitHistorie([b(2, [], 24, 'x'), b(2, [], 25, 'y')])
    expect(sp.source).toBe('own-attempt')
  })

  it('ab 3★ zählt der Versuch auch mit Notiz zum Geschmack', () => {
    const sp = mitHistorie([b(3, ['sour'], 22, 'x'), b(2, ['sour'], 26, 'y')])
    expect(sp.source).toBe('own-attempt')
    expect(sp.proposal.grindSetting).toBe(22)
  })
})

describe('Ein abgebrochener Brew wird nicht ausgewertet', () => {
  const lauf = (method: 'espresso' | 'v60', timeS: number) => {
    const c = ctx({ method })
    const p = startingPoint(c).proposal
    return diagnose({
      ctx: c,
      actual: {
        doseG: p.doseG, waterG: p.waterG, yieldG: p.yieldG, timeS, waterTempC: p.waterTempC,
        grindSetting: { equipmentId: 'gr1', value: p.grindSetting ?? 24, unit: 'clicks' },
      },
      tasting: { rating: 2, defects: ['sour'], characters: [], wouldRepeat: false },
    })
  }

  it('2 Sekunden am V60 sind kein Extraktionsfehler, sondern ein Abbruch', () => {
    const d = lauf('v60', 2)
    expect(d.headline).toBe('Das war kein vollständiger Brew')
    // Keine Mahlgradempfehlung — schon gar keine mit hoher Konfidenz.
    expect(d.suggestions).toHaveLength(0)
  })

  it('ein echter Gusher wird dagegen ausgewertet', () => {
    const d = lauf('espresso', 14)
    expect(d.headline).not.toBe('Das war kein vollständiger Brew')
    expect(d.suggestions.length).toBeGreaterThan(0)
  })

  it('spricht am Handfilter nicht von einem Shot', () => {
    const d = lauf('v60', 100)
    expect(JSON.stringify(d)).not.toMatch(/Shot/)
  })
})

describe('Die Frische in zwei Längen', () => {
  // Seit die Bohne im Regal ihre Tage im Ring trägt, stand daneben
  // „15 Tage — im Fenster". Zweimal dieselbe Zahl in einer Zeile liest
  // sich wie zwei verschiedene Angaben.
  const proben = [3, 8, 14, 25, 40, 120]

  it('ist die lange Form die kurze mit der Zahl davor', () => {
    for (const d of proben) {
      const f = assessFreshness(
        { id: 'b', beanId: 'x', roastDate: daysAgo(d), depleted: false, createdAt: daysAgo(d) },
        'v60',
        'medium',
        false,
        TODAY,
      )
      expect(f.label.endsWith(f.short)).toBe(true)
      expect(f.short).not.toMatch(/\d/)
    }
  })

  it('nennt das Gefrierfach in beiden Formen', () => {
    const f = assessFreshness(
      {
        id: 'b',
        beanId: 'x',
        roastDate: daysAgo(30),
        storage: 'frozen',
        depleted: false,
        createdAt: daysAgo(30),
      },
      'v60',
      'medium',
      false,
      TODAY,
    )
    expect(f.short).toMatch(/eingefroren/)
    expect(f.label).toMatch(/eingefroren/)
  })

  it('hat auch ohne Röstdatum eine kurze Form', () => {
    const f = assessFreshness(
      { id: 'b', beanId: 'x', depleted: false, createdAt: daysAgo(1) },
      'v60',
      'medium',
      false,
      TODAY,
    )
    expect(f.short.length).toBeGreaterThan(0)
  })
})
