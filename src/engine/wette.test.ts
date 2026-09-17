/**
 * Die Empfehlung als Wette.
 *
 * Geprüft wird hier nicht, ob die Engine gut rät — das tun die Tests in
 * `engine.test.ts`. Geprüft wird, ob die App für ihre Vorhersagen
 * geradesteht: dass sie nur wettet, wenn sie etwas behauptet; dass sie
 * nur einlöst, was jemand ausprobiert hat; und dass sie merkt, wenn
 * dreimal Drehen nichts gebracht hat.
 */
import { describe, it, expect } from 'vitest'
import type { Brew } from '@domain'
import type { Empfehlung } from '@/domain'
import type { Diagnosis } from './diagnose'
import { alsEmpfehlung, einloesen, trefferquote, imKreis, TOLERANZ_S } from './wette'

const AT = '2026-09-17T08:00:00.000Z'

const diagnose = (over: Partial<Diagnosis> = {}): Diagnosis => ({
  stage: 3,
  blocked: false,
  headline: 'Drei Klicks gröber',
  summary: '',
  suggestions: [
    {
      ruleId: 'D-14',
      what: '3 Klicks gröber',
      why: 'Der Shot lief 32 s statt 25 — das Bett ist zu dicht.',
      expectation: 'Erwartete Zeit danach: 28 s.',
      confidence: 'wahrscheinlich',
      variable: 'grindSetting',
      direction: 'increase',
      delta: 3,
      newValue: 10,
      erwartung: { groesse: 'zeit', wert: 28 },
    },
  ],
  ...over,
})

const einsatz = (over: Record<string, unknown> = {}) => ({
  diagnose: diagnose(),
  brewId: 'w1',
  beanId: 'b1',
  method: 'espresso' as const,
  istWert: 7,
  id: 'e1',
  at: AT,
  ...over,
})

const brew = (over: Partial<Brew> = {}): Brew => ({
  id: 'w2',
  beanId: 'b1',
  bagId: 't1',
  method: 'espresso',
  actual: { doseG: 18, yieldG: 36, timeS: 27 },
  isBest: false,
  createdAt: AT,
  ...over,
})

// ── Wetten ────────────────────────────────────────────────────────────

describe('Aus einer Diagnose wird eine Empfehlung', () => {
  it('trägt Regel, Eingriff und Vorhersage', () => {
    const e = alsEmpfehlung(einsatz())!
    expect(e.regelId).toBe('D-14')
    expect(e.eingriff).toMatchObject({ groesse: 'mahlgrad', von: 7, nach: 10, einheit: 'Klicks' })
    expect(e.vorhersage).toMatchObject({ groesse: 'zeit', erwartet: 28, toleranz: TOLERANZ_S })
    expect(e.zustand).toBe('offen')
  })

  it('friert die Begründung ein', () => {
    // Ändert sich die Regel später, darf die App nicht rückwirkend etwas
    // behaupten, das sie damals nicht gesagt hat.
    const e = alsEmpfehlung(einsatz())!
    expect(e.begruendung[0]).toContain('32 s statt 25')
  })

  it('wettet NICHT, wenn ein Tor gefeuert hat', () => {
    // Das ist Befund C3 aus dem Briefing: Wo die App sagt „das liegt
    // nicht an den Parametern", darf sie auch nicht darauf wetten.
    expect(alsEmpfehlung(einsatz({ diagnose: diagnose({ blocked: true }) }))).toBeNull()
  })

  it('wettet NICHT ohne Vorschlag', () => {
    expect(alsEmpfehlung(einsatz({ diagnose: diagnose({ suggestions: [] }) }))).toBeNull()
  })

  it('kommt ohne Zahl aus, wenn die Regel keine nennt', () => {
    // Technikhinweise haben keinen Eingriff und keine Vorhersage — sie
    // sind trotzdem festhaltenswert, nur eben nicht einlösbar.
    const d = diagnose()
    const e = alsEmpfehlung(
      einsatz({
        diagnose: {
          ...d,
          suggestions: [{ ...d.suggestions[0]!, variable: 'technique', newValue: undefined, erwartung: undefined }],
        },
      }),
    )!
    expect(e.eingriff).toBeUndefined()
    expect(e.vorhersage).toBeUndefined()
  })
})

// ── Einlösen ──────────────────────────────────────────────────────────

describe('Einlösen', () => {
  const uebernommen = (): Empfehlung => ({ ...alsEmpfehlung(einsatz())!, zustand: 'uebernommen' })

  it('trifft, wenn die Zeit im Toleranzband liegt', () => {
    const el = einloesen(uebernommen(), brew({ actual: { doseG: 18, yieldG: 36, timeS: 27 } }), AT)!
    expect(el.istWert).toBe(27)
    expect(el.abweichung).toBe(-1)
    expect(el.getroffen).toBe(true)
  })

  it('verfehlt, wenn sie daneben liegt', () => {
    const el = einloesen(uebernommen(), brew({ actual: { doseG: 18, yieldG: 36, timeS: 33 } }), AT)!
    expect(el.abweichung).toBe(5)
    expect(el.getroffen).toBe(false)
  })

  it('genau an der Grenze gilt als getroffen', () => {
    const el = einloesen(uebernommen(), brew({ actual: { doseG: 18, yieldG: 36, timeS: 30 } }), AT)!
    expect(el.getroffen).toBe(true)
  })

  it('löst NICHT ein, was nur gelesen und nicht angewendet wurde', () => {
    // Sonst stünde in der Bilanz, die App habe etwas vorhergesagt, das
    // niemand ausprobiert hat.
    expect(einloesen(alsEmpfehlung(einsatz())!, brew(), AT)).toBeNull()
  })

  it('löst NICHT an einer anderen Bohne ein', () => {
    expect(einloesen(uebernommen(), brew({ beanId: 'b2' }), AT)).toBeNull()
  })

  it('löst NICHT an einer anderen Methode ein', () => {
    expect(einloesen(uebernommen(), brew({ method: 'v60' }), AT)).toBeNull()
  })

  it('löst NICHT ein, wo nichts vorhergesagt wurde', () => {
    const ohne: Empfehlung = { ...uebernommen(), vorhersage: undefined }
    expect(einloesen(ohne, brew(), AT)).toBeNull()
  })
})

// ── Das Buch ──────────────────────────────────────────────────────────

const mit = (id: string, zustand: Empfehlung['zustand'], over: Partial<Empfehlung> = {}): Empfehlung => ({
  ...alsEmpfehlung(einsatz({ id }))!,
  zustand,
  ...over,
})

describe('Trefferquote', () => {
  it('zählt nur, was geprüft wurde', () => {
    const b = trefferquote([
      mit('1', 'eingeloest'),
      mit('2', 'eingeloest'),
      mit('3', 'verfehlt'),
      mit('4', 'offen'),
      mit('5', 'verworfen'),
    ])
    expect(b).toMatchObject({ gegeben: 5, eingeloest: 2, verfehlt: 1, quote: 0.67 })
  })

  it('sagt nichts, solange nichts geprüft ist', () => {
    // Eine Quote aus null Messungen wäre eine Zahl ohne Deckung.
    expect(trefferquote([mit('1', 'offen')]).quote).toBeNull()
  })
})

describe('Hör auf zu drehen', () => {
  const verfehlt = (id: string, at: string) => mit(id, 'verfehlt', { at })

  it('schlägt nach drei verfehlten Eingriffen an derselben Größe an', () => {
    const befund = imKreis(
      [
        verfehlt('1', '2026-09-14T08:00:00.000Z'),
        verfehlt('2', '2026-09-15T08:00:00.000Z'),
        verfehlt('3', '2026-09-16T08:00:00.000Z'),
      ],
      'b1',
      'espresso',
    )
    expect(befund).toMatchObject({ groesse: 'mahlgrad', anzahl: 3 })
  })

  it('schweigt bei zwei', () => {
    expect(
      imKreis([verfehlt('1', '2026-09-15T08:00:00.000Z'), verfehlt('2', '2026-09-16T08:00:00.000Z')], 'b1', 'espresso'),
    ).toBeNull()
  })

  it('zählt die laufende Serie, nicht die Summe', () => {
    // Ein Treffer dazwischen setzt zurück: Wer einmal richtig lag, dreht
    // nicht im Kreis.
    const befund = imKreis(
      [
        verfehlt('1', '2026-09-12T08:00:00.000Z'),
        verfehlt('2', '2026-09-13T08:00:00.000Z'),
        mit('3', 'eingeloest', { at: '2026-09-14T08:00:00.000Z' }),
        verfehlt('4', '2026-09-15T08:00:00.000Z'),
        verfehlt('5', '2026-09-16T08:00:00.000Z'),
      ],
      'b1',
      'espresso',
    )
    expect(befund).toBeNull()
  })

  it('zählt je Bohne und Methode getrennt', () => {
    const fremd = [
      verfehlt('1', '2026-09-14T08:00:00.000Z'),
      verfehlt('2', '2026-09-15T08:00:00.000Z'),
      verfehlt('3', '2026-09-16T08:00:00.000Z'),
    ].map((e) => ({ ...e, beanId: 'b2' }))
    expect(imKreis(fremd, 'b1', 'espresso')).toBeNull()
  })
})
