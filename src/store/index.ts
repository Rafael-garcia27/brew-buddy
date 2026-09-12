/**
 * Zustandsverwaltung.
 *
 * Der Store hält Daten und ruft die Engine — er enthält selbst keine
 * Kaffeelogik. Alles Fachliche liegt in `src/engine/` und ist ohne Browser
 * testbar (Solution Design §4).
 */
import { create } from 'zustand'
import type { AppState, Settings, AppMode, BeanTrash } from '@/domain'
import type { Bean, Bag, Brew, Grinder, Water, BrewMethod } from '@domain'
import { emptyState } from '@/domain'
import { SCHEMA_VERSION } from '@/config'
import { loadState, saveState, flush, onPersistError } from './persist'
import { startzustand } from './startup'
import { recompute } from '@/engine/learn'

/**
 * Hell ist der Standard (:root), dunkel wird über die Klasse `dark`
 * zugeschaltet. Reihenfolge nicht umdrehen — die Palette in index.css
 * hängt daran.
 */
export function applyTheme(theme: 'dark' | 'light'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const nowIso = () => new Date().toISOString()

interface StoreActions {
  hydrate: () => Promise<void>

  addBean: (b: Omit<Bean, 'id' | 'createdAt'>) => string
  updateBean: (id: string, patch: Partial<Bean>) => void
  /** Löscht und gibt zurück, was dafür entfernt wurde — siehe BeanTrash. */
  deleteBean: (id: string) => BeanTrash | null
  restoreBean: (papierkorb: BeanTrash) => void

  addBag: (b: Omit<Bag, 'id' | 'createdAt' | 'depleted'>) => string
  updateBag: (id: string, patch: Partial<Bag>) => void
  deleteBag: (id: string) => void

  addBrew: (b: Omit<Brew, 'id' | 'createdAt'>) => string
  updateBrew: (id: string, patch: Partial<Brew>) => void
  deleteBrew: (id: string) => void
  setBestBrew: (id: string) => void

  addGrinder: (g: Omit<Grinder, 'id'>) => string
  updateGrinder: (id: string, patch: Partial<Grinder>) => void
  deleteGrinder: (id: string) => void

  upsertWater: (w: Water) => void

  setSettings: (patch: Partial<Settings>) => void
  setMode: (m: AppMode) => void
  setTheme: (t: 'dark' | 'light') => void

  replaceState: (s: AppState) => void
  resetAll: () => void
  /** Warnung wegklicken — sie kommt beim nächsten Fehler wieder. */
  dismissStorageError: () => void
}

export type Store = AppState & {
  ready: boolean
  /**
   * Gesetzt, wenn Lesen oder Schreiben des Bestands fehlgeschlagen ist.
   *
   * Kein Teil von `AppState` — dieser Zustand gehört zur Laufzeit und
   * darf auf keinen Fall mitgespeichert werden. Er verschwindet, sobald
   * ein Schreibvorgang wieder gelingt.
   */
  storageError: string | null
} & StoreActions

/** Nach jeder Datenänderung die Lernmodelle neu rechnen und persistieren. */
function commit(set: (fn: (s: Store) => Partial<Store>) => void, relearn = true) {
  set((s) => {
    const learned = relearn
      ? recompute(s.brews, s.beans, s.bags, new Date())
      : s.learned
    const next: AppState = {
      schemaVersion: s.schemaVersion,
      beans: s.beans,
      bags: s.bags,
      brews: s.brews,
      grinders: s.grinders,
      setups: s.setups,
      waters: s.waters,
      settings: s.settings,
      learned,
    }
    saveState(next)
    return { learned }
  })
}

export const useStore = create<Store>((set, get) => ({
  ...emptyState(SCHEMA_VERSION),
  ready: false,
  storageError: null,

  hydrate: async () => {
    // Schreibfehler erreichen die Oberfläche über diesen Rückruf. Er wird
    // hier gesetzt und nicht beim Modulstart, damit `persist.ts` nichts
    // über den Store weiß.
    onPersistError(() =>
      set({
        storageError:
          'Deine letzte Änderung konnte nicht gespeichert werden. ' +
          'Wahrscheinlich ist der Speicher voll oder der private Modus aktiv. ' +
          'Sichere deine Daten, bevor du weitermachst.',
      }),
    )

    // Die Entscheidung, was übernommen und was zurückgeschrieben wird,
    // liegt in `startup.ts` — dort ist sie ohne IndexedDB prüfbar.
    const { state, persist, error } = startzustand(await loadState(), uid)
    if (persist) saveState(state)
    set({ ...state, ready: true, storageError: error ?? null })
    applyTheme(state.settings.theme)
  },

  dismissStorageError: () => set({ storageError: null }),

  // ── Bohnen ──
  addBean: (b) => {
    const id = uid()
    set((s) => ({ beans: [...s.beans, { ...b, id, createdAt: nowIso() }] }))
    commit(set, false)
    return id
  },
  updateBean: (id, patch) => {
    set((s) => ({ beans: s.beans.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
    commit(set)
  },
  deleteBean: (id) => {
    // Was hier verschwindet, ist mehr als ein Eintrag: Mit der Bohne
    // gehen ihre Tüten UND ihre Protokolle. Bei einer Bohne, die seit
    // Monaten läuft, sind das die Daten, aus denen die App gelernt hat.
    // Deshalb gibt das Löschen zurück, was es entfernt hat.
    const s = get()
    const bean = s.beans.find((x) => x.id === id)
    if (!bean) return null
    const papierkorb: BeanTrash = {
      bean,
      bags: s.bags.filter((x) => x.beanId === id),
      brews: s.brews.filter((x) => x.beanId === id),
    }
    set((st) => ({
      beans: st.beans.filter((x) => x.id !== id),
      bags: st.bags.filter((x) => x.beanId !== id),
      brews: st.brews.filter((x) => x.beanId !== id),
    }))
    commit(set)
    return papierkorb
  },
  restoreBean: ({ bean, bags, brews }) => {
    set((s) => ({
      // Nur einfügen, was fehlt: Ein zweiter Klick auf „Rückgängig"
      // darf keine Dubletten anlegen.
      beans: s.beans.some((x) => x.id === bean.id) ? s.beans : [...s.beans, bean],
      bags: [...s.bags, ...bags.filter((b) => !s.bags.some((x) => x.id === b.id))],
      brews: [...s.brews, ...brews.filter((b) => !s.brews.some((x) => x.id === b.id))],
    }))
    commit(set)
  },

  // ── Tüten ──
  addBag: (b) => {
    const id = uid()
    set((s) => ({ bags: [...s.bags, { ...b, id, depleted: false, createdAt: nowIso() }] }))
    commit(set, false)
    return id
  },
  updateBag: (id, patch) => {
    set((s) => ({ bags: s.bags.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
    commit(set)
  },
  deleteBag: (id) => {
    set((s) => ({
      bags: s.bags.filter((x) => x.id !== id),
      brews: s.brews.filter((x) => x.bagId !== id),
    }))
    commit(set)
  },

  // ── Brews ──
  addBrew: (b) => {
    const id = uid()
    set((s) => {
      // Restmenge der Tüte automatisch verringern
      const bags = s.bags.map((bag) =>
        bag.id === b.bagId && bag.remainingGrams !== undefined
          ? {
              ...bag,
              remainingGrams: Math.max(0, Math.round((bag.remainingGrams - b.actual.doseG) * 10) / 10),
              depleted: bag.remainingGrams - b.actual.doseG <= 0,
            }
          : bag,
      )
      return {
        brews: [{ ...b, id, createdAt: nowIso() }, ...s.brews],
        bags,
        settings: { ...s.settings, lastBeanId: b.beanId, lastMethod: b.method },
      }
    })
    commit(set)
    return id
  },
  updateBrew: (id, patch) => {
    set((s) => ({ brews: s.brews.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
    commit(set)
  },
  deleteBrew: (id) => {
    set((s) => ({ brews: s.brews.filter((x) => x.id !== id) }))
    commit(set)
  },
  setBestBrew: (id) => {
    set((s) => {
      const target = s.brews.find((b) => b.id === id)
      if (!target) return {}
      return {
        brews: s.brews.map((b) =>
          b.beanId === target.beanId && b.method === target.method
            ? { ...b, isBest: b.id === id }
            : b,
        ),
      }
    })
    commit(set)
  },

  // ── Mühlen ──
  addGrinder: (g) => {
    const id = uid()
    set((s) => ({
      grinders: [...s.grinders, { ...g, id }],
      settings: s.settings.activeGrinderId ? s.settings : { ...s.settings, activeGrinderId: id },
    }))
    commit(set, false)
    return id
  },
  updateGrinder: (id, patch) => {
    set((s) => ({ grinders: s.grinders.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
    commit(set, false)
  },
  deleteGrinder: (id) => {
    set((s) => ({
      grinders: s.grinders.filter((x) => x.id !== id),
      settings:
        s.settings.activeGrinderId === id
          ? { ...s.settings, activeGrinderId: undefined }
          : s.settings,
    }))
    commit(set, false)
  },

  upsertWater: (w) => {
    set((s) => ({
      waters: s.waters.some((x) => x.id === w.id)
        ? s.waters.map((x) => (x.id === w.id ? w : x))
        : [...s.waters, w],
      settings: { ...s.settings, activeWaterId: w.id },
    }))
    commit(set, false)
  },

  // ── Einstellungen ──
  setSettings: (patch) => {
    // Das Thema hängt an einer Klasse am <html>-Element, nicht nur am
    // Zustand. Ohne diese Zeile ließe sich das Thema über setSettings
    // setzen, ohne dass sich etwas ändert — eine Falle für jeden späteren
    // Aufrufer, auch wenn heute nur setTheme diesen Weg geht.
    if (patch.theme) applyTheme(patch.theme)
    set((s) => ({ settings: { ...s.settings, ...patch } }))
    commit(set, false)
  },
  setMode: (m) => {
    set((s) => ({
      settings: {
        ...s.settings,
        mode: m,
        // Refraktometer-Felder gehören zu Pro. Beim Zurückschalten
        // abschalten, sonst tauchen im Basis-Modus leere Felder auf.
        showMeasurements: m === 'pro' ? s.settings.showMeasurements : false,
      },
    }))
    commit(set, false)
  },
  setTheme: (t) => {
    applyTheme(t)
    set((s) => ({ settings: { ...s.settings, theme: t } }))
    commit(set, false)
  },

  replaceState: (s) => {
    set({ ...s, ready: true })
    applyTheme(s.settings.theme)
    commit(set)
  },
  resetAll: () => {
    set({ ...emptyState(SCHEMA_VERSION), ready: true })
    commit(set)
  },
}))

export { flush }

// Nur in der Entwicklung: Store am Fenster, damit sich Abläufe automatisiert
// prüfen lassen. Im Produktionsbündel entfernt der Bundler diesen Block.
if (import.meta.env.DEV) {
  ;(globalThis as unknown as { __cafe?: unknown }).__cafe = useStore
}

// ── Selektoren ────────────────────────────────────────────────────────

export const selectBean = (id?: string) => (s: Store) => s.beans.find((b) => b.id === id)

export const selectBagsForBean = (beanId: string) => (s: Store) =>
  s.bags.filter((b) => b.beanId === beanId).sort((a, b) => (a.depleted ? 1 : 0) - (b.depleted ? 1 : 0))

export const selectActiveBag = (beanId: string) => (s: Store) =>
  s.bags
    .filter((b) => b.beanId === beanId && !b.depleted)
    .sort((a, b) => (b.roastDate ?? '').localeCompare(a.roastDate ?? ''))[0]

export const selectBeanHistory = (beanId: string, method: BrewMethod) => (s: Store) =>
  s.brews
    .filter((b) => b.beanId === beanId && b.method === method)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export const selectMethodHistory = (method: BrewMethod) => (s: Store) =>
  s.brews.filter((b) => b.method === method).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export const selectActiveGrinder = (s: Store) =>
  s.grinders.find((g) => g.id === s.settings.activeGrinderId)

/**
 * Die Mühle, die für diese Methode tatsächlich am Tisch steht.
 *
 * Kein Hook-Selektor mit Argument — in Komponenten als
 * `grinderFor(useStore(...), method)` verwenden, damit keine neue
 * Objektidentität je Render entsteht.
 */
export function grinderFor(
  s: { grinders: Grinder[]; settings: Settings },
  method: BrewMethod,
) {
  if (method === 'espresso' && s.settings.espressoGrinderId) {
    const g = s.grinders.find((x) => x.id === s.settings.espressoGrinderId)
    if (g) return g
  }
  const active = s.grinders.find((g) => g.id === s.settings.activeGrinderId)
  // Eine methodenbeschränkte Mühle darf nie für eine fremde Methode gelten.
  if (active?.methods && !active.methods.includes(method)) {
    return s.grinders.find((g) => !g.methods || g.methods.includes(method)) ?? active
  }
  return active
}

export const selectActiveWater = (s: Store) =>
  s.waters.find((w) => w.id === s.settings.activeWaterId)

/**
 * ACHTUNG: Kein Selektor für `useStore(...)`.
 * Erzeugt bei jedem Aufruf ein neues Objekt — als Hook-Selektor verwendet
 * führt das zu einer Render-Endlosschleife. Immer über
 * `selectSnapshot(useStore.getState())` aufrufen.
 */
export const selectSnapshot = (s: Store): AppState => ({
  schemaVersion: s.schemaVersion,
  beans: s.beans,
  bags: s.bags,
  brews: s.brews,
  grinders: s.grinders,
  setups: s.setups,
  waters: s.waters,
  settings: s.settings,
  learned: s.learned,
})
