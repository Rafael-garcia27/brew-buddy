/**
 * Ländergeometrie für die Herkunftskarte.
 *
 * Eigenes Modul und NICHT Teil von `@/kb`: Die Datei ist rund 40 KB
 * gepackt, und wer nur brüht, braucht sie nie. Über `@/kb` importiert
 * hätte sie im Hauptbündel gelegen und jeden Kaltstart verlängert —
 * jetzt lädt sie erst, wenn das Profil geöffnet wird. Der Service Worker
 * legt das Teilbündel trotzdem vorab ab, offline fehlt also nichts.
 *
 * Erzeugt aus Natural Earth 110m (gemeinfrei) durch
 * `scripts/make-worldmap.mjs` — siehe dort für Projektion und Ausschnitt.
 */
import worldmapRaw from '@data/worldmap.json'

export interface MapCountry {
  /** ISO-3166-1 alpha-3 */
  iso: string
  /** Deutscher Ländername — dieselbe Schreibweise wie in origins.json */
  name: string
  /** SVG-Pfad, mehrere Teilflächen aneinandergehängt */
  d: string
  /** Umschließendes Rechteck in Kartenkoordinaten: [x0, y0, x1, y1] */
  b: [number, number, number, number]
  /** Kaffeeerzeuger mit Schwerpunkt in den Tropen */
  belt?: boolean
}

export interface WorldMap {
  viewBox: string
  /** y-Werte der Wendekreise im Koordinatensystem der Karte */
  tropics: { cancer: number; capricorn: number }
  equator: number
  countries: MapCountry[]
}

export const WORLD_MAP = worldmapRaw as unknown as WorldMap

/** Land über den deutschen Namen, wie ihn die Bohne führt. */
export function mapCountry(name: string): MapCountry | undefined {
  const gesucht = name.trim().toLowerCase()
  return WORLD_MAP.countries.find((c) => c.name.toLowerCase() === gesucht)
}
