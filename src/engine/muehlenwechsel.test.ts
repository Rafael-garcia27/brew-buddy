/**
 * Was passiert, wenn die Mühle wechselt.
 *
 * Aus echten Logdaten vom 24.09.2026: Der Nutzer mahlte Espresso bis zum
 * 8.9. mit der Mylo SG2 (Skala 0–100, Werte um 24) und danach mit der
 * Sage Barista Express (Skala 0–18, Werte um 6). Die Engine hat die
 * Referenz einer ähnlichen Bohne unverändert übernommen und vier
 * Sitzungen lang „Mahlgrad 26,5" an einer Maschine vorgeschlagen, deren
 * Rädchen bei 18 endet.
 */
import { describe, it, expect } from 'vitest'
import { uebertrageSetting } from './grinder'
import { startingPoint } from './starting'
import type { Grinder, Bean, Brew, EngineContext } from '@/domain'
import { EMPTY_LEARNED, DEFAULT_SETTINGS } from '@/domain'

const mylo: Grinder = {
  id: 'mylo',
  name: 'Mylo SG2',
  burrType: 'conical',
  scaleType: 'stepped',
  clicksPerNumber: 10,
  micronPerStep: 12.5,
  zeroPointOffsetMicron: 0,
  usableRange: [0, 100],
  confidence: 'measured',
}

const sage: Grinder = {
  id: 'sage',
  name: 'Sage Barista Express',
  burrType: 'conical',
  scaleType: 'stepless',
  micronPerStep: 40,
  zeroPointOffsetMicron: 40,
  usableRange: [0, 18],
  step: 0.5,
  confidence: 'estimated',
}

describe('Skalen umrechnen', () => {
  it('rechnet über Mikrometer, nicht über die Zahl', () => {
    // 24 Klicks Mylo = 0 + 24 × 12,5 = 300 µm.
    // An der Sage: (300 − 40) / 40 = 6,5.
    expect(uebertrageSetting(24, mylo, sage)).toBe(6.5)
  })

  it('rechnet auch zurück', () => {
    // 6,5 Sage = 40 + 6,5 × 40 = 300 µm → 24 Klicks Mylo.
    expect(uebertrageSetting(6.5, sage, mylo)).toBe(24)
  })

  it('lässt dieselbe Mühle in Ruhe', () => {
    expect(uebertrageSetting(24, mylo, mylo)).toBe(24)
  })

  it('schweigt, wenn der Wert außerhalb des Verstellwegs läge', () => {
    // 90 Klicks Mylo = 1125 µm. An der Sage wären das 27 — die Skala
    // endet bei 18. Keine Zahl ist besser als eine unerreichbare.
    expect(uebertrageSetting(90, mylo, sage)).toBeUndefined()
  })

  it('schweigt, wenn die Herkunftsmühle unbekannt ist', () => {
    expect(uebertrageSetting(24, undefined, sage)).toBeUndefined()
  })
})

// ── Der Fall aus den Logdaten ─────────────────────────────────────────

const bean = (id: string, name: string): Bean => ({
  id,
  name,
  origins: [{ country: 'Blend' }],
  process: 'washed',
  roastLevel: 'medium',
  createdAt: '2026-09-01T00:00:00.000Z',
})

const referenz: Brew = {
  id: 'w1',
  beanId: 'alt',
  bagId: 'bag-alt',
  method: 'espresso',
  actual: {
    doseG: 18,
    yieldG: 40,
    timeS: 26,
    waterTempC: 93,
    grindSetting: { equipmentId: 'mylo', value: 24, unit: 'clicks' },
  },
  observations: {},
  tasting: { rating: 4, defects: [], characters: [], wouldRepeat: true },
  isBest: false,
  createdAt: '2026-09-08T00:00:00.000Z',
}

function ctx(grinder: Grinder): EngineContext {
  return {
    bean: bean('neu', 'Winter Blend'),
    bag: {
      id: 'bag-neu',
      beanId: 'neu',
      roastDate: '2026-08-25',
      purchasedGrams: 250,
      remainingGrams: 200,
      depleted: false,
      createdAt: '2026-09-09T00:00:00.000Z',
    },
    method: 'espresso',
    grinder,
    grinders: [mylo, sage],
    settings: { ...DEFAULT_SETTINGS },
    learned: EMPTY_LEARNED,
    beanHistory: [],
    methodHistory: [referenz],
    allBeans: [bean('neu', 'Winter Blend'), bean('alt', 'Sunday Roast')],
    today: new Date('2026-09-11T07:00:00.000Z'),
  }
}

describe('Übertrag von einer ähnlichen Bohne', () => {
  it('schlägt an der Sage keinen Mylo-Wert mehr vor', () => {
    const sp = startingPoint(ctx(sage))
    expect(sp.source).toBe('transfer')
    // Vorher stand hier 24 bzw. 26,5 — auf einer Skala bis 18.
    const g = sp.proposal.grindSetting
    expect(g).toBeDefined()
    expect(g!).toBeLessThanOrEqual(sage.usableRange![1])
    expect(g!).toBeGreaterThanOrEqual(sage.usableRange![0])
  })

  it('lässt den Wert stehen, solange die Mühle dieselbe ist', () => {
    const sp = startingPoint(ctx(mylo))
    expect(sp.proposal.grindSetting).toBeGreaterThan(18)
  })
})
