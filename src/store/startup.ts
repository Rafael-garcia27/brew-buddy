/**
 * Was der Store beim Start übernimmt — und ob er es zurückschreibt.
 *
 * Ausgelagert aus `hydrate()` und bewusst ohne Browser-Schnittstellen,
 * aus demselben Grund wie `migrate.ts`: Das ist die Stelle, an der die
 * App entscheidet, ob sie den gespeicherten Bestand behält, ergänzt oder
 * überschreibt. Eine Entscheidung dieser Tragweite gehört geprüft, und
 * geprüft wird nur, was ohne IndexedDB läuft.
 */
import type { AppState } from '@/domain'
import { emptyState } from '@/domain'
import { SCHEMA_VERSION, INTEGRATED_GRINDER_ID } from '@/config'
import { grinderFromCatalog } from '@/engine/grinder'
import { defaultGrinderEntry } from '@/kb'
import type { LoadResult } from './persist'

export interface Startzustand {
  /** Der Zustand, mit dem die App startet. */
  state: AppState
  /** Darf dieser Zustand zurück in die Datenbank geschrieben werden? */
  persist: boolean
  /**
   * Gesetzt, wenn der gespeicherte Bestand nicht gelesen werden konnte.
   * Die App läuft dann leer weiter — aber sie darf nichts überschreiben,
   * und der Nutzer muss es erfahren.
   */
  error?: string
}

/**
 * Erststart: die Mühle des Nutzers ist voreingestellt, damit Empfehlungen
 * sofort in echten Klicks kommen statt in Prozent.
 *
 * Die verbaute Mühle des Siebträgers steht von Anfang an bereit, aber sie
 * wird NICHT vorausgewählt — welche von beiden für Espresso benutzt wird,
 * entscheidet der Nutzer im Brühen-Menü.
 */
function mitVorgabemuehlen(s: AppState, id: () => string): AppState {
  const hand = grinderFromCatalog(defaultGrinderEntry().id, id())
  if (!hand) return s
  const integriert = grinderFromCatalog(INTEGRATED_GRINDER_ID, `gr-${INTEGRATED_GRINDER_ID}`)
  return {
    ...s,
    grinders: [hand, ...(integriert ? [integriert] : [])],
    settings: { ...s.settings, activeGrinderId: hand.id },
  }
}

export function startzustand(r: LoadResult, id: () => string): Startzustand {
  const s = r.kind === 'ok' ? r.state : emptyState(SCHEMA_VERSION)
  if (s.grinders.length === 0) {
    return { state: mitVorgabemuehlen(s, id), persist: true }
  }
  return { state: s, persist: false }
}
