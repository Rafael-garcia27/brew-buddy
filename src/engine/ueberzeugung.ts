/**
 * Überzeugung statt Schwellenwert.
 *
 * Briefing B1: „Der SCA-Zielkorridor ist nur der Startwert, nicht das
 * Ziel. Die Norm ist der Prior, die Historie überschreibt ihn."
 *
 * Das beschreibt ein Verfahren, ohne es zu benennen: Man beginnt bei der
 * Norm und verschiebt sich zur eigenen Erfahrung — und zwar so weit, wie
 * diese Erfahrung trägt. Gebaut war stattdessen eine Kante: Unter zwölf
 * Durchgängen gar kein Bias, ab zwölf der volle. Der zwölfte Shot
 * verschob den Startpunkt um einen Sprung, den kein einzelner Shot
 * rechtfertigt.
 *
 * ## Warum hier kein Mittel über die Quellen steht
 *
 * Der Entwurf zu 2.0 wollte die Prioritätskette des Startpunkts durch
 * ein gewichtetes Mittel aller Quellen ersetzen. Beim Lesen des
 * Briefings hat sich das als falsch herausgestellt: „überschreibt" heißt
 * nicht „wird gemittelt mit". Ein Mittel aus dem besten eigenen Shot und
 * dem Methodenstandard ist schlechter als der beste eigene Shot — die
 * Kette bleibt.
 *
 * Gewichtet wird dort, wo tatsächlich zwei Aussagen gegeneinander stehen:
 * beim gelernten Bias gegen die Norm.
 *
 * Rein funktional, deterministisch (B8). Gewichtete Mittel, keine
 * Stichproben: gleiche Datenlage, gleiche Zahl.
 */

/** Woran sich die Tragfähigkeit eines gelernten Werts bemisst. */
export interface Ueberzeugung {
  /** Wie viele Durchgänge dahinterstehen. */
  n: number
  /**
   * Wie einig sich die Belege sind — Standardabweichung in der Einheit
   * des Werts. 0 heißt: alle sagen dasselbe.
   */
  streuung: number
  /** Tage seit dem jüngsten Beleg. */
  alter: number
}

/**
 * Ab wie vielen Belegen die Historie zur Hälfte zählt.
 *
 * Acht, weil eine Bohne typischerweise nach sechs bis zehn Durchgängen
 * eingemessen ist (kb/15 §2). Wer so weit gekommen ist, hat genug
 * gesehen, dass seine Vorliebe kein Zufall mehr ist — aber noch nicht so
 * viel, dass sie die Norm vollständig verdrängen dürfte.
 */
export const BELEGE_HALB = 8

/**
 * Ab welcher Streuung die Belege sich nur noch zur Hälfte zählen lassen.
 *
 * Bezogen auf den Wert selbst, nicht absolut: Ein Ratio-Bias von 0,3 mit
 * einer Streuung von 0,3 ist eine Aussage über nichts.
 */
export const STREUUNG_HALB = 1.0

/** Bis zu wie vielen Tagen ein Beleg als aktuell gilt. */
export const FRISCH_TAGE = 60

/** Wie weit ein alter Beleg mindestens noch zählt. */
export const ALTER_BODEN = 0.4

/**
 * Wie stark ein gelernter Wert gegen die Norm zählt — 0 bis 1.
 *
 * Drei Faktoren, alle zwischen 0 und 1, multipliziert. Jeder für sich
 * kann die Aussage entkräften: zu wenige Belege, zu uneinige Belege, zu
 * alte Belege.
 */
export function gewicht(u: Ueberzeugung): number {
  if (u.n <= 0) return 0
  const vertrauen = u.n / (u.n + BELEGE_HALB)
  const einigkeit = 1 / (1 + Math.max(0, u.streuung) / STREUUNG_HALB)
  const frische =
    u.alter <= FRISCH_TAGE ? 1 : Math.max(ALTER_BODEN, FRISCH_TAGE / Math.max(1, u.alter))
  return Math.round(vertrauen * einigkeit * frische * 1000) / 1000
}

/**
 * Von der Norm aus so weit zur eigenen Erfahrung, wie sie trägt.
 *
 * Bei Gewicht 0 bleibt die Norm stehen, bei 1 gilt die Erfahrung. Alles
 * dazwischen ist der Übergang, den die Kante vorher nicht hatte.
 */
export function kombiniere(norm: number, eigen: number, u: Ueberzeugung): number {
  return norm + (eigen - norm) * gewicht(u)
}

export type Sicherheitsstufe = 'sicher' | 'wahrscheinlich' | 'Versuch'

/**
 * Das Gewicht als Wort — dieselbe Skala, die die Diagnose benutzt.
 *
 * Bisher war „sicher / wahrscheinlich / Versuch" je Regel von Hand
 * vergeben. Aus dem Gewicht gerechnet sagt es etwas über die Datenlage
 * statt über die Meinung dessen, der die Regel geschrieben hat.
 */
export function stufe(g: number): Sicherheitsstufe {
  if (g >= 0.66) return 'sicher'
  if (g >= 0.33) return 'wahrscheinlich'
  return 'Versuch'
}

/** Die Standardabweichung einer Reihe. Leere Reihe: 0. */
export function streuung(werte: number[]): number {
  if (werte.length < 2) return 0
  const mittel = werte.reduce((a, b) => a + b, 0) / werte.length
  const varianz = werte.reduce((a, b) => a + (b - mittel) ** 2, 0) / (werte.length - 1)
  return Math.round(Math.sqrt(varianz) * 1000) / 1000
}
