/**
 * Formatierung ist kein Kleinkram: „1 Tage — noch zu frisch" stand am
 * ersten Tag jeder neuen Bag, und „22 s–28 s" in Sätzen, während die
 * Oberfläche daneben „22–28 s" zeigte.
 */
import { describe, it, expect } from 'vitest'
import { de, fmtDauer, fmtSpanne, vorz, tage, tagen } from './text'

describe('Zahlen in deutscher Schreibweise', () => {
  it('nutzt das Komma', () => {
    expect(de(2.75, 2)).toBe('2,75')
    expect(de(2, 0)).toBe('2')
  })
})

describe('Dauer', () => {
  it('bleibt beim Espresso in Sekunden', () => {
    expect(fmtDauer(28)).toBe('28 s')
    expect(fmtDauer(59.4)).toBe('59 s')
  })

  it('wird ab einer Minute zur Uhr', () => {
    expect(fmtDauer(60)).toBe('1:00 min')
    expect(fmtDauer(165)).toBe('2:45 min')
  })
})

describe('Zeitspannen', () => {
  it('tragen die Einheit einmal, nicht an jeder Grenze', () => {
    expect(fmtSpanne([22, 28])).toBe('22–28 s')
    expect(fmtSpanne([150, 180])).toBe('2:30–3:00 min')
  })
})

describe('Vorzeichen', () => {
  it('nutzt das typografische Minus und lässt Null in Ruhe', () => {
    expect(vorz(6)).toBe('+6')
    expect(vorz(-6)).toBe('−6')
    expect(vorz(0)).toBe('0')
  })
})

describe('Tage', () => {
  it('beugt den Singular', () => {
    expect(tage(1)).toBe('1 Tag')
    expect(tage(14)).toBe('14 Tage')
    expect(tagen(1)).toBe('1 Tag')
    expect(tagen(3)).toBe('3 Tagen')
  })
})
