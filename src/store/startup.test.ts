/**
 * Der Start ist die gefährlichste Stelle der App.
 *
 * Hier wird entschieden, ob der gespeicherte Bestand behalten, ergänzt
 * oder überschrieben wird — und die App hat keinen Server, von dem sie
 * ihn zurückholen könnte. Was hier falsch entschieden wird, ist endgültig.
 *
 * Anlass für diese Datei ist Befund F-01 aus `docs/AUDIT.md`: Ein
 * fehlgeschlagener Lesevorgang war vom Erststart nicht zu unterscheiden.
 * Beide lieferten einen leeren Zustand, beide bekamen Vorgabemühlen,
 * beide wurden zurückgeschrieben — im zweiten Fall über echte Daten.
 */
import { describe, it, expect } from 'vitest'
import type { AppState, Bean } from '@/domain'
import { emptyState } from '@/domain'
import { SCHEMA_VERSION } from '@/config'
import type { LoadResult } from './persist'
import { startzustand } from './startup'

let n = 0
const id = () => `id-${++n}`

const bohne = (name: string): Bean => ({
  id: name,
  name,
  origins: [{ country: 'Kolumbien' }],
  process: 'washed',
  roastLevel: 'medium',
  createdAt: '2026-01-01T00:00:00.000Z',
})

/** Ein Bestand, wie ihn ein Nutzer nach ein paar Wochen hat. */
const bestand = (): AppState => ({
  ...emptyState(SCHEMA_VERSION),
  beans: [bohne('Hausmischung'), bohne('Yirgacheffe')],
  grinders: [
    {
      id: 'gr-eigen',
      name: 'Eigene Mühle',
      burrType: 'conical',
      scaleType: 'stepped',
      micronPerStep: 12.5,
      zeroPointOffsetMicron: 0,
      usableRange: [0, 100],
      confidence: 'measured',
    },
  ],
})

describe('Erststart', () => {
  const r: LoadResult = { kind: 'empty' }

  it('legt eine Mühle an, damit Empfehlungen in Klicks kommen', () => {
    const { state } = startzustand(r, id)
    expect(state.grinders.length).toBeGreaterThan(0)
    expect(state.settings.activeGrinderId).toBe(state.grinders[0]!.id)
  })

  it('schreibt das Ergebnis zurück', () => {
    // Sonst bekäme man bei jedem Start neue Mühlen mit neuen Kennungen.
    expect(startzustand(r, id).persist).toBe(true)
  })

  it('meldet keinen Fehler — leer ist kein Fehler', () => {
    expect(startzustand(r, id).error).toBeUndefined()
  })
})

describe('Gespeicherter Bestand', () => {
  it('wird unverändert übernommen', () => {
    const s = bestand()
    const { state } = startzustand({ kind: 'ok', state: s }, id)
    expect(state.beans.map((b) => b.name)).toEqual(['Hausmischung', 'Yirgacheffe'])
    expect(state.grinders.map((g) => g.id)).toEqual(['gr-eigen'])
  })

  it('wird nicht ohne Anlass zurückgeschrieben', () => {
    expect(startzustand({ kind: 'ok', state: bestand() }, id).persist).toBe(false)
  })
})

describe('Lesefehler — der Pfad aus F-01', () => {
  /**
   * Das ist der Kern. Ein Lesefehler ist KEIN Erststart.
   *
   * Vorher lief er in denselben Zweig: leerer Zustand, Mühlen dazu,
   * `persist: true`. 300 ms später hat `flush()` die echte Historie mit
   * dem leeren Zustand überschrieben — ein einziger fehlgeschlagener
   * Lesevorgang, und alles war weg.
   */
  const r: LoadResult = { kind: 'failed', error: new Error('IndexedDB nicht lesbar') }

  it('schreibt NICHTS zurück', () => {
    expect(startzustand(r, id).persist).toBe(false)
  })

  it('legt auch keine Vorgabemühlen an', () => {
    // Mühlen anzulegen hieße, den Zustand zu verändern — und ein
    // veränderter Zustand will geschrieben werden. Der Weg zum
    // Überschreiben beginnt hier.
    expect(startzustand(r, id).state.grinders).toEqual([])
  })

  it('sagt, dass etwas schiefgelaufen ist', () => {
    expect(startzustand(r, id).error).toBeTruthy()
  })

  it('lässt die App trotzdem starten', () => {
    // Ein Fehlerbildschirm ohne Ausweg wäre schlimmer als eine leere App
    // mit einer Warnung: Aus der leeren kommt man ins Setup und kann die
    // letzte Sicherung einspielen.
    const { state } = startzustand(r, id)
    expect(state.schemaVersion).toBe(SCHEMA_VERSION)
    expect(state.settings).toBeDefined()
  })
})

describe('Bestand ohne Mühle', () => {
  /**
   * Wer seine letzte Mühle löscht, hat das getan, weil er es wollte.
   * Vorher legte der nächste Start sie wortlos wieder an — die Prüfung
   * lautete `grinders.length === 0` und traf beide Fälle.
   */
  const ohne: AppState = { ...bestand(), grinders: [] }

  it('bekommt sie nicht ungefragt zurück', () => {
    const { state } = startzustand({ kind: 'ok', state: ohne }, id)
    expect(state.grinders).toEqual([])
  })

  it('wird deshalb auch nicht zurückgeschrieben', () => {
    expect(startzustand({ kind: 'ok', state: ohne }, id).persist).toBe(false)
  })

  it('behält seine Bohnen', () => {
    expect(startzustand({ kind: 'ok', state: ohne }, id).state.beans).toHaveLength(2)
  })
})
