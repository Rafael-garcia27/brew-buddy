/**
 * Der Selbsttest des Ereignisstroms.
 *
 * Seit 2.0 ist der Strom die Wahrheit und der Blob nur noch eine
 * Momentaufnahme. Das trägt genau so lange, wie JEDE Änderung ein
 * Ereignis hinterlässt. Eine Aktion, die am Strom vorbeischreibt, fällt
 * im Betrieb nicht auf — bis zum nächsten Start, wenn die Faltung einen
 * anderen Bestand ergibt als den, den man gestern gesehen hat.
 *
 * Deshalb steht hier keine Prüfung einzelner Ereignisse, sondern die
 * eine, auf die es ankommt: **Der Store wird durch alles gefahren, was
 * er kann — und danach muss die Faltung seiner Ereignisse denselben
 * Bestand ergeben.**
 *
 * Die Logik selbst kann nicht auseinanderlaufen: `anwenden()` ist die
 * einzige Stelle, die den Bestand ändert, und Store wie Faltung rufen
 * sie auf. Was auseinanderlaufen KANN, ist die Vollständigkeit — und
 * genau die wird hier gemessen.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import type { AppState } from '@/domain'
import { emptyState } from '@/domain'
import { SCHEMA_VERSION } from '@/config'
import type { LoadResult, StromErgebnis } from './persist'
import type { Ereignis } from './events'

let ladeErgebnis: LoadResult = { kind: 'empty' }
let stromErgebnis: StromErgebnis = { kind: 'ok', strom: [] }
let angehaengt: Ereignis[] = []

vi.mock('./persist', () => ({
  loadState: () => Promise.resolve(ladeErgebnis),
  saveState: () => {},
  loadEvents: () => Promise.resolve(stromErgebnis),
  appendEvents: (...e: Ereignis[]) => angehaengt.push(...e),
  flush: () => Promise.resolve(),
  flushEvents: () => Promise.resolve(),
  onPersistError: () => {},
}))

Object.defineProperty(globalThis, 'document', {
  value: { documentElement: { classList: { toggle: () => {} } } },
  writable: true,
  configurable: true,
})

const { useStore, selectSnapshot } = await import('./index')
const { falte } = await import('./events')

/**
 * Die Zeit steht still.
 *
 * Die Lernmodelle rechnen Frische ein. Ohne feste Zeit unterscheiden
 * sich Store und Faltung um die Millisekunden zwischen beiden Aufrufen —
 * und der Test würde gelegentlich rot, ohne dass etwas kaputt wäre.
 */
const JETZT = new Date('2026-09-17T08:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(JETZT)
  ladeErgebnis = { kind: 'empty' }
  stromErgebnis = { kind: 'ok', strom: [] }
  angehaengt = []
  useStore.setState({ ...emptyState(SCHEMA_VERSION), ready: false, storageError: null })
})
afterAll(() => vi.useRealTimers())

/** Faltung des mitgeschriebenen Stroms, von ganz vorn. */
function gefaltet(): AppState {
  return falte(angehaengt, emptyState(SCHEMA_VERSION), JETZT)
}

function jetztImStore(): AppState {
  return selectSnapshot(useStore.getState())
}

describe('Der Strom bildet den Bestand vollständig ab', () => {
  it('nach dem Erststart', async () => {
    await useStore.getState().hydrate()
    expect(gefaltet()).toEqual(jetztImStore())
  })

  it('nach einer langen, realistischen Sitzungsfolge', async () => {
    await useStore.getState().hydrate()
    const s = () => useStore.getState()

    // Regal aufbauen
    const bohneA = s().addBean({
      name: 'Hausmischung',
      origins: [{ country: 'Brasilien' }],
      process: 'natural',
      roastLevel: 'medium',
    })
    const bohneB = s().addBean({
      name: 'Yirgacheffe',
      origins: [{ country: 'Äthiopien' }],
      process: 'washed',
      roastLevel: 'light',
    })
    s().updateBean(bohneA, { roaster: 'Rösterei Vier', isDecaf: false })

    const tueteA = s().addBag({ beanId: bohneA, roastDate: '2026-09-05', remainingGrams: 1000 })
    const tueteB = s().addBag({ beanId: bohneB, roastDate: '2026-09-12', remainingGrams: 250 })
    s().updateBag(tueteB, { storage: 'frozen', frozenAt: '2026-09-14' })

    // Brühen
    const brew1 = s().addBrew({
      beanId: bohneA, bagId: tueteA, method: 'espresso',
      actual: { doseG: 18, yieldG: 36, timeS: 32, waterTempC: 93 },
      tasting: { rating: 2, defects: ['bitter'], characters: [], wouldRepeat: false },
      isBest: false,
    })
    const brew2 = s().addBrew({
      beanId: bohneA, bagId: tueteA, method: 'espresso',
      actual: { doseG: 18, yieldG: 36, timeS: 27, waterTempC: 93 },
      tasting: { rating: 5, defects: [], characters: ['caramel'], wouldRepeat: true },
      isBest: false,
    })
    s().addBrew({
      beanId: bohneB, bagId: tueteB, method: 'v60',
      actual: { doseG: 15, waterG: 250, timeS: 180 },
      isBest: false,
    })
    s().updateBrew(brew1, { tasting: { rating: 3, defects: [], characters: [], wouldRepeat: true } })
    s().setBestBrew(brew2)
    s().deleteBrew(brew1)

    // Geräte und Einstellungen
    const muehle = s().addGrinder({
      name: 'Zweitmühle', burrType: 'flat', scaleType: 'stepped',
      micronPerStep: 20, zeroPointOffsetMicron: 0, usableRange: [0, 40], confidence: 'vendor',
    })
    s().updateGrinder(muehle, { micronPerStep: 18, confidence: 'measured' })
    s().upsertWater({ id: 'w1', label: 'Leitung', source: 'tap', ghMgL: 5, khMgL: 3 })
    s().setMode('pro')
    s().setTheme('dark')
    s().setSettings({ favoriteMethods: ['espresso', 'v60'] })
    s().setMode('basic')

    // Löschen und zurückholen
    const papierkorb = s().deleteBean(bohneB)!
    s().restoreBean(papierkorb)
    s().deleteBag(tueteB)
    s().deleteGrinder(muehle)

    expect(gefaltet()).toEqual(jetztImStore())
  })

  it('auch über Import und Zurücksetzen hinweg', async () => {
    await useStore.getState().hydrate()
    const s = () => useStore.getState()

    const bohne = s().addBean({
      name: 'Vorher', origins: [], process: 'washed', roastLevel: 'medium',
    })
    s().addBag({ beanId: bohne, remainingGrams: 250 })

    // Ein Import ersetzt alles — auch das ist ein Ereignis, kein Bruch.
    s().replaceState({
      ...emptyState(SCHEMA_VERSION),
      beans: [{
        id: 'importiert', name: 'Aus der Sicherung', origins: [],
        process: 'natural', roastLevel: 'dark', createdAt: '2026-08-01T00:00:00.000Z',
      }],
    })
    expect(gefaltet()).toEqual(jetztImStore())

    s().addBean({ name: 'Danach', origins: [], process: 'washed', roastLevel: 'medium' })
    s().resetAll()
    s().addBean({ name: 'Ganz neu', origins: [], process: 'washed', roastLevel: 'medium' })

    expect(gefaltet()).toEqual(jetztImStore())
    expect(jetztImStore().beans.map((b) => b.name)).toEqual(['Ganz neu'])
  })
})

describe('Der Strom trägt alte Formen', () => {
  it('ein Übernahme-Ereignis aus einem älteren Schema läuft durch die Migration', async () => {
    /**
     * Ein Ereignis von gestern trägt die Form von gestern. Beim ersten
     * Versuch stand in `anwenden()` schlicht `return e.state`, und die
     * App stürzte ab, sobald ein Übernahme-Ereignis aus Schema 3 auf
     * eine Fassung traf, die `empfehlungen` erwartet.
     */
    const alt = {
      schemaVersion: 3,
      beans: [{ id: 'b1', name: 'Alt', origins: [], process: 'washed', roastLevel: 'medium', createdAt: '2026-01-01T00:00:00.000Z' }],
      bags: [], brews: [], grinders: [], setups: [], waters: [],
      settings: { mode: 'basic', theme: 'light', showMeasurements: false },
      learned: { process: {}, preference: {}, perBean: {} },
    } as unknown as AppState

    const e = { id: 'e1', at: JETZT.toISOString(), v: 1, art: 'bestand-ersetzt', state: alt } as Ereignis
    const nachher = falte([e], emptyState(SCHEMA_VERSION), JETZT)

    expect(nachher.empfehlungen).toEqual([])
    expect(nachher.schemaVersion).toBe(SCHEMA_VERSION)
    expect(nachher.beans).toHaveLength(1)
  })
})

describe('Was der Strom über sich selbst weiß', () => {
  it('jedes Ereignis trägt Kennung, Zeitpunkt und Schemaversion', async () => {
    await useStore.getState().hydrate()
    useStore.getState().addBean({
      name: 'X', origins: [], process: 'washed', roastLevel: 'medium',
    })
    expect(angehaengt.length).toBeGreaterThan(0)
    for (const e of angehaengt) {
      expect(e.id).toBeTruthy()
      expect(e.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(e.v).toBe(1)
      expect(e.art).toBeTruthy()
    }
  })

  it('ein unbekanntes Ereignis beschädigt den Bestand nicht', async () => {
    // Kommt vor, wenn eine ältere Fassung der App einen neueren Strom
    // liest. Dann wird übersprungen, nicht geraten.
    await useStore.getState().hydrate()
    const vorher = gefaltet()
    const fremd = { id: 'x', at: JETZT.toISOString(), v: 1, art: 'aus-der-zukunft' } as unknown as Ereignis
    expect(falte([...angehaengt, fremd], emptyState(SCHEMA_VERSION), JETZT)).toEqual(vorher)
  })
})
