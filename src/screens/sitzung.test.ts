/**
 * Der Durchgang als Automat.
 *
 * Geprüft wird nicht die Oberfläche, sondern die Regel dahinter: dass
 * jeder Zustand einen Weg zurück hat, dass keiner in eine Sackgasse
 * führt, und dass „zurück" niemals Eingaben verwirft.
 */
import { describe, it, expect } from 'vitest'
import { ZURUECK, WEITER, erlaubt, VERWIRFT_BEIM_ZURUECK, type Phase } from './sitzung'

const ALLE: Phase[] = ['proposal', 'laeuft', 'record', 'check', 'taste', 'result']

describe('Der Weg nach vorn', () => {
  it('führt von jedem Zustand aus weiter — außer vom letzten', () => {
    for (const p of ALLE) {
      if (p === 'result') expect(WEITER[p]).toBeNull()
      else expect(WEITER[p], `${p} führt nirgendwohin`).toBeTruthy()
    }
  })

  it('erreicht das Ergebnis in fünf Schritten', () => {
    let p: Phase = 'proposal'
    let schritte = 0
    while (WEITER[p]) {
      p = WEITER[p]!
      schritte++
      expect(schritte, 'Schleife im Automaten').toBeLessThan(10)
    }
    expect(p).toBe('result')
    expect(schritte).toBe(5)
  })
})

describe('Der Weg zurück', () => {
  it('existiert aus jedem Zustand', () => {
    // Ein Bildschirm ohne Weg zurück ist eine Sackgasse.
    for (const p of ALLE) expect(ZURUECK[p], `${p} hat kein Zurück`).toBeTruthy()
  })

  it('verlässt den Durchgang nur vom Startpunkt aus', () => {
    expect(ZURUECK.proposal).toBe('verlassen')
    for (const p of ALLE.filter((x) => x !== 'proposal')) {
      expect(ZURUECK[p], `${p} sollte nicht direkt hinausführen`).not.toBe('verlassen')
    }
  })

  it('führt aus dem Ergebnis nicht in die Erfassung zurück', () => {
    // Der Brew ist protokolliert. Ihn nachträglich zu ändern wäre eine
    // andere Handlung als „zurück".
    expect(ZURUECK.result).toBe('neu')
  })

  it('verwirft nie Eingaben', () => {
    // Vorher rief der Zurück-Pfeil im Auswertungsschritt `reset()`: Wer
    // zurücktippte, um eine Sekunde zu korrigieren, verlor Zeit, Fluss
    // und Bewertung.
    expect(VERWIRFT_BEIM_ZURUECK).toBe(false)
  })
})

describe('Erlaubte Sprünge', () => {
  it('vorwärts und rückwärts gehen', () => {
    expect(erlaubt('record', 'check')).toBe(true)
    expect(erlaubt('check', 'record')).toBe(true)
  })

  it('Übernehmen führt vom Ergebnis an den Startpunkt', () => {
    expect(erlaubt('result', 'proposal')).toBe(true)
  })

  it('Abbrechen führt aus dem laufenden Durchgang zurück', () => {
    expect(erlaubt('laeuft', 'proposal')).toBe(true)
  })

  it('kein Sprung über Stufen hinweg', () => {
    // Vom Startpunkt direkt ins Verkosten hieße, einen Shot zu bewerten,
    // den es nicht gab.
    expect(erlaubt('proposal', 'taste')).toBe(false)
    expect(erlaubt('proposal', 'result')).toBe(false)
    expect(erlaubt('result', 'record')).toBe(false)
  })
})
