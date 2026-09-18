/**
 * Die Vorhersage sichtbar machen — und die Bilanz darüber.
 *
 * Das Solution Design nennt das Feld ERWARTUNG „den Vertrauens­
 * mechanismus der App": eine überprüfbare Prognose. Als Satz allein
 * bleibt sie eine Behauptung. Erst neben der gemessenen Zeit, auf
 * derselben Skala, wird sie zu etwas, das man prüfen kann, ohne zu
 * rechnen.
 *
 * Die Zahlen dafür stehen seit 2.0 im Bestand (`engine/wette.ts`) —
 * hier werden sie nur gezeichnet.
 */
import type { Trefferbilanz, Kreisbefund } from '@/engine/wette'
import type { Vorhersage } from '@/domain'
import { fmtClock } from '@/components/ui'

interface BalkenProps {
  /** Die gemessene Zeit des Durchgangs, der die Empfehlung ausgelöst hat. */
  jetzt: number
  /** Zielband der Methode, wenn es eines gibt. */
  band?: [number, number]
  vorhersage: Vorhersage
  /** Minuten:Sekunden statt nackter Sekunden. */
  alsUhr: boolean
}

/**
 * Jetzt und danach auf einer Skala.
 *
 * Die Skala umfasst alles, was vorkommt, plus etwas Luft — sie beginnt
 * nicht bei null. Eine Achse von 0 bis 40 Sekunden würde den
 * Unterschied, um den es geht, auf ein Fünftel der Breite quetschen.
 */
export function Vorhersagebalken({ jetzt, band, vorhersage, alsUhr }: BalkenProps) {
  const werte = [jetzt, vorhersage.erwartet, ...(band ?? [])]
  const luft = 3
  const von = Math.floor(Math.min(...werte) - luft)
  const bis = Math.ceil(Math.max(...werte) + luft)
  const x = (w: number) => 34 + ((w - von) / (bis - von)) * 204
  const t = (w: number) => (alsUhr ? fmtClock(Math.round(w)) : `${Math.round(w)} s`)

  const a = vorhersage.erwartet - vorhersage.toleranz
  const b = vorhersage.erwartet + vorhersage.toleranz

  return (
    <svg
      viewBox="0 0 250 96"
      className="mt-3 h-auto w-full"
      role="img"
      aria-label={`Gemessen ${t(jetzt)}, erwartet ${t(vorhersage.erwartet)} plus minus ${vorhersage.toleranz} Sekunden${band ? `, Zielband ${t(band[0])} bis ${t(band[1])}` : ''}.`}
    >
      {band && (
        <rect
          x={x(band[0])}
          y="16"
          width={Math.max(2, x(band[1]) - x(band[0]))}
          height="30"
          rx="4"
          fill="var(--c-ok)"
          opacity="0.14"
        />
      )}
      {/* Links verankert, nicht am Band: Sonst läuft die Beschriftung
          rechts aus dem Bild, sobald das Zielband am Rand liegt. */}
      {band && (
        <text x="34" y="10" fontSize="9.5" fill="var(--c-faint)" className="tnum">
          Zielband {t(band[0])}–{t(band[1])}
        </text>
      )}

      <line x1="34" y1="62" x2="238" y2="62" stroke="var(--c-line)" strokeWidth="1" />

      {/* Danach: das erwartete Band, breit genug, um die Toleranz zu zeigen. */}
      <rect
        x={x(a)}
        y="23"
        width={Math.max(6, x(b) - x(a))}
        height="16"
        rx="8"
        fill="var(--c-crema)"
      />
      <text
        x={x(vorhersage.erwartet)}
        y="78"
        fontSize="10"
        fill="var(--c-crema)"
        textAnchor="middle"
        className="tnum"
      >
        danach {t(vorhersage.erwartet)}
      </text>

      {/* Jetzt: der gemessene Punkt. */}
      <circle cx={x(jetzt)} cy="31" r="6" fill="var(--c-mute)" />
      <text
        x={x(jetzt)}
        y="92"
        fontSize="10"
        fill="var(--c-mute)"
        textAnchor="middle"
        className="tnum"
      >
        jetzt {t(jetzt)}
      </text>
    </svg>
  )
}

/**
 * „Von 14 Vorhersagen sind 11 eingetroffen."
 *
 * Bewusst erst ab drei geprüften: Eine Quote aus einer Messung ist
 * entweder 100 % oder 0 % und sagt beides nichts.
 */
export function Trefferzeile({ bilanz }: { bilanz: Trefferbilanz }) {
  const geprueft = bilanz.eingeloest + bilanz.verfehlt
  if (geprueft < 3 || bilanz.quote === null) return null
  return (
    <p className="text-sm leading-snug text-mute">
      <b className="font-semibold text-ink">
        {bilanz.eingeloest} von {geprueft}
      </b>{' '}
      Vorhersagen sind bisher eingetroffen.
      {bilanz.quote >= 0.7
        ? ' Die Zahlen hier sind belastbar.'
        : ' Nimm die Zahlen unten als Richtung, nicht als Zusage.'}
    </p>
  )
}

/**
 * „Hör auf zu drehen" (Briefing Teil D).
 *
 * Steht ÜBER der Empfehlung, nicht darunter: Wer dreimal vergeblich
 * gedreht hat, soll den vierten Vorschlag gar nicht erst als
 * naheliegend lesen.
 */
export function Kreiswarnung({ befund }: { befund: Kreisbefund }) {
  const wort =
    befund.groesse === 'mahlgrad'
      ? 'am Mahlgrad'
      : befund.groesse === 'ratio'
        ? 'am Verhältnis'
        : befund.groesse === 'temperatur'
          ? 'an der Temperatur'
          : 'an der Dosis'
  return (
    <div className="rounded-2xl border border-bad/40 bg-bad/10 px-4 py-3">
      <p className="text-lg font-semibold">Hör auf zu drehen.</p>
      <p className="mt-1 text-base leading-relaxed text-mute">
        {befund.anzahl} Korrekturen {wort} hintereinander, keine hat getroffen. Dann liegt es
        nicht {wort} — sondern an der Bohne, am Wasser oder an der Röstung.
      </p>
    </div>
  )
}
