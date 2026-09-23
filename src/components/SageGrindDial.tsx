/**
 * Mahlgradregler der Sage Barista Express.
 *
 * Der erste Entwurf war ein freistehender runder Drehknopf mit einer
 * Skala ringsherum. So sieht die Maschine nicht aus, und das war kein
 * Schönheitsfehler: Wer den Wert an seinem Gerät abliest, sucht das
 * Bild, das er dort sieht. An der Maschine sitzt das Zahlenrad in der
 * linken Gehäusewand und ragt nur zu einem Viertel heraus — durch einen
 * Schlitz sieht man immer bloß einen kleinen Bogen davon, darüber steht
 * „GRIND SIZE", und ein fester Zeiger in der Mitte markiert die Zahl.
 *
 * Genau das zeichnet dieses Bauteil nach: schwarzes Gehäuse, Schlitz,
 * ein großes Rad, dessen Mittelpunkt weit unterhalb des Schlitzes liegt.
 * Sichtbar sind rund 30 Grad Bogen — mehr wäre gelogen.
 *
 * Die Zahlen laufen nach rechts absteigend, wie an der Maschine. Ein Zug
 * nach rechts bringt damit die höheren Zahlen zum Zeiger — gröber also,
 * dieselbe Richtung wie an der Mylo.
 *
 * „FEINER" und „GRÖBER" an den Enden hat dieses Bauteil deshalb NICHT.
 * Sie hätten das Gegenteil dessen behauptet, was danebensteht: Rechts
 * neben dem Zeiger liegen die kleineren Zahlen, also das feinere Ende
 * der Skala, obwohl das Ziehen nach rechts gröber macht. Beides stimmt
 * gleichzeitig und ist nebeneinander nicht lesbar. Die Maschine selbst
 * beschriftet auch nur „GRIND SIZE" — die Zahl unter dem Zeiger ist die
 * Auskunft, und wohin man will, sagt die Empfehlung darüber.
 *
 * Und das Ziehen läuft an React vorbei. Der Vorgänger rief bei jeder
 * Zeigerbewegung `onChange` — damit rendert der ganze Brühbildschirm
 * samt Vorschlagskarte neu, sechzigmal in der Sekunde, und die Geste
 * fühlt sich stufig an. Jetzt dreht die Bewegung das Rad direkt im DOM;
 * der Wert nach außen geht gebündelt einmal pro Bildschirmbild raus.
 */
import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Skalenwert 0–max, stufenlos */
  value: number
  onChange: (value: number) => void
  max: number
  /** Anzeigeschritt, z. B. 0,5 */
  step: number
  /** Empfehlung für die gewählte Methode */
  highlight?: { range: [number, number]; label: string }
  disabled?: boolean
}

/** Zeichenfläche des Schlitzes in SVG-Einheiten. */
const B = 320
const H = 96

/**
 * Radius des Zahlenrads und Lage seines Mittelpunkts.
 *
 * Der Mittelpunkt liegt weit unter dem Schlitz, damit oben nur ein
 * flacher Bogen stehen bleibt — das ist der ganze Trick an der
 * Darstellung. Die Radoberkante liegt bei y = 22, also 12 Einheiten
 * unter der Schlitzkante: So steckt das Rad sichtbar IM Gehäuse und
 * klebt nicht davor.
 *
 * Der erste Anlauf setzte den Mittelpunkt auf y = 78 + R. Damit ragte
 * das Rad gerade sechs Einheiten in den Schlitz, und zu sehen war ein
 * grauer Streifen ohne eine einzige Zahl.
 */
const R = 420
const CX = B / 2
const CY = 22 + R

/**
 * Grad je Skalenschritt — und damit, wie viele Zahlen gleichzeitig
 * sichtbar sind.
 *
 * 6,5° zeigt knapp sieben Nummern im Ausschnitt. Die Maschine selbst
 * zeigt vier bis fünf, das wären 12°; dann bräuchte die ganze Skala aber
 * 1400 px Ziehweg, und auf einem Telefon ist das dreieinhalb Mal über
 * den ganzen Bildschirm. Sieben Zahlen sind der Kompromiss zwischen dem
 * Bild und der Bedienbarkeit.
 */
const GRAD_PRO_EINHEIT = 6.5

/**
 * Ziehweg je Skaleneinheit.
 *
 * Muss zur Bogenlänge passen, sonst läuft das Rad schneller oder
 * langsamer als der Finger, und genau das fühlt sich „grob" an. Bei
 * R − 34 und 6,5° sind das 44 Zeichen­einheiten, auf 375 px Bildschirm
 * rund 43 Pixel.
 */
const PX_PRO_EINHEIT = 43

const rad = (deg: number) => (deg * Math.PI) / 180

export default function SageGrindDial({ value, onChange, max, step, highlight, disabled }: Props) {
  const box = useRef<HTMLDivElement | null>(null)
  const radRef = useRef<SVGGElement | null>(null)
  const anzeige = useRef<HTMLSpanElement | null>(null)
  const zug = useRef<{ x0: number; start: number } | null>(null)
  /** Der laufende Wert während der Geste — außerhalb von React. */
  const wert = useRef(value)
  const bild = useRef<number | null>(null)
  const [aktiv, setAktiv] = useState(false)

  const clamp = (v: number) => Math.max(0, Math.min(max, v))
  /** Auf den Anzeigeschritt runden — die Mühle selbst rastet nicht. */
  const snap = (v: number) => Math.round(clamp(v) / step) * step
  const text = (v: number) => snap(v).toFixed(step < 1 ? 1 : 0).replace('.', ',')

  // Von außen gesetzte Werte übernehmen, solange niemand zieht.
  useEffect(() => {
    if (zug.current) return
    wert.current = value
    zeichnen(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  /**
   * Rad drehen und Zahl setzen, ohne Renderdurchlauf.
   *
   * Das Rad dreht um seinen Mittelpunkt weit unterhalb — ein einziges
   * `transform` auf der Gruppe bewegt Zahlen, Striche und Zähne
   * gemeinsam, und der Browser kann es auf der Grafikkarte erledigen.
   */
  const zeichnen = (v: number) => {
    radRef.current?.setAttribute('transform', `rotate(${v * GRAD_PRO_EINHEIT} ${CX} ${CY})`)
    if (anzeige.current) anzeige.current.textContent = text(v)
  }

  /** Den Wert nach außen geben, höchstens einmal je Bildschirmbild. */
  const melden = () => {
    if (bild.current !== null) return
    bild.current = requestAnimationFrame(() => {
      bild.current = null
      onChange(snap(wert.current))
    })
  }

  const onDown = (e: React.PointerEvent) => {
    if (disabled) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    try {
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    } catch {
      /* ohne Erfassung geht es auch */
    }
    zug.current = { x0: e.clientX, start: wert.current }
    setAktiv(true)
  }

  const onMove = (e: React.PointerEvent) => {
    const z = zug.current
    if (!z) return
    // Nach rechts ziehen heißt gröber: Die höheren Zahlen sitzen links
    // auf dem Rad und wandern zum Zeiger, wenn man es nach rechts dreht.
    wert.current = clamp(z.start + (e.clientX - z.x0) / PX_PRO_EINHEIT)
    zeichnen(wert.current)
    melden()
  }

  const onUp = () => {
    if (!zug.current) return
    zug.current = null
    setAktiv(false)
    // Einrasten auf den Anzeigeschritt — die Mühle rastet nicht, die
    // Anzeige schon, und ein Wert wie 6,37 wäre eine Genauigkeit, die
    // niemand einstellen kann.
    wert.current = snap(wert.current)
    zeichnen(wert.current)
    if (bild.current !== null) {
      cancelAnimationFrame(bild.current)
      bild.current = null
    }
    onChange(wert.current)
  }

  const schieben = (d: number) => {
    wert.current = snap(clamp(wert.current + d))
    zeichnen(wert.current)
    onChange(wert.current)
  }

  /** Die Zahlen auf dem Rad — ganze Nummern, wie am Gerät aufgedruckt. */
  const nummern = Array.from({ length: Math.floor(max) + 1 }, (_, i) => i)
  const imBereich =
    !!highlight && snap(value) >= highlight.range[0] && snap(value) <= highlight.range[1]

  return (
    <div className="select-none">
      {/* Ablesewert und Feinkorrektur wie bei der Mylo: eine Zeile, nicht
          drei Elemente übereinander. */}
      <div className="mb-2 flex items-center gap-3">
        <button
          type="button"
          aria-label="feiner"
          disabled={disabled}
          onClick={() => schieben(-step)}
          className="h-11 w-11 shrink-0 rounded-xl border border-line bg-raised text-xl text-crema active:bg-line disabled:opacity-40"
        >
          −
        </button>
        <div className="min-w-0 flex-1 text-center">
          <span ref={anzeige} className="tnum text-4xl leading-none font-semibold">
            {text(value)}
          </span>
          {highlight && (
            <span className={`ml-2 text-sm ${imBereich ? 'text-ok' : 'text-mute'}`}>
              {highlight.label} {highlight.range[0]}–{highlight.range[1]}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label="gröber"
          disabled={disabled}
          onClick={() => schieben(step)}
          className="h-11 w-11 shrink-0 rounded-xl border border-line bg-raised text-xl text-crema active:bg-line disabled:opacity-40"
        >
          +
        </button>
      </div>

      {/* ══ Das Gehäuse ══ */}
      <div
        ref={box}
        className="relative touch-none overflow-hidden rounded-[20px]"
        style={{
          border: '1px solid var(--c-line)',
          background: 'linear-gradient(180deg,#2a2a2c 0%,#171719 55%,#101012 100%)',
          cursor: disabled ? 'default' : aktiv ? 'grabbing' : 'grab',
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="slider"
        aria-label="Mahlgrad"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={snap(value)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') schieben(-step)
          if (e.key === 'ArrowRight') schieben(step)
        }}
      >
        {/* Gravur auf der Gehäusewand */}
        <p
          className="pt-3 text-center"
          style={{ fontSize: 10, letterSpacing: '0.32em', color: 'rgba(255,255,255,.42)' }}
        >
          GRIND SIZE
        </p>

        <svg viewBox={`0 0 ${B} ${H}`} className="block w-full" aria-hidden>
          <defs>
            {/* Der Schlitz: Nur was hier drin liegt, ist zu sehen. Genau
                das ist die Aussage der Zeichnung — das Rad steckt im
                Gehäuse, sichtbar ist ein Ausschnitt. */}
            <clipPath id="sg-schlitz">
              <rect x="14" y="10" width={B - 28} height={H - 22} rx="10" />
            </clipPath>
            <linearGradient id="sg-rad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f4f2ee" />
              <stop offset="55%" stopColor="#d8d4cd" />
              <stop offset="100%" stopColor="#a9a49c" />
            </linearGradient>
            {/* Schatten an den Schlitzkanten — ohne ihn klebt das Rad auf
                der Blende, statt darin zu stecken. */}
            <linearGradient id="sg-tiefe" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(0,0,0,.75)" />
              <stop offset="22%" stopColor="rgba(0,0,0,0)" />
              <stop offset="82%" stopColor="rgba(0,0,0,0)" />
              <stop offset="100%" stopColor="rgba(0,0,0,.6)" />
            </linearGradient>
          </defs>

          <g clipPath="url(#sg-schlitz)">
            {/* Hinterer Schlitzgrund */}
            <rect x="14" y="10" width={B - 28} height={H - 22} fill="#0b0b0c" />

            {/* Das Rad selbst, gedreht um seinen tief liegenden Mittelpunkt */}
            <g ref={radRef} transform={`rotate(${value * GRAD_PRO_EINHEIT} ${CX} ${CY})`}>
              <circle cx={CX} cy={CY} r={R} fill="url(#sg-rad)" />
              {/* Zahnung am Radrand — der gerändelte Griff der Maschine */}
              {Array.from({ length: 240 }, (_, i) => i * 1.5 - 180).map((a) => {
                const x1 = CX + Math.sin(rad(a)) * R
                const y1 = CY - Math.cos(rad(a)) * R
                const x2 = CX + Math.sin(rad(a)) * (R - 9)
                const y2 = CY - Math.cos(rad(a)) * (R - 9)
                return (
                  <line
                    key={`z${a}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgba(0,0,0,.45)"
                    strokeWidth="1.6"
                  />
                )
              })}

              {nummern.map((n) => {
                // Minus: höhere Zahlen liegen links, wie an der Maschine.
                const a = -n * GRAD_PRO_EINHEIT
                const tx = CX + Math.sin(rad(a)) * (R - 34)
                const ty = CY - Math.cos(rad(a)) * (R - 34)
                const sx = CX + Math.sin(rad(a)) * (R - 12)
                const sy = CY - Math.cos(rad(a)) * (R - 12)
                const ix = CX + Math.sin(rad(a)) * (R - 20)
                const iy = CY - Math.cos(rad(a)) * (R - 20)
                return (
                  <g key={n}>
                    <line x1={sx} y1={sy} x2={ix} y2={iy} stroke="#3a3a3c" strokeWidth="1.6" />
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      dominantBaseline="central"
                      transform={`rotate(${a} ${tx} ${ty})`}
                      fontSize="21"
                      fontWeight="600"
                      fill="#2b2b2d"
                    >
                      {n}
                    </text>
                  </g>
                )
              })}
            </g>

            <rect
              x="14"
              y="10"
              width={B - 28}
              height={H - 22}
              fill="url(#sg-tiefe)"
              pointerEvents="none"
            />
          </g>

          {/* Der feste Zeiger in der Mitte — er dreht sich nicht mit. */}
          <path d={`M${CX} 30l7 -12h-14z`} fill="#ffffff" opacity="0.92" />
          <line x1={CX} y1="30" x2={CX} y2={H - 16} stroke="#ffffff" strokeWidth="1.4" opacity="0.35" />
        </svg>

        <div className="pb-3" />
      </div>

    </div>
  )
}
