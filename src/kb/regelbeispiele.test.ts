/**
 * Jede Regel bringt ihr Beispiel mit.
 *
 * Die 57 Diagnoseregeln liegen als Daten in `data/diagnostics.json`,
 * ihre Tests standen daneben im Code. Zwei Orte, die mit der Zeit
 * auseinanderlaufen: Wer eine Regel ändert, ändert die Datei — und
 * merkt erst beim nächsten Testlauf, ob irgendwo ein Fall dazu stand.
 *
 * Hier steht der Mechanismus dafür, dass beides zusammenbleibt. Eine
 * Regel, die ein Feld `beispiel` trägt, wird damit automatisch geprüft:
 * Die Eingaben gehen durch `diagnose()`, und die Regel muss feuern.
 *
 * ## Warum nicht alle 57 auf einmal
 *
 * Ein Beispiel je Regel wären 57 durchgerechnete Fälle. Sie zu erfinden
 * wäre das Gegenteil dessen, wofür die Wissensbasis da ist — die Zahlen
 * müssten aus `kb/` kommen oder gemessen sein. Der Mechanismus steht
 * deshalb hier mit den Fällen, die sich aus dem vorhandenen Wissen
 * belegen lassen; die übrigen kommen dazu, wenn ihre Regel das nächste
 * Mal angefasst wird.
 *
 * Neue Regel? Ein `beispiel` dazu, und sie ist geprüft.
 */
import { describe, it, expect } from 'vitest'
import type { Bean, Bag, Grinder, BrewMethod, Defect } from '@domain'
import type { EngineContext } from '@/domain'
import { DEFAULT_SETTINGS, EMPTY_LEARNED } from '@/domain'
import { diagnose } from '@/engine/diagnose'
import { RULES } from './index'

/** Was ein Beispiel an einer Regel beschreibt. */
interface Regelbeispiel {
  /** Ein Satz: worum es geht. */
  fall: string
  method: BrewMethod
  timeS: number
  doseG?: number
  yieldG?: number
  defects?: Defect[]
  rating?: 1 | 2 | 3 | 4 | 5
  targetTimeS?: [number, number]
}

const HEUTE = new Date('2026-09-18T08:00:00.000Z')

const bean = (): Bean => ({
  id: 'b1',
  name: 'Beispielbohne',
  origins: [{ country: 'Brasilien' }],
  process: 'washed',
  roastLevel: 'medium',
  createdAt: '2026-08-20T00:00:00.000Z',
})

const bag = (): Bag => ({
  id: 't1',
  beanId: 'b1',
  roastDate: '2026-09-04',
  remainingGrams: 500,
  depleted: false,
  createdAt: '2026-09-04T00:00:00.000Z',
})

const grinder: Grinder = {
  id: 'g1',
  name: 'Beispielmühle',
  burrType: 'conical',
  scaleType: 'stepped',
  micronPerStep: 12.5,
  zeroPointOffsetMicron: 0,
  usableRange: [0, 100],
  confidence: 'measured',
}

function laufe(b: Regelbeispiel) {
  const ctx: EngineContext = {
    bean: bean(),
    bag: bag(),
    method: b.method,
    grinder,
    settings: { ...DEFAULT_SETTINGS },
    learned: { ...EMPTY_LEARNED },
    beanHistory: [],
    methodHistory: [],
    allBeans: [bean()],
    today: HEUTE,
  }
  return diagnose({
    ctx,
    actual: {
      doseG: b.doseG ?? 18,
      yieldG: b.yieldG ?? 36,
      timeS: b.timeS,
      waterTempC: 93,
      grindSetting: { equipmentId: 'g1', value: 24, unit: 'clicks' },
    },
    ...(b.defects
      ? {
          tasting: {
            rating: b.rating ?? 2,
            defects: [...b.defects],
            characters: [],
            wouldRepeat: false,
          },
        }
      : {}),
    ...(b.targetTimeS ? { targetTimeS: b.targetTimeS } : {}),
  })
}

/** Die Beispiele, die an den Regeln hängen. */
const MIT_BEISPIEL = RULES.filter(
  (r): r is typeof r & { beispiel: Regelbeispiel } =>
    (r as { beispiel?: unknown }).beispiel !== undefined,
)

describe('Regeln mit hinterlegtem Beispiel', () => {
  it('der Mechanismus findet sie', () => {
    // Schlägt an, wenn `beispiel` aus der Datei verschwindet oder
    // umbenannt wird — sonst liefe dieser Test leer durch und niemand
    // merkte es.
    expect(MIT_BEISPIEL.length, 'keine Regel trägt ein Beispiel').toBeGreaterThan(0)
  })

  for (const regel of MIT_BEISPIEL) {
    it(`${regel.id}: ${regel.beispiel.fall}`, () => {
      const d = laufe(regel.beispiel)
      const gefeuert = [
        ...d.suggestions.map((s) => s.ruleId),
        ...(d.run?.suggestion ? [d.run.suggestion.ruleId] : []),
      ]
      expect(
        gefeuert,
        `${regel.id} feuerte nicht — stattdessen: ${gefeuert.join(', ') || 'nichts'}`,
      ).toContain(regel.id)
    })
  }
})
