/**
 * Der Ertrag als eigener Befund.
 *
 * Aus echten Logdaten vom 24.09.2026: 18 g eingewogen, 41,4 g
 * vorgeschlagen, bei 27,9 g gestoppt — 1:1,55 statt 1:2,3. Sauer, zwei
 * Sterne, 30 Sekunden. Die App meldete „Zeit und Geschmack
 * widersprechen sich", sperrte ab und erwähnte mit keinem Wort, dass ein
 * Drittel des geplanten Ertrags fehlte.
 */
import { describe, it, expect } from 'vitest'
import { diagnose } from './diagnose'
import type { EngineContext } from '@/domain'
import { EMPTY_LEARNED, DEFAULT_SETTINGS } from '@/domain'

const ctx = (): EngineContext => ({
  bean: {
    id: 'b1',
    name: 'Transkei Gold',
    origins: [{ country: 'Blend' }],
    process: 'washed',
    roastLevel: 'medium',
    createdAt: '2026-09-15T00:00:00.000Z',
  },
  bag: {
    id: 'bag1',
    beanId: 'b1',
    roastDate: '2026-08-23',
    purchasedGrams: 250,
    remainingGrams: 232,
    depleted: false,
    createdAt: '2026-09-15T00:00:00.000Z',
  },
  method: 'espresso',
  settings: { ...DEFAULT_SETTINGS },
  learned: EMPTY_LEARNED,
  beanHistory: [],
  methodHistory: [],
  allBeans: [],
  today: new Date('2026-09-15T14:29:00.000Z'),
})

describe('D-09 — Ertrag weit neben dem Plan', () => {
  it('nennt den abgebrochenen Shot beim Namen statt am Mahlgrad zu drehen', () => {
    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 27.9, timeS: 30, waterTempC: 93 },
      tasting: { rating: 2, defects: ['sour'], characters: [], wouldRepeat: false },
      targetTimeS: [20, 26],
      plan: { yieldG: 41.4 },
    })
    expect(d.blocked).toBe(false)
    expect(d.headline).toBe('Der Shot war zu kurz')
    expect(d.summary).toContain('27,9 g')
    expect(d.summary).toContain('41,4 g')
    // Und in der Begründung, denn nur die zeigt die Ergebnisseite an,
    // sobald eine Empfehlung danebensteht.
    expect(d.suggestions[0]?.why).toContain('27,9 g')
    expect(d.suggestions[0]?.why).toContain('41,4 g')
    expect(d.suggestions[0]?.variable).toBe('yieldG')
    expect(d.suggestions[0]?.newValue).toBe(41.4)
  })

  it('meldet auch den zu weit gelaufenen Shot', () => {
    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 52, timeS: 30, waterTempC: 93 },
      tasting: { rating: 2, defects: ['thin'], characters: [], wouldRepeat: false },
      targetTimeS: [26, 32],
      plan: { yieldG: 36 },
    })
    expect(d.headline).toBe('Der Shot lief zu weit')
    expect(d.suggestions[0]?.direction).toBe('decrease')
  })

  it('schweigt, wenn der Ertrag passt', () => {
    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 39, timeS: 26, waterTempC: 93 },
      tasting: { rating: 2, defects: ['sour'], characters: [], wouldRepeat: false },
      targetTimeS: [23, 29],
      plan: { yieldG: 40 },
    })
    expect(d.headline).not.toContain('zu kurz')
  })

  it('schweigt, wenn der kurze Shot gar nicht sauer schmeckt', () => {
    // Wer bewusst Ristretto zieht und zufrieden ist, bekommt keine
    // Korrektur — die Abweichung allein ist kein Fehler.
    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 24, timeS: 26, waterTempC: 93 },
      tasting: { rating: 5, defects: [], characters: ['balanced'], wouldRepeat: true },
      targetTimeS: [23, 29],
      plan: { yieldG: 40 },
    })
    expect(d.headline).not.toContain('zu kurz')
  })

  it('kommt ohne Plan aus', () => {
    const d = diagnose({
      ctx: ctx(),
      actual: { doseG: 18, yieldG: 27.9, timeS: 30, waterTempC: 93 },
      tasting: { rating: 2, defects: ['sour'], characters: [], wouldRepeat: false },
      targetTimeS: [20, 26],
    })
    expect(d.headline).not.toContain('zu kurz')
  })
})
