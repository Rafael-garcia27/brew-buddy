/**
 * Der Durchgang als Zustandsautomat.
 *
 * Die Phasen standen als Zeichenkette im Bildschirm, die Übergänge als
 * Kette von `if`s, und was beim Zurückgehen passiert, an drei Stellen.
 * Das ist kein Schönheitsfehler: Ein Durchgang IST ein Automat, und
 * solange er nirgends steht, muss jede Stelle ihn im Kopf haben.
 *
 * Hier steht er einmal — ohne React, ohne Browser, prüfbar.
 */

export type Phase = 'proposal' | 'laeuft' | 'record' | 'check' | 'taste' | 'result'

/**
 * Wohin „zurück" führt.
 *
 * `'verlassen'` heißt: aus dem Durchgang heraus, zurück zur Bohne.
 * `'neu'` heißt: Durchgang beenden und von vorn beginnen — aus dem
 * Ergebnis führt kein Weg zurück in die Erfassung, der Brew ist
 * protokolliert. Ihn nachträglich zu ändern wäre eine andere Handlung
 * als „zurück".
 */
export type Rueckweg = Phase | 'verlassen' | 'neu'

export const ZURUECK: Record<Phase, Rueckweg> = {
  proposal: 'verlassen',
  laeuft: 'proposal',
  record: 'proposal',
  check: 'record',
  taste: 'check',
  result: 'neu',
}

/** Der reguläre Weg nach vorn. */
export const WEITER: Record<Phase, Phase | null> = {
  proposal: 'laeuft',
  laeuft: 'record',
  record: 'check',
  check: 'taste',
  taste: 'result',
  result: null,
}

/**
 * Welche Eingaben ein Zustandswechsel verwirft.
 *
 * Vorher rief der Zurück-Pfeil im Auswertungsschritt `reset()` — wer
 * zurücktippte, um eine Sekunde zu korrigieren, verlor Zeit, Fluss und
 * Bewertung und stand wieder am Startpunkt. Ein Zurück-Pfeil, der Daten
 * löscht, ist keiner.
 *
 * Deshalb steht hier ausdrücklich, dass rückwärts NICHTS verworfen wird.
 * Geleert wird nur beim Neubeginn.
 */
export const VERWIRFT_BEIM_ZURUECK = false

/**
 * Darf man von hier nach dort?
 *
 * Nicht jeder Sprung ist erlaubt: Aus dem Ergebnis zurück in die
 * Erfassung wäre eine nachträgliche Änderung an einem protokollierten
 * Durchgang, und vom Startpunkt direkt ins Verkosten hieße, einen Shot
 * zu bewerten, den es nicht gab.
 */
export function erlaubt(von: Phase, nach: Phase): boolean {
  if (WEITER[von] === nach) return true
  if (ZURUECK[von] === nach) return true
  // Eine Empfehlung zu übernehmen führt vom Ergebnis zurück an den
  // Startpunkt — der einzige Sprung über mehrere Stufen.
  if (von === 'result' && nach === 'proposal') return true
  // Abbrechen aus dem laufenden Durchgang.
  if (von === 'laeuft' && nach === 'proposal') return true
  return false
}
