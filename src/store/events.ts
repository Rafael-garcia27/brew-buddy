/**
 * Der Ereignisstrom — die Wahrheit über alles, was je passiert ist.
 *
 * Bisher lag der gesamte Zustand als ein Blob in IndexedDB, und jede
 * Änderung schrieb ihn vollständig neu. Das war die Form, aus der die
 * Befunde F-01 und F-02 folgten: Wer alles auf einmal überschreibt, kann
 * auch alles auf einmal verlieren.
 *
 * Hier ist der Zustand stattdessen die Faltung einer angehängten Folge
 * von Ereignissen. Nichts wird überschrieben, nur ergänzt.
 *
 * ## Warum EIN Rechenweg und nicht zwei
 *
 * Der ursprüngliche Plan sah vor, Strom und Blob eine Zeit lang parallel
 * zu führen und gegeneinander zu prüfen. Zwei Umsetzungen derselben Logik
 * erzeugen aber genau das Auseinanderlaufen, das sie aufdecken sollen.
 *
 * Deshalb steht die Logik nur hier: `anwenden()` ist die einzige Stelle,
 * an der sich der Bestand ändert. Der Store ruft sie auf, die Faltung
 * ruft sie auf. Sie KÖNNEN nicht auseinanderlaufen.
 *
 * Was trotzdem schiefgehen kann, ist eine Änderung ohne Ereignis — ein
 * vergessener Eintrag im Protokoll. Genau darauf prüft `probeFaltung()`
 * in `events.test.ts` und der Selbsttest beim Start.
 *
 * ## Warum die Ereignisse fertige Werte tragen
 *
 * Kein `uid()`, kein `Date.now()` in dieser Datei. Beides steht im
 * Ereignis, das der Aufrufer baut. Nur dadurch ist die Faltung
 * wiederholbar: Dieselbe Folge ergibt immer denselben Bestand — auch
 * morgen, auch auf einem anderen Gerät.
 */
import type { AppState, BeanTrash, Settings } from '@/domain'
import type { Bean, Bag, Brew, Grinder, Water } from '@domain'
import { recompute } from '@/engine/learn'

// ── Ereignisse ────────────────────────────────────────────────────────

/** Was jedes Ereignis trägt, unabhängig von seiner Art. */
export interface Umschlag {
  id: string
  /** ISO-Zeitpunkt. Die Reihenfolge im Strom gilt, nicht diese Zahl. */
  at: string
  /** Schemaversion des Ereignisses selbst, nicht des Bestands. */
  v: 1
}

export type Nutzlast =
  // Bohnen
  | { art: 'bohne-angelegt'; bohne: Bean }
  | { art: 'bohne-geaendert'; beanId: string; patch: Partial<Bean> }
  | { art: 'bohne-geloescht'; beanId: string }
  | { art: 'bohne-zurueckgeholt'; papierkorb: BeanTrash }
  // Tüten
  | { art: 'tuete-angelegt'; bag: Bag }
  | { art: 'tuete-geaendert'; bagId: string; patch: Partial<Bag> }
  | { art: 'tuete-geloescht'; bagId: string }
  // Durchgänge
  | { art: 'brew-protokolliert'; brew: Brew }
  | { art: 'brew-geaendert'; brewId: string; patch: Partial<Brew> }
  | { art: 'brew-geloescht'; brewId: string }
  | { art: 'referenz-gesetzt'; brewId: string }
  // Geräte
  | { art: 'muehle-angelegt'; grinder: Grinder }
  | { art: 'muehle-geaendert'; grinderId: string; patch: Partial<Grinder> }
  | { art: 'muehle-geloescht'; grinderId: string }
  | { art: 'wasser-gesetzt'; water: Water }
  // Einstellungen
  | { art: 'einstellungen-geaendert'; patch: Partial<Settings> }
  // Grobes
  | { art: 'bestand-ersetzt'; state: AppState }
  | { art: 'bestand-geleert'; state: AppState }

export type Ereignis = Umschlag & Nutzlast

/** Arten, nach denen NICHT neu gelernt werden muss — sie berühren keine Brews. */
const OHNE_LERNEN = new Set([
  'bohne-angelegt',
  'tuete-angelegt',
  'muehle-angelegt',
  'muehle-geaendert',
  'muehle-geloescht',
  'wasser-gesetzt',
  'einstellungen-geaendert',
])

export function brauchtLernen(e: Ereignis): boolean {
  return !OHNE_LERNEN.has(e.art)
}

// ── Die Faltung ───────────────────────────────────────────────────────

/**
 * Ein Ereignis auf einen Bestand anwenden. Rein, ohne Seiteneffekte.
 *
 * `learned` wird hier NICHT berechnet. Das ist Absicht: Die Lernmodelle
 * sind eine Ableitung aus allen Durchgängen, und sie je Ereignis neu zu
 * rechnen wäre genau der Aufwand, den diese Umstellung beseitigen soll.
 * Der Aufrufer rechnet sie einmal am Ende — siehe `falte()`.
 */
export function anwenden(s: AppState, e: Ereignis): AppState {
  switch (e.art) {
    case 'bohne-angelegt':
      return { ...s, beans: [...s.beans, e.bohne] }

    case 'bohne-geaendert':
      return { ...s, beans: s.beans.map((x) => (x.id === e.beanId ? { ...x, ...e.patch } : x)) }

    /**
     * Mit der Bohne gehen ihre Tüten UND ihre Protokolle. Bei einer
     * Bohne, die seit Monaten läuft, ist das die Datenbasis, aus der
     * die App gelernt hat — deshalb trägt `bohne-zurueckgeholt` alles
     * wieder ein, statt sich auf ein Rückgängig im Speicher zu verlassen.
     */
    case 'bohne-geloescht':
      return {
        ...s,
        beans: s.beans.filter((x) => x.id !== e.beanId),
        bags: s.bags.filter((x) => x.beanId !== e.beanId),
        brews: s.brews.filter((x) => x.beanId !== e.beanId),
      }

    case 'bohne-zurueckgeholt': {
      const { bean, bags, brews } = e.papierkorb
      // Nur einfügen, was fehlt: Zweimal „Rückgängig" darf keine
      // Dubletten anlegen.
      return {
        ...s,
        beans: s.beans.some((x) => x.id === bean.id) ? s.beans : [...s.beans, bean],
        bags: [...s.bags, ...bags.filter((b) => !s.bags.some((x) => x.id === b.id))],
        brews: [...s.brews, ...brews.filter((b) => !s.brews.some((x) => x.id === b.id))],
      }
    }

    case 'tuete-angelegt':
      return { ...s, bags: [...s.bags, e.bag] }

    case 'tuete-geaendert':
      return { ...s, bags: s.bags.map((x) => (x.id === e.bagId ? { ...x, ...e.patch } : x)) }

    case 'tuete-geloescht':
      return {
        ...s,
        bags: s.bags.filter((x) => x.id !== e.bagId),
        brews: s.brews.filter((x) => x.bagId !== e.bagId),
      }

    /**
     * Ein protokollierter Durchgang verändert drei Dinge auf einmal: die
     * Liste, die Restmenge der Tüte und die Vorbelegung fürs nächste Mal.
     * Das gehört zusammen in EIN Ereignis — sonst kann eine Faltung
     * zwischen zweien stehen bleiben und einen Bestand erzeugen, den es
     * nie gab.
     */
    case 'brew-protokolliert': {
      const dosis = e.brew.actual.doseG
      return {
        ...s,
        brews: [e.brew, ...s.brews],
        bags: s.bags.map((bag) =>
          bag.id === e.brew.bagId && bag.remainingGrams !== undefined
            ? {
                ...bag,
                remainingGrams: Math.max(0, Math.round((bag.remainingGrams - dosis) * 10) / 10),
                depleted: bag.remainingGrams - dosis <= 0,
              }
            : bag,
        ),
        settings: { ...s.settings, lastBeanId: e.brew.beanId, lastMethod: e.brew.method },
      }
    }

    case 'brew-geaendert':
      return { ...s, brews: s.brews.map((x) => (x.id === e.brewId ? { ...x, ...e.patch } : x)) }

    case 'brew-geloescht':
      return { ...s, brews: s.brews.filter((x) => x.id !== e.brewId) }

    case 'referenz-gesetzt': {
      const ziel = s.brews.find((b) => b.id === e.brewId)
      if (!ziel) return s
      // Je Bohne und Methode genau eine Referenz — die alte verliert die
      // Markierung im selben Zug.
      return {
        ...s,
        brews: s.brews.map((b) =>
          b.beanId === ziel.beanId && b.method === ziel.method
            ? { ...b, isBest: b.id === e.brewId }
            : b,
        ),
      }
    }

    case 'muehle-angelegt':
      return {
        ...s,
        grinders: [...s.grinders, e.grinder],
        // Die erste Mühle wird automatisch die aktive. Jede weitere nicht:
        // Sonst würde das Anlegen einer Zweitmühle die Hauptmühle ablösen.
        settings: s.settings.activeGrinderId
          ? s.settings
          : { ...s.settings, activeGrinderId: e.grinder.id },
      }

    case 'muehle-geaendert':
      return {
        ...s,
        grinders: s.grinders.map((x) => (x.id === e.grinderId ? { ...x, ...e.patch } : x)),
      }

    case 'muehle-geloescht':
      return {
        ...s,
        grinders: s.grinders.filter((x) => x.id !== e.grinderId),
        settings:
          s.settings.activeGrinderId === e.grinderId
            ? { ...s.settings, activeGrinderId: undefined }
            : s.settings,
      }

    case 'wasser-gesetzt':
      return {
        ...s,
        waters: s.waters.some((x) => x.id === e.water.id)
          ? s.waters.map((x) => (x.id === e.water.id ? e.water : x))
          : [...s.waters, e.water],
        settings: { ...s.settings, activeWaterId: e.water.id },
      }

    case 'einstellungen-geaendert':
      return { ...s, settings: { ...s.settings, ...e.patch } }

    /**
     * Import und Zurücksetzen tragen den vollständigen Bestand im
     * Ereignis. Das ist der größte Eintrag im Strom und der einzige, der
     * die Vergangenheit fachlich beendet — aber er löscht sie nicht: Die
     * Ereignisse davor bleiben lesbar.
     */
    case 'bestand-ersetzt':
    case 'bestand-geleert':
      return e.state

    default: {
      // Ein unbekanntes Ereignis darf den Bestand nicht beschädigen.
      // Kommt vor, wenn eine ältere Fassung der App einen neueren Strom
      // liest — dann wird übersprungen, nicht geraten.
      const unbekannt: never = e
      void unbekannt
      return s
    }
  }
}

/**
 * Den ganzen Strom zu einem Bestand falten.
 *
 * `jetzt` steht im Parameter und nicht in der Funktion, weil die
 * Lernmodelle Frische einrechnen. Ohne das wäre dieselbe Folge morgen
 * ein anderer Bestand — und der Selbsttest beim Start würde grundlos
 * Abweichungen melden.
 */
export function falte(strom: Ereignis[], basis: AppState, jetzt: Date): AppState {
  const roh = strom.reduce(anwenden, basis)
  return { ...roh, learned: recompute(roh.brews, roh.beans, roh.bags, jetzt) }
}
