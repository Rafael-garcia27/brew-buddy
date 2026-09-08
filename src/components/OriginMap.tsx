/**
 * Herkunftskarte — wo diese Bohne wächst.
 *
 * Unter der Karte steht eine Legende, kein Fließtext. Der Unterschied ist
 * nicht kosmetisch: Ein Satz wie „Blend aus 3 Herkünften: Brasilien,
 * Kolumbien, Äthiopien" nennt drei Länder, die alle in derselben Farbe
 * eingezeichnet sind — man kann sie im Bild nicht auseinanderhalten. Die
 * Legende gibt jeder Herkunft eine eigene Farbe und bindet sie an ihren
 * Fleck auf der Karte. Erst damit ergänzt der Text die Grafik, statt sie
 * zu wiederholen.
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
import { BLEND, COUNTRIES, findCountry, flavorLabel, getOrigin } from '@/kb'
import { WORLD_MAP } from '@/kb/worldmap'

/**
 * Bis zu dieser Kantenlänge (in Kartenschritten, 1 Schritt = 1 Grad)
 * bekommt die Auswahl einen Suchring. Brasilien misst 39, Indien 29,
 * Kenia 10 — der Ring erscheint also dort, wo das Auge ihn braucht.
 */
const RING_BIS = 35

/**
 * So viele Herkünfte bekommen eine eigene Farbe.
 *
 * Fünf Töne liegen in src/index.css. Mehr wären keine Unterscheidung
 * mehr, sondern eine Wiederholung — zwei Länder in derselben Farbe machen
 * die Legende unlesbar. Darüber färbt die Karte einheitlich und die
 * Legende verzichtet auf Farbtupfer, statt eine Zuordnung zu behaupten.
 */
const MAX_FARBEN = 5

export type MapState = 'unknown' | 'belt' | 'countries'

/** Eine Zeile der Legende: was auf der Karte in dieser Farbe steht. */
export interface LegendEntry {
  iso: string
  name: string
  /** CSS-Farbe, oder undefined wenn zu viele Herkünfte für Einzelfarben. */
  color?: string
  /** Region, Farm oder Anteil — was die Bohne selbst mitgibt. */
  detail?: string
  /** Der Charakter der Herkunft aus der Wissensbasis. */
  character?: string
  /** Genanntes Land, das im gezeigten Ausschnitt nicht liegt. */
  offMap?: boolean
}

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

/**
 * Die Legende zur Karte — aufgebaut, bevor gezeichnet wird.
 *
 * Exportiert, weil hier die Zuordnung Farbe → Land entsteht. Wenn die
 * Legende und die Karte je eine eigene Reihenfolge hätten, würden sie
 * sich irgendwann widersprechen; so gibt es nur eine.
 */
export function originLegend(origins: OriginRef[] | undefined): LegendEntry[] {
  const iso = originCountries(origins)
  const einzeln = iso.length <= MAX_FARBEN

  return iso.map((code, i) => {
    const land = COUNTRIES.find((c) => c.iso === code)
    const name = land?.de ?? code
    // Der erste Eintrag der Bohne zu diesem Land — Region und Farm
    // hängen an der Nennung, nicht am Land.
    const ref = (origins ?? []).find((o) => findCountry(o.country ?? '')?.iso === code)

    const teile: string[] = []
    if (ref?.region) teile.push(ref.region)
    if (ref?.farm) teile.push(ref.farm)
    if (typeof ref?.sharePct === 'number') teile.push(`${ref.sharePct} %`)

    // Kein Freitext vom Nutzer? Dann sagt die Wissensbasis, wofür das
    // Land steht. Zwei Noten, nicht fünf: Die Legende soll die Karte
    // ergänzen, nicht das Herkunftsprofil ersetzen.
    const profil = getOrigin(name)
    const character = profil?.flavorProfile?.slice(0, 3).map(flavorLabel).join(', ')

    return {
      iso: code,
      name,
      color: einzeln ? `var(--c-origin-${i + 1})` : undefined,
      detail: teile.length ? teile.join(' · ') : undefined,
      character: character || undefined,
      offMap: !WORLD_MAP.paths.some((p) => p.iso === code),
    }
  })
}

export default function OriginMap({
  origins,
  className = '',
}: {
  origins: OriginRef[] | undefined
  className?: string
}) {
  const state = originMapState(origins)

  const legende = useMemo(() => originLegend(origins), [origins])

  const { grund, flaechen, ring } = useMemo(() => {
    const treffer =
      state === 'belt'
        ? COUNTRIES.filter((c) => c.belt).map((c) => c.iso)
        : legende.map((l) => l.iso)
    const menge = new Set(treffer)

    // Alles Nicht-Hervorgehobene zu EINEM Pfad zusammenfassen: Jeder Ring
    // bleibt eine eigene Teilfläche, die Kontur zeichnet also weiter jede
    // Ländergrenze — nur eben in einem Element statt in 170.
    const grund = WORLD_MAP.paths
      .filter((p) => !menge.has(p.iso))
      .map((p) => p.d)
      .join('')

    /**
     * Eine Fläche je Farbe.
     *
     * Beim Gürtel ist das eine Fläche in Akzentfarbe; bei benannten
     * Herkünften eine je Land in seiner Legendenfarbe. Dass beide Fälle
     * denselben Weg nehmen, ist der Grund, warum Karte und Legende nicht
     * auseinanderlaufen können.
     */
    const flaechen: { d: string; color: string }[] =
      state === 'belt'
        ? [
            {
              d: WORLD_MAP.paths
                .filter((p) => menge.has(p.iso))
                .map((p) => p.d)
                .join(''),
              color: 'var(--c-crema)',
            },
          ]
        : legende
            .map((l) => ({
              d: WORLD_MAP.paths
                .filter((p) => p.iso === l.iso)
                .map((p) => p.d)
                .join(''),
              color: l.color ?? 'var(--c-crema)',
            }))
            .filter((f) => f.d)

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
    const gewaehlt = WORLD_MAP.paths.filter((p) => menge.has(p.iso))
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

    return { grund, flaechen, ring }
  }, [legende, state])

  const kurz =
    state === 'belt'
      ? 'Weltkarte, der Kaffeegürtel hervorgehoben'
      : state === 'countries'
        ? `Weltkarte, hervorgehoben: ${legende.map((l) => l.name).join(', ')}`
        : 'Weltkarte ohne Hervorhebung'

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-xl border border-line bg-paper">
        <svg viewBox={WORLD_MAP.viewBox} className="block w-full" role="img" aria-label={kurz}>
          {/* Landmasse mit sichtbaren Grenzen. non-scaling-stroke, damit
              die Linie 0,6 px bleibt, egal wie breit die Karte gerade
              gerechnet wird — sonst wäre sie auf dem Telefon ein Klecks. */}
          <path
            d={grund}
            fill="var(--c-line)"
            stroke="var(--c-mute)"
            strokeWidth="0.6"
            strokeOpacity="0.6"
            vectorEffect="non-scaling-stroke"
          />

          {flaechen.map((f) => (
            <path
              key={f.color + f.d.slice(0, 12)}
              d={f.d}
              fill={f.color}
              stroke={f.color}
              strokeWidth="0.8"
              vectorEffect="non-scaling-stroke"
            />
          ))}

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

      <MapLegend state={state} legende={legende} />
    </div>
  )
}

/**
 * Die Legende.
 *
 * Sie trägt drei verschiedene Nachrichten, je nachdem, was die Bohne
 * hergibt — und in zwei von drei Fällen ist die Nachricht „das wissen wir
 * nicht". Die gehört genauso dazu: Eine leere Karte ohne Erklärung sieht
 * aus wie ein Fehler.
 */
function MapLegend({ state, legende }: { state: MapState; legende: LegendEntry[] }) {
  if (state === 'unknown') {
    return (
      <p className="mt-2 text-[12px] leading-snug text-faint">
        Keine Herkunft angegeben. Sie ändert die Empfehlung — Herkunft, Röstgrad und Aufbereitung
        bestimmen gemeinsam, welche Methode passt.
      </p>
    )
  }

  if (state === 'belt') {
    return (
      <div className="mt-2.5">
        <LegendRow color="var(--c-crema)" name="Kaffeegürtel" />
        <p className="mt-1.5 text-[12px] leading-snug text-faint">
          Blend ohne benannte Herkunft — irgendwo zwischen den Wendekreisen. Wer die Bestandteile
          kennt, kann sie beim Bearbeiten nachtragen; die Karte zeigt sie dann einzeln.
        </p>
      </div>
    )
  }

  const ausserhalb = legende.filter((l) => l.offMap)

  return (
    <div className="mt-2.5">
      <div className="space-y-1.5">
        {legende.map((l) => (
          <LegendRow
            key={l.iso}
            color={l.color}
            name={l.name}
            detail={l.detail ?? l.character}
            muted={l.offMap}
          />
        ))}
      </div>

      {!legende[0]?.color && (
        <p className="mt-1.5 text-[12px] leading-snug text-faint">
          Über {MAX_FARBEN} Herkünfte zeichnet die Karte einheitlich — mehr Farben wären nicht mehr
          zu unterscheiden.
        </p>
      )}

      {/* Ein genanntes Land ohne Pfad liegt außerhalb des Ausschnitts —
          gültig als Eingabe, nur nicht zeichenbar. Das gehört gesagt,
          sonst sieht die Karte aus wie „Herkunft unbekannt". */}
      {ausserhalb.length > 0 && (
        <p className="mt-1.5 text-[12px] leading-snug text-faint">
          {ausserhalb.map((l) => l.name).join(', ')}{' '}
          {ausserhalb.length === 1 ? 'liegt' : 'liegen'} außerhalb des gezeigten Ausschnitts — die
          Karte endet am 58. Breitengrad, wo kein Kaffee mehr wächst.
        </p>
      )}
    </div>
  )
}

function LegendRow({
  color,
  name,
  detail,
  muted,
}: {
  color?: string
  name: string
  detail?: string
  muted?: boolean
}) {
  return (
    <div className="flex items-baseline gap-2">
      {color ? (
        <span
          className="mt-[3px] h-2.5 w-2.5 shrink-0 self-start rounded-[3px] border border-line"
          style={{ background: color, opacity: muted ? 0.4 : 1 }}
          aria-hidden
        />
      ) : (
        <span className="mt-[3px] h-2.5 w-2.5 shrink-0 self-start" aria-hidden />
      )}
      <span className={`text-[13px] font-medium ${muted ? 'text-faint' : ''}`}>{name}</span>
      {detail && <span className="min-w-0 flex-1 truncate text-[12px] text-faint">{detail}</span>}
    </div>
  )
}
