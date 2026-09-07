/**
 * Herkunftskarte — wo diese Bohne wächst.
 *
 * Vier Zustände, wie sie die Bohne hergibt:
 *   unbekannt      → nur Umriss, nichts eingefärbt
 *   Blend, offen   → der ganze Kaffeegürtel
 *   Blend, benannt → die genannten Bestandteile
 *   ein Land       → genau dieses Land
 *
 * Der dritte Zustand ist der Grund, warum ein Blend seine Länder nennen
 * darf: „irgendwo im Gürtel" ist die ehrliche Antwort, wenn man es nicht
 * weiß — aber wer es weiß, soll es sehen.
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
import { BLEND, COUNTRIES, findCountry } from '@/kb'
import { WORLD_MAP } from '@/kb/worldmap'

/**
 * Bis zu dieser Kantenlänge (in Kartenschritten, 1 Schritt = 1 Grad)
 * bekommt die Auswahl einen Suchring. Brasilien misst 39, Indien 29,
 * Kenia 10 — der Ring erscheint also dort, wo das Auge ihn braucht.
 */
const RING_BIS = 35

export type MapState = 'unknown' | 'belt' | 'countries'

/** Die genannten Länder einer Bohne als ISO-Kennungen, ohne Dubletten. */
export function originCountries(origins: OriginRef[] | undefined): string[] {
  const iso: string[] = []
  for (const o of origins ?? []) {
    const name = o.country?.trim()
    if (!name || name === BLEND) continue
    const c = findCountry(name)
    if (c && !iso.includes(c.iso)) iso.push(c.iso)
  }
  return iso
}

export function originMapState(origins: OriginRef[] | undefined): MapState {
  if (originCountries(origins).length) return 'countries'
  // Blend ohne benannte Bestandteile: der Gürtel ist die ehrliche Antwort.
  const angaben = (origins ?? []).map((o) => o.country?.trim()).filter(Boolean) as string[]
  return angaben.includes(BLEND) ? 'belt' : 'unknown'
}

export default function OriginMap({
  origins,
  className = '',
}: {
  origins: OriginRef[] | undefined
  className?: string
}) {
  const state = originMapState(origins)

  const { rest, hervorgehoben, ring, namen, ohneGeometrie } = useMemo(() => {
    const gewaehlteIso = originCountries(origins)
    const treffer = new Set<string>(
      state === 'belt' ? COUNTRIES.filter((c) => c.belt).map((c) => c.iso) : gewaehlteIso,
    )

    // Alles Nicht-Hervorgehobene zu EINEM Pfad zusammenfassen: Jeder Ring
    // bleibt eine eigene Teilfläche, die Kontur zeichnet also weiter jede
    // Ländergrenze — nur eben in einem Element statt in 170.
    const rest = WORLD_MAP.paths
      .filter((p) => !treffer.has(p.iso))
      .map((p) => p.d)
      .join('')
    const gewaehlt = WORLD_MAP.paths.filter((p) => treffer.has(p.iso))
    const hervorgehoben = gewaehlt.map((p) => p.d).join('')

    /**
     * Suchring um kleine Auswahlen.
     *
     * Kenia ist auf einer Weltkarte 8 × 10 Kartenschritte groß — bei
     * 307 px Breite ein Fleck von 7 × 9 px. Eingefärbt ist es damit
     * korrekt und trotzdem nicht zu finden. Der Ring färbt nichts, er
     * zeigt hin; über zwei Kontinente verteilt bringt er nichts und
     * bleibt weg.
     */
    let ring: { cx: number; cy: number; r: number } | null = null
    if (state === 'countries' && gewaehlt.length) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (const p of gewaehlt) {
        x0 = Math.min(x0, p.b[0])
        y0 = Math.min(y0, p.b[1])
        x1 = Math.max(x1, p.b[2])
        y1 = Math.max(y1, p.b[3])
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

    const namen = gewaehlteIso
      .map((iso) => COUNTRIES.find((c) => c.iso === iso)?.de)
      .filter(Boolean) as string[]

    // Ein genanntes Land ohne Pfad liegt außerhalb des Ausschnitts —
    // gültig als Eingabe, nur nicht zeichenbar. Das gehört gesagt, sonst
    // sieht die Karte aus wie „Herkunft unbekannt".
    const ohneGeometrie = gewaehlteIso
      .filter((iso) => !WORLD_MAP.paths.some((p) => p.iso === iso))
      .map((iso) => COUNTRIES.find((c) => c.iso === iso)?.de)
      .filter(Boolean) as string[]

    return { rest, hervorgehoben, ring, namen, ohneGeometrie }
  }, [origins, state])

  const beschriftung =
    state === 'belt'
      ? 'Blend ohne benannte Herkunft — irgendwo im Kaffeegürtel.'
      : state === 'countries'
        ? ohneGeometrie.length === namen.length
          ? `${namen.join(', ')} — liegt außerhalb des gezeigten Ausschnitts.`
          : namen.length > 1
            ? `Blend aus ${namen.length} Herkünften: ${namen.join(', ')}.`
            : 'Zwischen den Wendekreisen — dem Kaffeegürtel.'
        : 'Keine Herkunft angegeben.'

  const kurz =
    state === 'belt'
      ? 'Weltkarte, der Kaffeegürtel hervorgehoben'
      : state === 'countries'
        ? `Weltkarte, hervorgehoben: ${namen.join(', ')}`
        : 'Weltkarte ohne Hervorhebung'

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-xl border border-line bg-paper">
        <svg viewBox={WORLD_MAP.viewBox} className="block w-full" role="img" aria-label={kurz}>
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
