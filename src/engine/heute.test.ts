/**
 * „Was brühe ich jetzt?" — vorweg beantwortet.
 *
 * Geprüft wird die Eigenschaft, auf die es ankommt: Der Vorschlag darf
 * nicht jeden Morgen wechseln, nur weil eine andere Tüte gerade einen
 * Punkt besser dasteht. Wer eine Bohne eingemessen hat, will sie zu Ende
 * brühen.
 */
import { describe, it, expect } from 'vitest'
import type { Bean, Bag, Brew } from '@domain'
import { DEFAULT_SETTINGS } from '@/domain'
import { heuteVorschlag, methodeZurStunde, STUNDEN_BELEGE } from './heute'

const HEUTE = new Date('2026-09-18T07:30:00.000Z')
const vorTagen = (n: number) => new Date(HEUTE.getTime() - n * 86_400_000).toISOString()

const bohne = (id: string, name = id): Bean => ({
  id,
  name,
  origins: [{ country: 'Brasilien' }],
  process: 'natural',
  roastLevel: 'medium',
  createdAt: vorTagen(40),
})

const tuete = (id: string, beanId: string, tage: number, rest = 500): Bag => ({
  id,
  beanId,
  roastDate: vorTagen(tage).slice(0, 10),
  remainingGrams: rest,
  depleted: false,
  createdAt: vorTagen(tage),
})

const brew = (method: Brew['method'], stunde: number, tage = 1): Brew => {
  const d = new Date(HEUTE.getTime() - tage * 86_400_000)
  d.setHours(stunde, 0, 0, 0)
  return {
    id: `w${Math.random()}`,
    beanId: 'b1',
    bagId: 't1',
    method,
    actual: { doseG: 18, yieldG: 36, timeS: 27 },
    isBest: false,
    createdAt: d.toISOString(),
  }
}

const lage = (over: Partial<Parameters<typeof heuteVorschlag>[0]> = {}) => ({
  beans: [bohne('b1', 'Hausmischung'), bohne('b2', 'Yirgacheffe')],
  bags: [tuete('t1', 'b1', 12), tuete('t2', 'b2', 14)],
  brews: [],
  settings: { ...DEFAULT_SETTINGS },
  today: HEUTE,
  ...over,
})

describe('Die Methode', () => {
  it('folgt der Uhrzeit, wenn sie belegt ist', () => {
    const stunde = HEUTE.getHours()
    const brews = Array.from({ length: STUNDEN_BELEGE }, (_, i) => brew('v60', stunde, i + 1))
    const v = heuteVorschlag(lage({ brews, settings: { ...DEFAULT_SETTINGS, lastMethod: 'espresso' } }))!
    expect(v.method).toBe('v60')
    expect(v.methodengrund).toContain('Zeit')
  })

  it('nimmt die zuletzt gebrühte, solange die Uhrzeit nichts hergibt', () => {
    // Zwei Belege sind Zufall, nicht Gewohnheit.
    const brews = [brew('v60', HEUTE.getHours(), 1), brew('v60', HEUTE.getHours(), 2)]
    const v = heuteVorschlag(lage({ brews, settings: { ...DEFAULT_SETTINGS, lastMethod: 'aeropress' } }))!
    expect(v.method).toBe('aeropress')
  })

  it('zählt Durchgänge zu ganz anderer Zeit nicht mit', () => {
    const brews = Array.from({ length: 6 }, (_, i) => brew('frenchpress', (HEUTE.getHours() + 8) % 24, i + 1))
    const v = heuteVorschlag(lage({ brews, settings: { ...DEFAULT_SETTINGS, lastMethod: 'espresso' } }))!
    expect(v.method).toBe('espresso')
  })

  it('rechnet über Mitternacht hinweg', () => {
    // 23 Uhr und 1 Uhr sind zwei Stunden auseinander, nicht zweiundzwanzig.
    const brews = Array.from({ length: 4 }, (_, i) => brew('v60', 23, i + 1))
    expect(methodeZurStunde(brews, 1)).toBe('v60')
  })
})

describe('Die Bohne', () => {
  it('bleibt bei der zuletzt gebrühten, solange sie brühbereit ist', () => {
    // Sonst wechselte der Vorschlag jeden Morgen, weil eine andere Tüte
    // gerade einen Punkt besser dasteht.
    const v = heuteVorschlag(lage({ settings: { ...DEFAULT_SETTINGS, lastBeanId: 'b2' } }))!
    expect(v.bean.id).toBe('b2')
    expect(v.grund).toBe('zuletzt gebrüht')
  })

  it('wechselt, wenn die zuletzt gebrühte leer ist', () => {
    const v = heuteVorschlag(
      lage({
        bags: [tuete('t1', 'b1', 12), { ...tuete('t2', 'b2', 14), remainingGrams: 2 }],
        settings: { ...DEFAULT_SETTINGS, lastBeanId: 'b2' },
      }),
    )!
    expect(v.bean.id).toBe('b1')
  })

  it('nennt die übrigen, ohne die gewählte zu wiederholen', () => {
    const v = heuteVorschlag(lage())!
    expect(v.weitere.some((r) => r.bean.id === v.bean.id)).toBe(false)
  })

  it('sagt nichts, wenn es nichts zu sagen gibt', () => {
    expect(heuteVorschlag(lage({ beans: [], bags: [] }))).toBeNull()
  })
})
