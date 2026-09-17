/**
 * Die Überzeugung — wie stark eine gelernte Zahl gegen die Norm zählt.
 *
 * Geprüft wird nicht, ob die Formel „richtig" ist — sie ist eine
 * Modellentscheidung. Geprüft wird, dass sie die Eigenschaften hat, für
 * die sie gewählt wurde: stetig statt sprunghaft, und von jedem der drei
 * Faktoren einzeln entkräftbar.
 */
import { describe, it, expect } from 'vitest'
import { gewicht, kombiniere, stufe, streuung, BELEGE_HALB } from './ueberzeugung'

const u = (n: number, s = 0, alter = 0) => ({ n, streuung: s, alter })

describe('Gewicht', () => {
  it('ist null ohne Belege', () => {
    expect(gewicht(u(0))).toBe(0)
  })

  it('wächst stetig mit der Zahl der Belege', () => {
    const reihe = [1, 2, 4, 8, 16, 32].map((n) => gewicht(u(n)))
    for (let i = 1; i < reihe.length; i++) expect(reihe[i]!).toBeGreaterThan(reihe[i - 1]!)
  })

  it('erreicht bei der Halbwertszahl genau die Hälfte', () => {
    expect(gewicht(u(BELEGE_HALB))).toBeCloseTo(0.5, 2)
  })

  it('kommt der Eins nie ganz nahe — die Norm bleibt im Spiel', () => {
    expect(gewicht(u(1000))).toBeLessThan(1)
  })

  it('uneinige Belege zählen weniger als einige', () => {
    expect(gewicht(u(20, 0))).toBeGreaterThan(gewicht(u(20, 1)))
  })

  it('alte Belege zählen weniger als frische', () => {
    expect(gewicht(u(20, 0, 0))).toBeGreaterThan(gewicht(u(20, 0, 365)))
  })

  it('auch sehr alte Belege behalten einen Rest', () => {
    // Wer vor zwei Jahren zwanzigmal dasselbe bevorzugt hat, hat
    // vermutlich immer noch denselben Geschmack.
    expect(gewicht(u(20, 0, 900))).toBeGreaterThan(0.2)
  })
})

describe('Kombinieren', () => {
  it('bleibt bei der Norm, wenn nichts dahintersteht', () => {
    expect(kombiniere(2.0, 2.5, u(0))).toBe(2.0)
  })

  it('geht Richtung Erfahrung, je mehr dahintersteht', () => {
    const wenig = kombiniere(2.0, 2.5, u(2))
    const viel = kombiniere(2.0, 2.5, u(40))
    expect(wenig).toBeGreaterThan(2.0)
    expect(viel).toBeGreaterThan(wenig)
    expect(viel).toBeLessThan(2.5)
  })

  it('macht aus dem Sprung einen Übergang', () => {
    // Das war der eigentliche Fehler: Der zwölfte Durchgang verschob den
    // Startpunkt um einen Sprung, den kein einzelner Shot rechtfertigt.
    const bei11 = kombiniere(2.0, 2.5, u(11))
    const bei12 = kombiniere(2.0, 2.5, u(12))
    expect(Math.abs(bei12 - bei11)).toBeLessThan(0.02)
  })
})

describe('Stufe', () => {
  it('benennt das Gewicht in derselben Sprache wie die Diagnose', () => {
    expect(stufe(0.8)).toBe('sicher')
    expect(stufe(0.5)).toBe('wahrscheinlich')
    expect(stufe(0.1)).toBe('Versuch')
  })
})

describe('Streuung', () => {
  it('ist null bei Einigkeit', () => {
    expect(streuung([2, 2, 2])).toBe(0)
  })

  it('ist null bei einem einzigen Wert — nicht undefiniert', () => {
    expect(streuung([2])).toBe(0)
  })

  it('wächst mit der Uneinigkeit', () => {
    expect(streuung([1, 2, 3])).toBeGreaterThan(streuung([2, 2, 3]))
  })
})
