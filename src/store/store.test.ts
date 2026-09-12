/**
 * Der Kernpfad — auf Store-Ebene, ohne Oberfläche.
 *
 * Befund F-14: 379 Tests, und keiner berührte `hydrate()` oder die Kette
 * „Bohne anlegen → brühen → protokollieren". Der Datenverlust-Pfad aus
 * F-01 lief genau durch diese Lücke: In `startup.ts` ist die Entscheidung
 * inzwischen geprüft, aber nicht, dass `hydrate()` sie auch befolgt.
 *
 * Bewusst ohne DOM-Umgebung. Der Store ruft an genau einer Stelle
 * `document` an (`applyTheme`), und dafür lohnt keine Testumgebung —
 * der Stub unten ist billiger und macht sichtbar, wie klein die
 * Browserabhängigkeit wirklich ist.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AppState } from '@/domain'
import { emptyState } from '@/domain'
import { SCHEMA_VERSION } from '@/config'
import type { LoadResult } from './persist'

// ── Die zwei Dinge, die der Store außerhalb seiner selbst anfasst ─────

/** Was `loadState()` im nächsten `hydrate()` liefern soll. */
let ladeErgebnis: LoadResult = { kind: 'empty' }
/** Alles, was der Store zu schreiben versucht hat. */
let geschrieben: AppState[] = []
/** Der Rückruf, über den Schreibfehler die Oberfläche erreichen. */
let fehlerRueckruf: ((e: unknown) => void) | null = null

vi.mock('./persist', () => ({
  loadState: () => Promise.resolve(ladeErgebnis),
  saveState: (s: AppState) => geschrieben.push(s),
  flush: () => Promise.resolve(),
  onPersistError: (fn: (e: unknown) => void) => {
    fehlerRueckruf = fn
  },
}))

// `applyTheme` setzt eine Klasse auf <html>. Mehr Browser braucht der
// Store nicht — und dieser Stub sagt genau das.
Object.defineProperty(globalThis, 'document', {
  value: { documentElement: { classList: { toggle: () => {} } } },
  writable: true,
  configurable: true,
})

const { useStore, selectSnapshot } = await import('./index')
const { buildBackup, parseBackup } = await import('./migrate')

beforeEach(() => {
  ladeErgebnis = { kind: 'empty' }
  geschrieben = []
  fehlerRueckruf = null
  useStore.setState({ ...emptyState(SCHEMA_VERSION), ready: false, storageError: null })
})

// ── 1. hydrate() ──────────────────────────────────────────────────────

describe('hydrate — Erststart', () => {
  it('legt eine Mühle an und schreibt sie zurück', async () => {
    await useStore.getState().hydrate()
    const s = useStore.getState()
    expect(s.ready).toBe(true)
    expect(s.grinders.length).toBeGreaterThan(0)
    expect(s.settings.activeGrinderId).toBe(s.grinders[0]!.id)
    expect(geschrieben).toHaveLength(1)
  })

  it('meldet keinen Fehler', async () => {
    await useStore.getState().hydrate()
    expect(useStore.getState().storageError).toBeNull()
  })
})

describe('hydrate — gespeicherter Bestand', () => {
  const bestand: AppState = {
    ...emptyState(SCHEMA_VERSION),
    beans: [
      {
        id: 'b1',
        name: 'Yirgacheffe',
        origins: [{ country: 'Äthiopien' }],
        process: 'washed',
        roastLevel: 'light',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  }

  it('übernimmt ihn unverändert', async () => {
    ladeErgebnis = { kind: 'ok', state: bestand }
    await useStore.getState().hydrate()
    expect(useStore.getState().beans.map((b) => b.name)).toEqual(['Yirgacheffe'])
  })

  it('schreibt ihn nicht ohne Anlass zurück', async () => {
    ladeErgebnis = { kind: 'ok', state: bestand }
    await useStore.getState().hydrate()
    expect(geschrieben).toEqual([])
  })
})

describe('hydrate — Lesefehler (die Regressionssperre zu F-01)', () => {
  /**
   * `startup.ts` entscheidet richtig — das ist dort geprüft. Hier wird
   * geprüft, dass `hydrate()` die Entscheidung auch befolgt und nicht
   * doch noch etwas schreibt. Zwischen beiden lag der ursprüngliche
   * Fehler.
   */
  beforeEach(() => {
    ladeErgebnis = { kind: 'failed', error: new Error('IndexedDB nicht lesbar') }
  })

  it('schreibt NICHTS zurück', async () => {
    await useStore.getState().hydrate()
    expect(geschrieben).toEqual([])
  })

  it('legt auch keine Vorgabemühlen an', async () => {
    await useStore.getState().hydrate()
    expect(useStore.getState().grinders).toEqual([])
  })

  it('sagt es dem Nutzer', async () => {
    await useStore.getState().hydrate()
    expect(useStore.getState().storageError).toBeTruthy()
  })

  it('lässt die App trotzdem starten', async () => {
    await useStore.getState().hydrate()
    expect(useStore.getState().ready).toBe(true)
  })
})

describe('hydrate — Schreibfehler (F-02)', () => {
  it('reicht ihn an die Oberfläche durch', async () => {
    await useStore.getState().hydrate()
    expect(useStore.getState().storageError).toBeNull()

    fehlerRueckruf?.(new DOMException('voll', 'QuotaExceededError'))
    expect(useStore.getState().storageError).toContain('nicht gespeichert')
  })

  it('lässt sich wegklicken', async () => {
    await useStore.getState().hydrate()
    fehlerRueckruf?.(new Error('x'))
    useStore.getState().dismissStorageError()
    expect(useStore.getState().storageError).toBeNull()
  })
})

// ── 2. Bohne anlegen → brühen → protokollieren ────────────────────────

describe('Der Kernpfad', () => {
  function aufbau() {
    const s = useStore.getState()
    const beanId = s.addBean({
      name: 'Hausmischung',
      origins: [{ country: 'Brasilien' }],
      process: 'natural',
      roastLevel: 'medium',
    })
    const bagId = useStore.getState().addBag({
      beanId,
      roastDate: '2026-09-01',
      purchasedGrams: 250,
      remainingGrams: 250,
    })
    return { beanId, bagId }
  }

  it('legt Bohne und Tüte an', () => {
    const { beanId, bagId } = aufbau()
    const s = useStore.getState()
    expect(s.beans).toHaveLength(1)
    expect(s.bags).toHaveLength(1)
    expect(s.bags[0]!.beanId).toBe(beanId)
    expect(s.bags[0]!.id).toBe(bagId)
    expect(s.bags[0]!.depleted).toBe(false)
  })

  it('zieht die Dosis von der Tüte ab', () => {
    const { beanId, bagId } = aufbau()
    useStore.getState().addBrew({
      beanId,
      bagId,
      method: 'espresso',
      actual: { doseG: 18, yieldG: 36, timeS: 27, waterTempC: 93 },
      tasting: { rating: 4, defects: [], characters: [], wouldRepeat: true },
      isBest: false,
    })
    // Das ist die Buchhaltung, die einem sonst niemand abnimmt: 250 − 18.
    expect(useStore.getState().bags[0]!.remainingGrams).toBe(232)
  })

  it('merkt sich Bohne und Methode für den nächsten Start', () => {
    const { beanId, bagId } = aufbau()
    useStore.getState().addBrew({
      beanId,
      bagId,
      method: 'v60',
      actual: { doseG: 15, waterG: 250, timeS: 180 },
      isBest: false,
    })
    const { settings } = useStore.getState()
    expect(settings.lastBeanId).toBe(beanId)
    expect(settings.lastMethod).toBe('v60')
  })

  it('markiert die Tüte als leer, wenn nichts mehr drin ist', () => {
    const { beanId, bagId } = aufbau()
    useStore.getState().updateBag(bagId, { remainingGrams: 10 })
    useStore.getState().addBrew({
      beanId,
      bagId,
      method: 'espresso',
      actual: { doseG: 18, yieldG: 36, timeS: 27 },
      isBest: false,
    })
    const bag = useStore.getState().bags[0]!
    expect(bag.remainingGrams).toBe(0)
    expect(bag.depleted).toBe(true)
  })

  it('lässt nur einen Brew der beste sein', () => {
    const { beanId, bagId } = aufbau()
    const b = () =>
      useStore.getState().addBrew({
        beanId,
        bagId,
        method: 'espresso',
        actual: { doseG: 18, yieldG: 36, timeS: 27 },
        isBest: false,
      })
    const erster = b()
    const zweiter = b()
    useStore.getState().setBestBrew(erster)
    useStore.getState().setBestBrew(zweiter)
    const beste = useStore.getState().brews.filter((x) => x.isBest)
    expect(beste.map((x) => x.id)).toEqual([zweiter])
  })
})

describe('Bohne löschen und zurückholen', () => {
  it('nimmt Tüten und Brews mit — und bringt sie wieder', () => {
    const s = useStore.getState()
    const beanId = s.addBean({
      name: 'Weg damit',
      origins: [],
      process: 'washed',
      roastLevel: 'medium',
    })
    const bagId = useStore.getState().addBag({ beanId, remainingGrams: 250 })
    useStore.getState().addBrew({
      beanId,
      bagId,
      method: 'espresso',
      actual: { doseG: 18, yieldG: 36, timeS: 27 },
      isBest: false,
    })

    const papierkorb = useStore.getState().deleteBean(beanId)!
    expect(useStore.getState()).toMatchObject({ beans: [], bags: [], brews: [] })
    // Die Zahl im „Rückgängig"-Streifen kommt aus diesem Objekt — sie
    // muss stimmen, sonst verspricht die Leiste etwas Falsches.
    expect(papierkorb.bags).toHaveLength(1)
    expect(papierkorb.brews).toHaveLength(1)

    useStore.getState().restoreBean(papierkorb)
    const s2 = useStore.getState()
    expect(s2.beans.map((b) => b.id)).toEqual([beanId])
    expect(s2.bags).toHaveLength(1)
    expect(s2.brews).toHaveLength(1)
  })
})

// ── 3. Sicherung und Wiederherstellung ────────────────────────────────

describe('Rundlauf durch eine Sicherungsdatei', () => {
  it('kommt heraus, was hineinging', () => {
    const s = useStore.getState()
    const beanId = s.addBean({
      name: 'Rundlauf',
      origins: [{ country: 'Kolumbien' }],
      process: 'washed',
      roastLevel: 'medium',
    })
    const bagId = useStore.getState().addBag({ beanId, remainingGrams: 250 })
    useStore.getState().addBrew({
      beanId,
      bagId,
      method: 'aeropress',
      actual: { doseG: 14, waterG: 220, timeS: 90 },
      tasting: { rating: 5, defects: [], characters: [], wouldRepeat: true },
      isBest: false,
    })

    // Export: genau der Weg, den der Sicherungsknopf nimmt.
    const datei = JSON.stringify(buildBackup(selectSnapshot(useStore.getState()), new Date()))

    // Dazwischen passiert etwas, das man rückgängig machen will.
    useStore.getState().resetAll()
    expect(useStore.getState().beans).toEqual([])

    const gelesen = parseBackup(datei)
    expect('error' in gelesen).toBe(false)
    useStore.getState().replaceState((gelesen as { state: AppState }).state)

    const s2 = useStore.getState()
    expect(s2.beans.map((b) => b.name)).toEqual(['Rundlauf'])
    expect(s2.bags[0]!.remainingGrams).toBe(236)
    expect(s2.brews[0]!.method).toBe('aeropress')
    expect(s2.brews[0]!.tasting?.rating).toBe(5)
  })

  it('weist eine fremde Datei ab, ohne etwas anzufassen', () => {
    useStore.getState().addBean({
      name: 'Bleibt',
      origins: [],
      process: 'washed',
      roastLevel: 'medium',
    })
    const gelesen = parseBackup('{"app":"etwas-anderes","state":{}}')
    expect(gelesen).toHaveProperty('error')
    expect(useStore.getState().beans).toHaveLength(1)
  })
})
