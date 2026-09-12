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
  /**
   * Ein Lesefehler ist kein Erststart.
   *
   * Das war der Fehler: Beide Fälle lieferten einen leeren Zustand, beide
   * bekamen Vorgabemühlen, und weil der Zustand dadurch verändert war,
   * wurde er zurückgeschrieben — über echte Daten drüber. Ein einziger
   * fehlgeschlagener Lesevorgang, und die Historie war endgültig weg.
   *
   * Hier wird deshalb NICHTS verändert und NICHTS geschrieben. Die App
   * startet leer, sagt es, und der Weg zurück führt über die Sicherung
   * im Setup. Ein Fehlerbildschirm ohne Ausweg wäre schlimmer.
   */
  if (r.kind === 'failed') {
    return {
      state: emptyState(SCHEMA_VERSION),
      persist: false,
      error:
        'Der gespeicherte Bestand ließ sich nicht lesen. Es wird nichts überschrieben — ' +
        'schließ die App und öffne sie erneut. Bleibt es dabei, spiel deine letzte Sicherung ein.',
    }
  }

  /**
   * Nur beim echten Erststart Mühlen anlegen.
   *
   * Vorher lautete die Prüfung `grinders.length === 0` und traf damit
   * auch den, der seine letzte Mühle absichtlich gelöscht hat: Der
   * nächste Start legte sie wortlos wieder an. Ohne Mühle kommt die App
   * zurecht — der Brühbildschirm sagt es und bietet den Weg ins Setup an.
   */
  if (r.kind === 'empty') {
    return { state: mitVorgabemuehlen(emptyState(SCHEMA_VERSION), id), persist: true }
  }

  return { state: r.state, persist: false }
}
