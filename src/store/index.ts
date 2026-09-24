/**
 * Zustandsverwaltung.
 *
 * Der Store hält Daten und ruft die Engine — er enthält selbst keine
 * Kaffeelogik. Alles Fachliche liegt in `src/engine/` und ist ohne Browser
 * testbar (Solution Design §4).
 */
import { create } from 'zustand'
import type { AppState, Settings, AppMode, BeanTrash, Empfehlung, Theme } from '@/domain'
import type { Bean, Bag, Brew, Grinder, Water, BrewMethod } from '@domain'
import { emptyState } from '@/domain'
import { SCHEMA_VERSION } from '@/config'
import { loadState, saveState, flush, onPersistError, loadEvents, appendEvents } from './persist'
import type { Ereignis, Nutzlast } from './events'
import { anwenden, brauchtLernen } from './events'
import { startzustand, abweichung } from './startup'
import { recompute } from '@/engine/learn'

/**
 * Hell ist der Standard (:root), dunkel wird über die Klasse `dark`
 * zugeschaltet. Reihenfolge nicht umdrehen — die Palette in index.css
 * hängt daran.
 */
export function applyTheme(theme: Theme): void {
  // Beide Klassen ausdrücklich setzen statt umzuschalten: Wer von
  // „Organic" auf „Dunkel" wechselt, muss die alte auch wieder los
  // werden — sonst gelten zwei Paletten gleichzeitig, und welche
  // gewinnt, entscheidet die Reihenfolge im Stylesheet.
  const c = document.documentElement.classList
  c.toggle('dark', theme === 'dark')
  c.toggle('organic', theme === 'organic')
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

  /** Eine gegebene Empfehlung festhalten, damit sie eingelöst werden kann. */
  merkeEmpfehlung: (e: Empfehlung) => void
  uebernehmeEmpfehlung: (id: string) => void
  verwerfeEmpfehlung: (id: string) => void

  setSettings: (patch: Partial<Settings>) => void
  setMode: (m: AppMode) => void
  setTheme: (t: Theme) => void

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

/**
 * Nach jeder Datenänderung die Lernmodelle neu rechnen und die
 * Momentaufnahme schreiben.
 *
 * Seit 2.0 ist der Blob nicht mehr die Wahrheit — die steht im
 * Ereignisstrom. Er bleibt trotzdem: als zweite Kopie, die einen
 * unlesbaren Strom auffängt, und als Grundlage des Exports, der damit
 * ohne Faltung auskommt.
 */
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
      empfehlungen: s.empfehlungen,
    }
    saveState(next)
    return { learned }
  })
}

/**
 * Die laufende Startzusage.
 *
 * Sie bündelt NEBENLÄUFIGE Aufrufe — nicht spätere. Nach dem Durchlauf
 * wird sie wieder freigegeben; dass ein zweiter Start dann nichts mehr
 * tut, entscheidet `ready` in `starte()`. Zwei getrennte Gründe, zwei
 * getrennte Wächter.
 */
let startLaeuft: Promise<void> | null = null

export const useStore = create<Store>((set, get) => {
  /**
   * Der einzige Schreibweg in den Bestand.
   *
   * Jede Änderung ist ein Ereignis: Es wird gebaut, angewendet und
   * angehängt — in dieser Reihenfolge und ohne Ausnahme. Wer hier
   * vorbeischreibt, erzeugt einen Bestand, den die Faltung nicht
   * reproduzieren kann; genau darauf prüft der Selbsttest in
   * `events.test.ts`.
   */
  const melde = (n: Nutzlast): Ereignis => {
    const e = { id: uid(), at: nowIso(), v: 1, ...n } as Ereignis
    set((s) => anwenden(selectSnapshot(s), e))
    appendEvents(e)
    commit(set, brauchtLernen(e))
    return e
  }

  /** Der eigentliche Start. Der Riegel dagegen liegt in `hydrate`. */
  const starte = async (): Promise<void> => {
    if (get().ready) return

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

    // Beide Quellen parallel — der Strom ist die Wahrheit, der Blob die
    // Rückfallebene. Welche gilt, entscheidet `startup.ts`; dort ist die
    // Entscheidung ohne IndexedDB prüfbar.
    const [blob, strom] = await Promise.all([loadState(), loadEvents()])
    const r = startzustand({ blob, strom }, uid, new Date())

    /**
     * Der Abgleich aus dem Übergangsplan. Er sucht nicht nach falscher
     * Logik — die ist geteilt und kann nicht abweichen —, sondern nach
     * einer Änderung, die es nie in den Strom geschafft hat.
     */
    if (import.meta.env.DEV && blob.kind === 'ok' && strom.kind === 'ok' && strom.strom.length) {
      const streit = abweichung(r.state, blob.state)
      if (streit) console.warn('[strom] Faltung weicht von der Momentaufnahme ab —', streit)
    }

    if (r.uebernahme) appendEvents(...r.uebernahme)
    if (r.snapshot) saveState(r.state)
    set({ ...r.state, ready: true, storageError: r.error ?? null })
    applyTheme(r.state.settings.theme)
  }

  return {
  ...emptyState(SCHEMA_VERSION),
  ready: false,
  storageError: null,

  /**
   * Nur einmal — und zwar wirklich.
   *
   * React ruft Effekte im Entwicklungsmodus absichtlich doppelt auf. Ein
   * `if (ready) return` reicht dagegen nicht: Beide Aufrufe prüfen das
   * Flag, bevor einer es setzt, und beide laufen durch. Gefunden bei der
   * ersten Probe mit echten Daten — im Strom standen zwei
   * Übernahme-Ereignisse.
   *
   * Der Riegel liegt deshalb auf der Zusage, nicht auf dem Ergebnis: Der
   * zweite Aufruf bekommt dieselbe Zusage zurück und wartet mit.
   */
  hydrate: () =>
    (startLaeuft ??= starte().finally(() => {
      startLaeuft = null
    })),

  dismissStorageError: () => set({ storageError: null }),

  // ── Bohnen ──
  addBean: (b) => {
    const bohne: Bean = { ...b, id: uid(), createdAt: nowIso() }
    melde({ art: 'bohne-angelegt', bohne })
    return bohne.id
  },
  updateBean: (id, patch) => void melde({ art: 'bohne-geaendert', beanId: id, patch }),

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
    melde({ art: 'bohne-geloescht', beanId: id })
    return papierkorb
  },
  restoreBean: (papierkorb) => void melde({ art: 'bohne-zurueckgeholt', papierkorb }),

  // ── Tüten ──
  addBag: (b) => {
    const bag: Bag = { ...b, id: uid(), depleted: false, createdAt: nowIso() }
    melde({ art: 'tuete-angelegt', bag })
    return bag.id
  },
  updateBag: (id, patch) => void melde({ art: 'tuete-geaendert', bagId: id, patch }),
  deleteBag: (id) => void melde({ art: 'tuete-geloescht', bagId: id }),

  // ── Brews ──
  addBrew: (b) => {
    const brew: Brew = { ...b, id: uid(), createdAt: nowIso() }
    melde({ art: 'brew-protokolliert', brew })
    return brew.id
  },
  updateBrew: (id, patch) => void melde({ art: 'brew-geaendert', brewId: id, patch }),
  deleteBrew: (id) => void melde({ art: 'brew-geloescht', brewId: id }),
  setBestBrew: (id) => void melde({ art: 'referenz-gesetzt', brewId: id }),

  // ── Mühlen ──
  addGrinder: (g) => {
    const grinder: Grinder = { ...g, id: uid() }
    melde({ art: 'muehle-angelegt', grinder })
    return grinder.id
  },
  updateGrinder: (id, patch) => void melde({ art: 'muehle-geaendert', grinderId: id, patch }),
  deleteGrinder: (id) => void melde({ art: 'muehle-geloescht', grinderId: id }),

  upsertWater: (water) => void melde({ art: 'wasser-gesetzt', water }),

  // ── Empfehlungen ──
  merkeEmpfehlung: (empfehlung) => void melde({ art: 'empfehlung-gegeben', empfehlung }),
  uebernehmeEmpfehlung: (id) => void melde({ art: 'empfehlung-uebernommen', empfehlungId: id }),
  verwerfeEmpfehlung: (id) => void melde({ art: 'empfehlung-verworfen', empfehlungId: id }),

  // ── Einstellungen ──
  setSettings: (patch) => {
    // Das Thema hängt an einer Klasse am <html>-Element, nicht nur am
    // Zustand. Ohne diese Zeile ließe sich das Thema über setSettings
    // setzen, ohne dass sich etwas ändert.
    if (patch.theme) applyTheme(patch.theme)
    melde({ art: 'einstellungen-geaendert', patch })
  },
  setMode: (m) =>
    void melde({
      art: 'einstellungen-geaendert',
      patch: {
        mode: m,
        // Refraktometer-Felder gehören zu Pro. Beim Zurückschalten
        // abschalten, sonst tauchen im Basis-Modus leere Felder auf.
        ...(m === 'pro' ? {} : { showMeasurements: false }),
      },
    }),
  setTheme: (t) => {
    applyTheme(t)
    melde({ art: 'einstellungen-geaendert', patch: { theme: t } })
  },

  replaceState: (s) => {
    melde({ art: 'bestand-ersetzt', state: s })
    set({ ready: true })
    applyTheme(s.settings.theme)
  },
  resetAll: () => {
    melde({ art: 'bestand-geleert', state: emptyState(SCHEMA_VERSION) })
    set({ ready: true })
  },
  }
})

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
  empfehlungen: s.empfehlungen,
})
