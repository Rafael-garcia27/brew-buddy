export const APP_NAME = 'Café'

/**
 * Welcher Stand läuft.
 *
 * Anlass ist Befund F-04: In der ganzen Oberfläche stand keine Version.
 * Wer sagen will „bei mir tut X nicht", konnte nicht sagen, welches X.
 * Die Nummer allein hilft dabei nicht — sie steht seit dem ersten Tag auf
 * 0.1.0 —, deshalb steht der Commit daneben.
 */
export const APP_BUILD = {
  version: __APP_VERSION__,
  commit: __APP_COMMIT__,
  built: __APP_BUILT__,
} as const
export const APP_TAGLINE = 'Dein Dial-in, nicht irgendeins'
export const SCHEMA_VERSION = 4

/** Im Siebträger verbaute Mühle — nur unter Espresso wählbar. */
export const INTEGRATED_GRINDER_ID = 'sage-barista-express'

/** Ab wie vielen guten Brews die Personalisierung greift (Solution Design §6.3) */
export const LEARN_THRESHOLDS = {
  /** (Bohne, Methode): persönlicher Startpunkt ersetzt den Default */
  perBean: 3,
  /** Methode gesamt: systematischer Bias wird berechnet */
  bias: 12,
  /** Bias wird dem Nutzer als Aussage gezeigt */
  biasStatement: 20,
} as const

/** Ab welchem Rating ein Brew als „gut" zählt */
export const GOOD_RATING = 4

/** Erinnerung an die Datensicherung nach so vielen Tagen (iOS-Eviction) */
export const BACKUP_REMINDER_DAYS = 14
