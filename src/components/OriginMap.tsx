/**
 * Herkunftskarte — wo diese Bohne wächst.
 *
 * Drei Zustände, wie sie die Bohne hergibt:
 *   unbekannt → nur Umriss, nichts eingefärbt
 *   Blend     → der ganze Kaffeegürtel
 *   bekannt   → genau das Land
 *
 * Die Geometrie kommt aus Natural Earth (data/worldmap.json), nicht aus
 * dem Gedächtnis: Eine selbst gezeichnete Karte sieht auf den ersten
 * Blick richtig aus und ist beim zweiten falsch.
 *
 * Die Wendekreise sind die eigentliche Aussage der Karte. Kaffee wächst
 * zwischen ihnen, und zwar deshalb, weil die Pflanze weder Frost noch
 * dauerhafte Hitze verträgt (kb/04). Sie liegen deshalb über den Ländern
 * und nicht darunter.
 */
import { useMemo } from 'react'
import type { OriginRef } from '@domain'
import { WORLD_MAP, mapCountry } from '@/kb/worldmap'

/** Sammelwert aus dem Bohnenformular — dieselbe Zeichenkette wie dort. */
const BLEND = 'Blend'

/**
 * Bis zu dieser Kantenlänge (in Kartenschritten, 1 Schritt = 1 Grad)
 * bekommt ein Land einen Suchring. Brasilien misst 39, Indien 29,
 * Kenia 10 — der Ring erscheint also dort, wo das Auge ihn braucht.
 */
const RING_BIS = 35

export type MapState = 'unknown' | 'blend' | 'country'

export function originMapState(origins: OriginRef[] | undefined): MapState {
  const laender = (origins ?? []).map((o) => o.country?.trim()).filter(Boolean) as string[]
  if (!laender.length) return 'unknown'
  if (laender.some((l) => l === BLEND)) return 'blend'
  // Mehrere echte Länder sind fachlich auch ein Blend — dann zeigt die
  // Karte sie einzeln, siehe `hervorgehoben`.
  return laender.some((l) => mapCountry(l)) ? 'country' : 'unknown'
}

export default function OriginMap({
  origins,
  className = '',
}: {
  origins: OriginRef[] | undefined
  className?: string
}) {
  const state = originMapState(origins)

  const { rest, hervorgehoben, ring } = useMemo(() => {
    const namen = (origins ?? []).map((o) => o.country?.trim()).filter(Boolean) as string[]
    const treffer = new Set<string>()

    if (state === 'blend') {
      for (const c of WORLD_MAP.countries) if (c.belt) treffer.add(c.iso)
    } else if (state === 'country') {
      for (const n of namen) {
        const c = mapCountry(n)
        if (c) treffer.add(c.iso)
      }
    }

    // Alles Nicht-Hervorgehobene zu EINEM Pfad zusammenfassen: Jeder Ring
    // bleibt eine eigene Teilfläche, die Kontur zeichnet also weiter jede
    // Ländergrenze — nur eben in einem Element statt in 170.
    const rest = WORLD_MAP.countries
      .filter((c) => !treffer.has(c.iso))
      .map((c) => c.d)
      .join('')
    const gewaehlt = WORLD_MAP.countries.filter((c) => treffer.has(c.iso))
    const hervorgehoben = gewaehlt.map((c) => c.d).join('')

    /**
     * Suchring um kleine Länder.
     *
     * Kenia ist auf einer Weltkarte 8 × 10 Kartenschritte groß — bei
     * 307 px Breite ein Fleck von 7 × 9 px. Eingefärbt ist es damit
     * korrekt und trotzdem nicht zu finden. Der Ring färbt nichts, er
     * zeigt hin; ab Brasiliens Größe braucht es ihn nicht mehr.
     */
    let ring: { cx: number; cy: number; r: number } | null = null
    if (state === 'country' && gewaehlt.length) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (const c of gewaehlt) {
        x0 = Math.min(x0, c.b[0])
        y0 = Math.min(y0, c.b[1])
        x1 = Math.max(x1, c.b[2])
        y1 = Math.max(y1, c.b[3])
      }
      const breit = x1 - x0
      const hoch = y1 - y0
      if (Math.max(breit, hoch) < RING_BIS) {
        ring = {
          cx: (x0 + x1) / 2,
          cy: (y0 + y1) / 2,
          r: Math.max(9, Math.hypot(breit, hoch) / 2 + 4),
        }
      }
    }

    return { rest, hervorgehoben, ring }
  }, [origins, state])

  const beschriftung =
    state === 'blend'
      ? 'Blend — Herkunft über den Kaffeegürtel verteilt.'
      : state === 'country'
        ? 'Zwischen den Wendekreisen — dem Kaffeegürtel.'
        : 'Keine Herkunft angegeben.'

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-xl border border-line bg-paper">
        <svg
          viewBox={WORLD_MAP.viewBox}
          className="block w-full"
          role="img"
          aria-label={
            state === 'blend'
              ? 'Weltkarte, der Kaffeegürtel hervorgehoben'
              : state === 'country'
                ? `Weltkarte, hervorgehoben: ${(origins ?? []).map((o) => o.country).join(', ')}`
                : 'Weltkarte ohne Hervorhebung'
          }
        >
          {/* Landmasse mit sichtbaren Grenzen. non-scaling-stroke, damit
              die Linie 0,6 px bleibt, egal wie breit die Karte gerade
              gerechnet wird — sonst wäre sie auf dem Telefon ein Klecks. */}
          <path
            d={rest}
            fill="var(--c-line)"
            stroke="var(--c-mute)"
            strokeWidth="0.6"
            strokeOpacity="0.6"
            vectorEffect="non-scaling-stroke"
          />

          {hervorgehoben && (
            <path
              d={hervorgehoben}
              fill="var(--c-crema)"
              stroke="var(--c-crema)"
              strokeWidth="0.8"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {ring && (
            <circle
              cx={ring.cx}
              cy={ring.cy}
              r={ring.r}
              fill="none"
              stroke="var(--c-crema)"
              strokeWidth="1.2"
              strokeOpacity="0.7"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Wendekreise: die Grenzen des Gürtels, gestrichelt über allem */}
          {[WORLD_MAP.tropics.cancer, WORLD_MAP.tropics.capricorn].map((y) => (
            <line
              key={y}
              x1="0"
              x2="360"
              y1={y}
              y2={y}
              stroke="var(--c-crema)"
              strokeWidth="0.7"
              strokeOpacity="0.5"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <p className="mt-1.5 text-[12px] leading-snug text-faint">{beschriftung}</p>
    </div>
  )
}
