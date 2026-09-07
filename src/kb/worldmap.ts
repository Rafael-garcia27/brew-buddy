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

export interface MapPath {
  /** ISO-3166-1 alpha-3 — Name und Gürtelzugehörigkeit stehen in COUNTRIES */
  iso: string
  /** SVG-Pfad, mehrere Teilflächen aneinandergehängt */
  d: string
  /** Umschließendes Rechteck in Kartenkoordinaten: [x0, y0, x1, y1] */
  b: [number, number, number, number]
}

export interface WorldMap {
  viewBox: string
  /** y-Werte der Wendekreise im Koordinatensystem der Karte */
  tropics: { cancer: number; capricorn: number }
  equator: number
  paths: MapPath[]
}

export const WORLD_MAP = worldmapRaw as unknown as WorldMap

/** Geometrie eines Landes über seine ISO-Kennung. */
export function mapPath(iso: string): MapPath | undefined {
  return WORLD_MAP.paths.find((p) => p.iso === iso)
}
