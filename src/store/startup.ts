/**
 * Was der Store beim Start übernimmt — und was er zurückschreibt.
 *
 * Bewusst ohne Browser-Schnittstellen, aus demselben Grund wie
 * `migrate.ts`: Das ist die Stelle, an der die App entscheidet, ob sie
 * den gespeicherten Bestand behält, ergänzt oder überschreibt. Eine
 * Entscheidung dieser Tragweite gehört geprüft, und geprüft wird nur,
 * was ohne IndexedDB läuft.
 *
 * ## Seit 2.0 gibt es zwei Quellen
 *
 * Der **Ereignisstrom** ist die Wahrheit. Der **Blob** ist seitdem nur
 * noch eine Momentaufnahme — nützlich als zweite Kopie und als
 * Ausgangspunkt für den Export, aber nicht mehr maßgeblich.
 *
 * Das macht den Start sicherer statt komplizierter: Fällt eine der
 * beiden Quellen aus, rettet die andere den Bestand. Vor 2.0 gab es nur
 * eine, und ein einziger Lesefehler bedeutete Totalverlust (F-01).
 */
import type { AppState } from '@/domain'
import { emptyState } from '@/domain'
import { SCHEMA_VERSION, INTEGRATED_GRINDER_ID } from '@/config'
import { grinderFromCatalog } from '@/engine/grinder'
import { defaultGrinderEntry } from '@/kb'
import type { LoadResult, StromErgebnis } from './persist'
import { recompute } from '@/engine/learn'
import type { Ereignis } from './events'
import { falte } from './events'

export interface Startlage {
  blob: LoadResult
  strom: StromErgebnis
}

export interface Startzustand {
  /** Der Zustand, mit dem die App startet. */
  state: AppState
  /**
   * Ereignisse, die einmalig angehängt werden müssen — die Übernahme
   * eines Bestands, den es vor dem Strom schon gab, oder der Erststart.
   * `null` heißt: nichts anhängen.
   */
  uebernahme: Ereignis[] | null
  /** Die Momentaufnahme (Blob) neu schreiben? */
  snapshot: boolean
  /**
   * Gesetzt, wenn eine Quelle nicht gelesen werden konnte. Die App läuft
   * weiter — aber sie darf nichts überschreiben, und der Nutzer muss es
   * erfahren.
   */
  error?: string
}

const NICHT_LESBAR =
  'Der gespeicherte Bestand ließ sich nicht lesen. Es wird nichts überschrieben — ' +
  'schließ die App und öffne sie erneut. Bleibt es dabei, spiel deine letzte Sicherung ein.'

const STROM_HIN =
  'Der Verlauf ließ sich nicht lesen, der Bestand schon. Du arbeitest gerade auf der ' +
  'Momentaufnahme — sichere deine Daten, bevor du weitermachst.'

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

/**
 * Die Lernmodelle gehören zum Startzustand, nicht erst zur ersten
 * Änderung.
 *
 * Sie rechnen Frische ein und altern damit von selbst — ein Bestand, der
 * gestern gespeichert wurde, hat heute andere Modelle. Würden sie erst
 * beim nächsten Schreibvorgang gerechnet, liefe die App bis dahin auf
 * den Zahlen von gestern. Der Selbsttest in `events.test.ts` hat genau
 * das gefunden.
 */
function mitLernmodellen(s: AppState, jetzt: Date): AppState {
  return { ...s, learned: recompute(s.brews, s.beans, s.bags, jetzt) }
}

/** Ein Übernahme-Ereignis: „ab hier gilt dieser Bestand". */
function uebernahmeEreignis(state: AppState, id: () => string, jetzt: Date): Ereignis {
  return { id: id(), at: jetzt.toISOString(), v: 1, art: 'bestand-ersetzt', state }
}

export function startzustand(lage: Startlage, id: () => string, jetzt: Date): Startzustand {
  const { blob, strom } = lage

  /**
   * Beide Quellen unlesbar — der eine Fall, in dem nichts zu retten ist.
   *
   * Hier wird NICHTS verändert und NICHTS geschrieben. Die App startet
   * leer, sagt es, und der Weg zurück führt über die Sicherung im Setup.
   * Ein Fehlerbildschirm ohne Ausweg wäre schlimmer.
   */
  if (strom.kind === 'failed' && blob.kind === 'failed') {
    return {
      state: mitLernmodellen(emptyState(SCHEMA_VERSION), jetzt),
      uebernahme: null,
      snapshot: false,
      error: NICHT_LESBAR,
    }
  }

  /**
   * Der Strom ist hin, die Momentaufnahme steht. Sie rettet den Bestand.
   *
   * Nicht wieder in den Strom schreiben: Der könnte beim nächsten Start
   * doch lesbar sein, und dann stünde alles doppelt drin.
   */
  if (strom.kind === 'failed') {
    if (blob.kind === 'ok') {
      return {
        state: mitLernmodellen(blob.state, jetzt),
        uebernahme: null,
        snapshot: false,
        error: STROM_HIN,
      }
    }
    // Strom hin, Blob leer: Das KANN ein Erststart sein — sicher ist es
    // nicht. Im Zweifel nichts anlegen und nichts schreiben.
    return {
      state: mitLernmodellen(emptyState(SCHEMA_VERSION), jetzt),
      uebernahme: null,
      snapshot: false,
      error: NICHT_LESBAR,
    }
  }

  // Ab hier ist der Strom lesbar.

  /** Der Normalfall ab 2.0: Der Strom trägt alles. */
  if (strom.strom.length > 0) {
    return {
      state: falte(strom.strom, emptyState(SCHEMA_VERSION), jetzt),
      uebernahme: null,
      // Die Momentaufnahme mitziehen, damit sie als zweite Kopie
      // aktuell bleibt — und damit der Export ohne Faltung auskommt.
      snapshot: true,
    }
  }

  /**
   * Strom leer, Blob unlesbar: sieht aus wie ein Erststart, ist aber
   * keiner — genau die Verwechslung aus F-01. Nichts anlegen, nichts
   * schreiben, sagen was los ist.
   */
  if (blob.kind === 'failed') {
    return {
      state: mitLernmodellen(emptyState(SCHEMA_VERSION), jetzt),
      uebernahme: null,
      snapshot: false,
      error: NICHT_LESBAR,
    }
  }

  /**
   * Strom leer, Blob voll: eine Installation von vor 2.0.
   *
   * Der Bestand wandert als EIN Übernahme-Ereignis in den Strom. Die
   * Vergangenheit davor lässt sich nicht rekonstruieren — sie wurde nie
   * aufgezeichnet —, und so zu tun, als hätte man sie, wäre gelogen.
   * Ab hier wächst der Strom ehrlich mit.
   */
  if (blob.kind === 'ok') {
    // Das Übernahme-Ereignis trägt den Bestand OHNE frisch gerechnete
    // Modelle: Sie sind eine Ableitung und gehören nicht in den Strom.
    return {
      state: mitLernmodellen(blob.state, jetzt),
      uebernahme: [uebernahmeEreignis(blob.state, id, jetzt)],
      snapshot: false,
    }
  }

  /**
   * Beides leer: der echte Erststart.
   *
   * Vorher lautete die Prüfung `grinders.length === 0` und traf damit
   * auch den, der seine letzte Mühle absichtlich gelöscht hat. Jetzt
   * entscheidet, ob überhaupt etwas gespeichert ist.
   */
  const frisch = mitVorgabemuehlen(emptyState(SCHEMA_VERSION), id)
  return {
    state: mitLernmodellen(frisch, jetzt),
    uebernahme: [uebernahmeEreignis(frisch, id, jetzt)],
    snapshot: true,
  }
}

/**
 * Der laufende Abgleich zwischen Faltung und Momentaufnahme.
 *
 * Der ursprüngliche Plan sah vor, beide Quellen eine Zeit lang parallel
 * zu führen und zu vergleichen. Weil sich Store und Faltung dieselbe
 * `anwenden()` teilen, KANN die Logik nicht auseinanderlaufen — wohl
 * aber die Vollständigkeit: eine Aktion, die ihr Ereignis vergisst.
 *
 * Verglichen werden deshalb nur die Anzahlen, nicht die Inhalte. Die
 * Momentaufnahme wird gebündelt geschrieben und hinkt regelmäßig um
 * Millisekunden hinterher; ein inhaltlicher Vergleich würde ständig
 * grundlos anschlagen. Ein Eintrag, der es nie in den Strom geschafft
 * hat, fällt in der Anzahl trotzdem auf.
 *
 * `null` heißt: alles beieinander.
 */
export function abweichung(gefaltet: AppState, momentaufnahme: AppState): string | null {
  const zaehl = (s: AppState) => ({
    beans: s.beans.length,
    bags: s.bags.length,
    brews: s.brews.length,
    grinders: s.grinders.length,
    waters: s.waters.length,
  })
  const a = zaehl(gefaltet)
  const b = zaehl(momentaufnahme)
  const streit = (Object.keys(a) as (keyof typeof a)[])
    .filter((k) => a[k] !== b[k])
    .map((k) => `${k}: Strom ${a[k]}, Momentaufnahme ${b[k]}`)
  return streit.length ? streit.join(' · ') : null
}
