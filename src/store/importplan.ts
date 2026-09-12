/**
 * Was ein Import ersetzt — in Zahlen, bevor er es tut.
 *
 * Befund F-08. `replaceState` tauscht den gesamten Bestand aus. Davor
 * stand eine Rückfrage, aber eine inhaltsleere: „Alle aktuellen Daten
 * werden durch die Sicherung ersetzt. Fortfahren?" Wer im Dateiwähler
 * die falsche von drei Sicherungen erwischt, liest darin nichts, was ihn
 * stutzig machen könnte.
 *
 * Für eine App ohne Server ist ein falscher Import der zweite Weg, alles
 * zu verlieren — der erste war F-01. Deshalb steht hier, was geht und was
 * kommt, und zwar in Zahlen, die man vergleichen kann.
 *
 * Ohne Browser-Schnittstellen, aus demselben Grund wie `startup.ts`.
 */
import type { AppState } from '@/domain'

export interface Bestandszahlen {
  beans: number
  bags: number
  brews: number
  grinders: number
}

export interface Importplan {
  /** Was jetzt da ist und verschwindet. */
  alt: Bestandszahlen
  /** Was die Datei mitbringt. */
  neu: Bestandszahlen
  /**
   * Gesetzt, wenn am Vergleich etwas auffällig ist. Keine Sperre — nur
   * der Satz, der jemanden innehalten lässt, bevor er tippt.
   */
  warnung?: string
}

function zahlen(s: AppState): Bestandszahlen {
  return {
    beans: s.beans.length,
    bags: s.bags.length,
    brews: s.brews.length,
    grinders: s.grinders.length,
  }
}

export function importplan(alt: AppState, neu: AppState): Importplan {
  const a = zahlen(alt)
  const n = zahlen(neu)

  /**
   * Die Reihenfolge ist Absicht: erst die Fälle, in denen etwas
   * verschwindet, dann der harmlose. Es soll immer der schwerwiegendste
   * Satz stehen, nicht der zuerst zutreffende.
   */
  let warnung: string | undefined
  if (a.beans + a.bags + a.brews === 0) {
    // Nichts zu verlieren — dann ist auch keine Warnung nötig.
    warnung = undefined
  } else if (n.beans + n.bags + n.brews === 0) {
    warnung = 'Die Sicherung ist leer. Danach ist dein Bestand weg und nichts an seiner Stelle.'
  } else if (n.brews < a.brews) {
    const weniger = a.brews - n.brews
    warnung = `Die Sicherung enthält ${weniger} ${weniger === 1 ? 'Brew' : 'Brews'} weniger als dein aktueller Bestand — sie ist vermutlich älter.`
  }

  return warnung === undefined ? { alt: a, neu: n } : { alt: a, neu: n, warnung }
}

/** „2 Bohnen, 1 Bag, 14 Brews" — was in einen Satz gehört, ohne Mühlen. */
export function bestandssatz(z: Bestandszahlen): string {
  const teile = [
    `${z.beans} ${z.beans === 1 ? 'Bohne' : 'Bohnen'}`,
    `${z.bags} ${z.bags === 1 ? 'Bag' : 'Bags'}`,
    `${z.brews} ${z.brews === 1 ? 'Brew' : 'Brews'}`,
  ]
  return teile.join(', ')
}
