/**
 * Das Logbuch als Kurve, nicht als Liste.
 *
 * Eine Liste zeigt Einträge. Eine Kurve zeigt, dass man besser geworden
 * ist — und das ist der Grund, warum die Historie überhaupt geführt
 * wird (Briefing A10). Dieselbe Datenbasis, eine andere Frage.
 */
import type { Brew, BrewMethod } from '@domain'
import type { Empfehlung } from '@/domain'
import { fmtClock } from '@/components/ui'

interface KurveProps {
  /** Chronologisch, ältester zuerst. */
  brews: Brew[]
  band?: [number, number]
  alsUhr: boolean
}

/**
 * Brühzeit über die Durchgänge, mit dem Zielband als Fläche.
 *
 * Die Achse beginnt nicht bei null: Bei einem Zielband von 22–28 s
 * würde eine Achse ab 0 den Bereich, um den es geht, auf ein Viertel der
 * Höhe quetschen. Der unterdrückte Nullpunkt steht in der Beschriftung.
 */
export function Lernkurve({ brews, band, alsUhr }: KurveProps) {
  const zeiten = brews.map((b) => b.actual.timeS).filter((t) => t > 0)
  if (zeiten.length < 2) return null

  const werte = [...zeiten, ...(band ?? [])]
  const luft = Math.max(2, (Math.max(...werte) - Math.min(...werte)) * 0.15)
  const yVon = Math.floor(Math.min(...werte) - luft)
  const yBis = Math.ceil(Math.max(...werte) + luft)

  const B = 268
  const H = 150
  const l = 30
  const r = 8
  const o = 12
  const u = 26

  const x = (i: number) => l + (i / Math.max(1, brews.length - 1)) * (B - l - r)
  const y = (v: number) => o + (1 - (v - yVon) / (yBis - yVon)) * (H - o - u)

  const punkte = brews.map((b, i) => ({
    x: x(i),
    y: y(b.actual.timeS),
    gut: (b.tasting?.rating ?? 0) >= 4,
    referenz: b.isBest,
    zeit: b.actual.timeS,
  }))

  const imBand = band
    ? brews.filter((b) => b.actual.timeS >= band[0] && b.actual.timeS <= band[1]).length
    : null

  const t = (v: number) => (alsUhr ? fmtClock(Math.round(v)) : String(Math.round(v)))

  return (
    <div>
      <svg
        viewBox={`0 0 ${B} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Brühzeit über ${brews.length} Durchgänge${
          band ? `, Zielband ${t(band[0])} bis ${t(band[1])}` : ''
        }${imBand !== null ? `, davon ${imBand} im Band` : ''}.`}
      >
        {band && (
          <rect
            x={l}
            y={y(band[1])}
            width={B - l - r}
            height={Math.max(2, y(band[0]) - y(band[1]))}
            fill="var(--c-ok)"
            opacity="0.12"
          />
        )}

        <g stroke="var(--c-line)" strokeWidth="1">
          <line x1={l} y1={y(yBis)} x2={B - r} y2={y(yBis)} opacity="0.5" />
          <line x1={l} y1={y(yVon)} x2={B - r} y2={y(yVon)} opacity="0.5" />
        </g>
        <g fill="var(--c-faint)" fontSize="9.5" textAnchor="end" className="tnum">
          <text x={l - 5} y={y(yBis) + 3}>{t(yBis)}</text>
          <text x={l - 5} y={y(yVon) + 3}>{t(yVon)}</text>
        </g>

        <polyline
          points={punkte.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="var(--c-line)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {punkte.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.referenz ? 6 : 4}
            fill={p.gut ? 'var(--c-crema)' : 'var(--c-mute)'}
            {...(p.referenz ? { stroke: 'var(--c-card)', strokeWidth: 2 } : {})}
          />
        ))}

        <g fill="var(--c-faint)" fontSize="9.5">
          <text x={l} y={H - 8}>älteste</text>
          <text x={B - r} y={H - 8} textAnchor="end">heute</text>
        </g>
      </svg>

      {imBand !== null && (
        <p className="mt-1 text-sm leading-snug text-mute">
          <b className="font-semibold text-ink">
            {imBand} von {brews.length}
          </b>{' '}
          im Zielband.
        </p>
      )}
    </div>
  )
}

interface KetteProps {
  empfehlungen: Empfehlung[]
  alsUhr: (m: BrewMethod) => boolean
  methodLabel: (m: BrewMethod) => string
}

/**
 * Ein Versuch ist ein Paar, kein Eintrag.
 *
 * „32 s → drei Klicks gröber → 27 s, Vorhersage getroffen" ist die
 * Einheit, in der man beim Einmessen denkt — und in der man nachschlägt,
 * was letztes Mal geholfen hat. In einer chronologischen Liste steht das
 * über zwei Einträge verteilt, die nichts voneinander wissen.
 */
export function Versuchskette({ empfehlungen, alsUhr, methodLabel }: KetteProps) {
  const abgerechnet = empfehlungen
    .filter((e) => e.einloesung && e.vorhersage)
    .sort((a, b) => b.at.localeCompare(a.at))

  if (!abgerechnet.length) {
    return (
      <p className="text-base leading-relaxed text-mute">
        Noch kein abgerechneter Versuch. Sobald du eine Empfehlung übernimmst und danach
        wieder brühst, steht hier, ob sie gehalten hat.
      </p>
    )
  }

  return (
    <div className="space-y-2.5">
      {abgerechnet.map((e) => {
        const uhr = alsUhr(e.method)
        const t = (v: number) => (uhr ? fmtClock(Math.round(v)) : `${Math.round(v)} s`)
        const el = e.einloesung!
        const v = e.vorhersage!
        return (
          <div key={e.id} className="rounded-card border border-line bg-card px-4 py-3">
            <div className="flex items-baseline justify-between text-2xs text-faint">
              <span>
                {new Date(e.at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ·{' '}
                {methodLabel(e.method)}
              </span>
              <span className="font-mono">{e.regelId}</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1">
                <div className="text-2xs text-faint">vorher</div>
                <div className="tnum text-lg font-semibold">
                  {e.eingriff?.von !== undefined && e.eingriff.nach !== undefined
                    ? `${e.eingriff.von} → ${e.eingriff.nach}`
                    : '—'}
                </div>
              </div>
              <div className="shrink-0 text-center text-sm text-crema-ink">
                <div className="font-mono text-2xs">{e.titel.split('(')[0]!.trim()}</div>→
              </div>
              <div className="flex-1 text-right">
                <div className="text-2xs text-faint">gemessen</div>
                <div
                  className={`tnum text-lg font-semibold ${el.getroffen ? 'text-ok' : 'text-warn'}`}
                >
                  {t(el.istWert)}
                </div>
              </div>
            </div>

            <p className="mt-2 border-t border-line pt-2 text-sm leading-snug text-mute">
              Vorhergesagt waren {t(v.erwartet)}.{' '}
              <b className={`font-semibold ${el.getroffen ? 'text-ok' : 'text-warn'}`}>
                {el.getroffen
                  ? 'Getroffen.'
                  : `Um ${Math.abs(el.abweichung)} s daneben.`}
              </b>
            </p>
          </div>
        )
      })}
    </div>
  )
}
