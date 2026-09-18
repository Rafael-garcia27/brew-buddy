/**
 * Geschmack als eine Geste statt acht Chips.
 *
 * Zwei Achsen, die beim Einmessen wirklich zählen: die
 * Extraktionsachse (sauer ↔ bitter) und der Körper (dünn ↔ schwer).
 * Ein Zug mit dem Daumen sagt beides auf einmal — und trifft mit nassen
 * Fingern besser als acht 24-Pixel-Chips.
 *
 * ## Was das Pad NICHT ändert
 *
 * Der Entwurf zu 2.0 wollte aus der Position Ausprägungen machen
 * („sour 0,4 · thin 0,3") und der Engine übergeben. Die Fehlerachse der
 * Engine ist aber kategorial — 57 Regeln fragen „ist `sour` gesetzt?",
 * nicht „wie sehr". Das umzubauen wäre ein Eingriff in die gesamte
 * Diagnostik, und der Gewinn stünde dazu in keinem Verhältnis.
 *
 * Das Pad ist deshalb ein Eingabegerät, keine neue Datenart: Es setzt
 * dieselben Fehler-Tags, nur schneller. Was es zusätzlich könnte, steht
 * in IDEAS.md.
 */
import { useRef, useState } from 'react'
import type { Defect } from '@domain'

export interface Achsen {
  /** −1 = deutlich sauer, +1 = deutlich bitter, 0 = ausgewogen. */
  saeure: number
  /** −1 = dünn, +1 = schwer, 0 = stimmig. */
  koerper: number
}

export const MITTE: Achsen = { saeure: 0, koerper: 0 }

/**
 * Ab wann eine Auslenkung als Fehler zählt.
 *
 * Ein Viertel der Strecke. Darunter ist es Rauschen — wer den Daumen
 * knapp neben die Mitte setzt, meint „passt", nicht „sauer".
 */
export const SCHWELLE = 0.25

/** Welche Fehler-Tags aus einer Position folgen. */
export function tagsAus(a: Achsen): Defect[] {
  const out: Defect[] = []
  if (a.saeure <= -SCHWELLE) out.push('sour')
  if (a.saeure >= SCHWELLE) out.push('bitter')
  if (a.koerper <= -SCHWELLE) out.push('thin')
  return out
}

/** Die Position in Worten — damit niemand raten muss, was er getippt hat. */
export function satzZu(a: Achsen): string {
  const stark = (v: number) => Math.abs(v) >= 0.6
  const teile: string[] = []
  if (a.saeure <= -SCHWELLE) teile.push(stark(a.saeure) ? 'deutlich sauer' : 'leicht sauer')
  if (a.saeure >= SCHWELLE) teile.push(stark(a.saeure) ? 'deutlich bitter' : 'leicht bitter')
  if (a.koerper <= -SCHWELLE) teile.push(stark(a.koerper) ? 'sehr dünn' : 'etwas dünn')
  if (a.koerper >= SCHWELLE) teile.push(stark(a.koerper) ? 'sehr schwer' : 'etwas schwer')
  if (!teile.length) return 'Ausgewogen — nichts sticht heraus.'
  return teile.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.'
}

interface Props {
  wert: Achsen
  onChange: (a: Achsen) => void
}

export default function Geschmackspad({ wert, onChange }: Props) {
  const box = useRef<HTMLDivElement | null>(null)
  const [zieht, setZieht] = useState(false)

  const setzen = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    const klemm = (v: number) => Math.max(-1, Math.min(1, v))
    onChange({
      saeure: Math.round(klemm(((e.clientX - r.left) / r.width) * 2 - 1) * 100) / 100,
      // Oben ist schwer, unten ist dünn — deshalb die Achse gedreht.
      koerper: Math.round(klemm(1 - ((e.clientY - r.top) / r.height) * 2) * 100) / 100,
    })
  }

  const links = ((wert.saeure + 1) / 2) * 100
  const oben = ((1 - wert.koerper) / 2) * 100

  return (
    <div>
      {/*
        Die Fläche ist die Geste, die beiden Regler sind die Bedienung.

        Ein Div mit `tabIndex` ist kein Bedienelement — es hat keinen
        Wert, den ein Screenreader vorlesen könnte, und keine Tastatur­
        semantik. Deshalb liegen darunter zwei echte Schieberegler, je
        einer pro Achse: unsichtbar, aber fokussierbar, beschriftet und
        mit Wert. Wer tippt, zieht; wer die Tastatur benutzt, schiebt.
        Der Fokusring liegt auf der Fläche, damit man sieht, wo man ist.
      */}
      <div
        role="group"
        aria-label="Geschmack"
        className="rounded-2xl focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-crema"
      >
      <div
        ref={box}
        aria-hidden="true"
        onPointerDown={(e) => {
          ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
          setZieht(true)
          setzen(e)
        }}
        onPointerMove={(e) => zieht && setzen(e)}
        onPointerUp={() => setZieht(false)}
        onPointerCancel={() => setZieht(false)}
        className="relative aspect-square w-full touch-none rounded-2xl border border-line bg-raised select-none"
      >
        {/* Kreuz durch die Mitte — die Ruhelage muss sichtbar sein. */}
        <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px bg-line" />
        <div className="pointer-events-none absolute inset-y-3 left-1/2 w-px bg-line" />

        <span className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 text-2xs text-faint">
          schwer
        </span>
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-2xs text-faint">
          dünn
        </span>
        <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-2xs text-faint">
          sauer
        </span>
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-2xs text-faint">
          bitter
        </span>

        <div
          className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-crema shadow-lg transition-[left,top] duration-75"
          style={{ left: `${links}%`, top: `${oben}%` }}
        />
      </div>

      <label className="sr-only" htmlFor="achse-saeure">
        Sauer bis bitter
      </label>
      <input
        id="achse-saeure"
        type="range"
        className="sr-only"
        min={-1}
        max={1}
        step={0.1}
        value={wert.saeure}
        onChange={(e) => onChange({ ...wert, saeure: Number(e.target.value) })}
      />
      <label className="sr-only" htmlFor="achse-koerper">
        Dünn bis schwer
      </label>
      <input
        id="achse-koerper"
        type="range"
        className="sr-only"
        min={-1}
        max={1}
        step={0.1}
        value={wert.koerper}
        onChange={(e) => onChange({ ...wert, koerper: Number(e.target.value) })}
      />
      </div>
      <p className="mt-2 text-base leading-snug text-mute" role="status">
        {satzZu(wert)}
      </p>
    </div>
  )
}
