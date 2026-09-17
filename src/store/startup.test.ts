/**
 * Der Start ist die gefährlichste Stelle der App.
 *
 * Hier wird entschieden, ob der gespeicherte Bestand behalten, ergänzt
 * oder überschrieben wird — und die App hat keinen Server, von dem sie
 * ihn zurückholen könnte. Was hier falsch entschieden wird, ist endgültig.
 *
 * Anlass war Befund F-01: Ein fehlgeschlagener Lesevorgang war vom
 * Erststart nicht zu unterscheiden. Seit 2.0 gibt es zwei Quellen — den
 * Ereignisstrom und die Momentaufnahme —, und damit vier Ausfallmuster
 * statt zwei. Jedes davon steht hier.
 */
import { describe, it, expect } from 'vitest'
import type { AppState, Bean } from '@/domain'
import { emptyState } from '@/domain'
import { SCHEMA_VERSION } from '@/config'
import type { LoadResult, StromErgebnis } from './persist'
import type { Ereignis } from './events'
import { startzustand } from './startup'

let n = 0
const id = () => `id-${++n}`
const jetzt = new Date('2026-09-17T08:00:00.000Z')

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

const LEER: StromErgebnis = { kind: 'ok', strom: [] }
const STROM_HIN: StromErgebnis = { kind: 'failed', error: new Error('Strom nicht lesbar') }
const BLOB_HIN: LoadResult = { kind: 'failed', error: new Error('Blob nicht lesbar') }
const BLOB_LEER: LoadResult = { kind: 'empty' }

const ereignis = (art: 'bohne-angelegt', bohneName: string): Ereignis => ({
  id: `e-${bohneName}`,
  at: '2026-09-01T07:00:00.000Z',
  v: 1,
  art,
  bohne: bohne(bohneName),
})

// ── 1. Erststart ──────────────────────────────────────────────────────

describe('Erststart — beide Quellen leer', () => {
  const lage = { blob: BLOB_LEER, strom: LEER }

  it('legt eine Mühle an, damit Empfehlungen in Klicks kommen', () => {
    const { state } = startzustand(lage, id, jetzt)
    expect(state.grinders.length).toBeGreaterThan(0)
    expect(state.settings.activeGrinderId).toBe(state.grinders[0]!.id)
  })

  it('schreibt den Anfang in den Strom', () => {
    // Sonst bekäme man bei jedem Start neue Mühlen mit neuen Kennungen.
    const r = startzustand(lage, id, jetzt)
    expect(r.uebernahme).toHaveLength(1)
    expect(r.uebernahme![0]!.art).toBe('bestand-ersetzt')
    expect(r.snapshot).toBe(true)
  })

  it('meldet keinen Fehler — leer ist kein Fehler', () => {
    expect(startzustand(lage, id, jetzt).error).toBeUndefined()
  })
})

// ── 2. Der Normalfall ab 2.0 ──────────────────────────────────────────

describe('Strom vorhanden', () => {
  const strom: StromErgebnis = {
    kind: 'ok',
    strom: [ereignis('bohne-angelegt', 'Hausmischung'), ereignis('bohne-angelegt', 'Kenia')],
  }

  it('faltet ihn zum Bestand', () => {
    const { state } = startzustand({ blob: BLOB_LEER, strom }, id, jetzt)
    expect(state.beans.map((b) => b.name)).toEqual(['Hausmischung', 'Kenia'])
  })

  it('hängt nichts an — der Strom ist schon da', () => {
    expect(startzustand({ blob: BLOB_LEER, strom }, id, jetzt).uebernahme).toBeNull()
  })

  it('zieht die Momentaufnahme mit, damit die zweite Kopie aktuell bleibt', () => {
    expect(startzustand({ blob: BLOB_LEER, strom }, id, jetzt).snapshot).toBe(true)
  })

  it('der Strom gewinnt gegen eine abweichende Momentaufnahme', () => {
    // Die Momentaufnahme kann hinterherhinken; die Wahrheit steht im Strom.
    const r = startzustand({ blob: { kind: 'ok', state: bestand() }, strom }, id, jetzt)
    expect(r.state.beans.map((b) => b.name)).toEqual(['Hausmischung', 'Kenia'])
  })
})

// ── 3. Übernahme einer Installation von vor 2.0 ───────────────────────

describe('Strom leer, Momentaufnahme voll', () => {
  const lage = { blob: { kind: 'ok', state: bestand() } as LoadResult, strom: LEER }

  it('übernimmt den Bestand unverändert', () => {
    const { state } = startzustand(lage, id, jetzt)
    expect(state.beans.map((b) => b.name)).toEqual(['Hausmischung', 'Yirgacheffe'])
  })

  it('schreibt ihn als EIN Übernahme-Ereignis in den Strom', () => {
    // Die Vergangenheit davor wurde nie aufgezeichnet. So zu tun, als
    // hätte man sie, wäre gelogen — ab hier wächst der Strom ehrlich mit.
    const r = startzustand(lage, id, jetzt)
    expect(r.uebernahme).toHaveLength(1)
    const e = r.uebernahme![0]!
    expect(e.art).toBe('bestand-ersetzt')
    expect(e.art === 'bestand-ersetzt' && e.state.beans).toHaveLength(2)
  })

  it('schreibt die Momentaufnahme nicht neu — sie ist ja die Quelle', () => {
    expect(startzustand(lage, id, jetzt).snapshot).toBe(false)
  })
})

// ── 4. Die Ausfallmuster ──────────────────────────────────────────────

describe('Strom leer, Momentaufnahme unlesbar — der Pfad aus F-01', () => {
  /**
   * Das ist der Kern. Ein leerer Strom neben einem kaputten Blob sieht
   * aus wie ein Erststart, ist aber keiner. Genau diese Verwechslung hat
   * vor der Behebung echte Historien gelöscht.
   */
  const lage = { blob: BLOB_HIN, strom: LEER }

  it('schreibt NICHTS zurück', () => {
    const r = startzustand(lage, id, jetzt)
    expect(r.uebernahme).toBeNull()
    expect(r.snapshot).toBe(false)
  })

  it('legt auch keine Vorgabemühlen an', () => {
    expect(startzustand(lage, id, jetzt).state.grinders).toEqual([])
  })

  it('sagt, dass etwas schiefgelaufen ist', () => {
    expect(startzustand(lage, id, jetzt).error).toBeTruthy()
  })

  it('lässt die App trotzdem starten', () => {
    const { state } = startzustand(lage, id, jetzt)
    expect(state.schemaVersion).toBe(SCHEMA_VERSION)
    expect(state.settings).toBeDefined()
  })
})

describe('Strom unlesbar, Momentaufnahme steht', () => {
  const lage = { blob: { kind: 'ok', state: bestand() } as LoadResult, strom: STROM_HIN }

  it('rettet den Bestand aus der zweiten Kopie', () => {
    // Das ist der Gewinn der zweiten Quelle: Vor 2.0 wäre hier alles weg.
    expect(startzustand(lage, id, jetzt).state.beans).toHaveLength(2)
  })

  it('schreibt trotzdem nichts', () => {
    // Der Strom könnte beim nächsten Start doch lesbar sein — dann stünde
    // alles doppelt drin.
    const r = startzustand(lage, id, jetzt)
    expect(r.uebernahme).toBeNull()
    expect(r.snapshot).toBe(false)
  })

  it('sagt, worauf man gerade arbeitet', () => {
    expect(startzustand(lage, id, jetzt).error).toContain('Momentaufnahme')
  })
})

describe('Beide Quellen unlesbar', () => {
  const lage = { blob: BLOB_HIN, strom: STROM_HIN }

  it('lässt alles unangetastet', () => {
    const r = startzustand(lage, id, jetzt)
    expect(r.uebernahme).toBeNull()
    expect(r.snapshot).toBe(false)
    expect(r.state.beans).toEqual([])
  })

  it('sagt es', () => {
    expect(startzustand(lage, id, jetzt).error).toBeTruthy()
  })
})

describe('Strom unlesbar, Momentaufnahme leer', () => {
  it('legt im Zweifel nichts an', () => {
    // Das KANN ein Erststart sein. Sicher ist es nicht — und ungefragt
    // Mühlen anzulegen wäre der erste Schritt zum Überschreiben.
    const r = startzustand({ blob: BLOB_LEER, strom: STROM_HIN }, id, jetzt)
    expect(r.state.grinders).toEqual([])
    expect(r.uebernahme).toBeNull()
    expect(r.snapshot).toBe(false)
    expect(r.error).toBeTruthy()
  })
})

// ── 5. Der gelöschte Mühlen-Fall ──────────────────────────────────────

describe('Bestand ohne Mühle', () => {
  /**
   * Wer seine letzte Mühle löscht, hat das getan, weil er es wollte.
   * Vorher legte der nächste Start sie wortlos wieder an — die Prüfung
   * lautete `grinders.length === 0` und traf beide Fälle.
   */
  const ohne: AppState = { ...bestand(), grinders: [] }

  it('bekommt sie nicht ungefragt zurück — aus der Momentaufnahme', () => {
    const r = startzustand({ blob: { kind: 'ok', state: ohne }, strom: LEER }, id, jetzt)
    expect(r.state.grinders).toEqual([])
  })

  it('behält seine Bohnen', () => {
    const r = startzustand({ blob: { kind: 'ok', state: ohne }, strom: LEER }, id, jetzt)
    expect(r.state.beans).toHaveLength(2)
  })
})
