/**
 * Der laufende Durchgang — der Teil, für den man die Hände frei braucht.
 *
 * Bis 2.0 hatte die App gar keinen Timer: Man tippte die Zeit hinterher
 * ein. Das widerspricht dem Briefing G10 („drei Pflichtinteraktionen:
 * starten, stoppen, bewerten") und erzeugt eine stille Unwahrheit —
 * unter dem Feld stand „vorbelegt, nicht gemessen", und ausgewertet wurde
 * trotzdem.
 *
 * ## Was hier statt Insel, Sperrbildschirm und Uhr steht
 *
 * Der Entwurf zu 2.0 wollte die Session in die Dynamic Island, auf den
 * Sperrbildschirm und ans Handgelenk verlegen. Das braucht eine native
 * App; die bleibt hier bewusst aus. Zwei Dinge gehen trotzdem und decken
 * denselben Bedarf ab:
 *
 * - **Wake Lock** — der Bildschirm bleibt an, solange es läuft. Ohne das
 *   dimmt das Telefon mitten im Shot, und man wischt mit nassen Fingern.
 * - **Tonhinweise** — ein kurzer Ton am Anfang und am Ende des Zielbands.
 *   Das ist der Ersatz für die Haptik am Handgelenk: Man muss nicht
 *   hinsehen.
 *
 * ## Warum die Zeit aus Zeitstempeln kommt und nicht aus Zählern
 *
 * `setInterval` driftet, und iOS drosselt Timer im Hintergrund. Gezählt
 * wird deshalb nichts — die Anzeige liest bei jedem Bild die Differenz
 * zweier Zeitstempel. Auch wenn das Telefon zwischendurch schläft, stimmt
 * die Zeit danach wieder.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BrewMethod } from '@domain'
import { METHOD_LABEL } from '@/labels'
import { fmtClock } from '@/components/ui'

interface Props {
  method: BrewMethod
  beanName: string
  /** Zielband in Sekunden, wenn die Methode eines hat. */
  ziel?: [number, number]
  tonhinweise: boolean
  onTon: (an: boolean) => void
  /** Gemessene Sekunden, gerundet. */
  onStopp: (sekunden: number) => void
  onAbbruch: () => void
}

/**
 * Ein kurzer Ton, ohne Datei.
 *
 * Web Audio erzeugt ihn selbst — kein Netzabruf, kein Byte im Bundle.
 * Der Kontext wird beim ersten Tippen angelegt, weil iOS ihn sonst
 * stummschaltet.
 */
function piep(ctx: AudioContext, anzahl: number): void {
  for (let i = 0; i < anzahl; i++) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 880
    const t = ctx.currentTime + i * 0.18
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    o.connect(g).connect(ctx.destination)
    o.start(t)
    o.stop(t + 0.14)
  }
}

export default function SessionLauf({
  method,
  beanName,
  ziel,
  tonhinweise,
  onTon,
  onStopp,
  onAbbruch,
}: Props) {
  const [ms, setMs] = useState(0)
  const audio = useRef<AudioContext | null>(null)
  const gemeldet = useRef<Set<number>>(new Set())

  /**
   * Die Uhr.
   *
   * Der Startzeitpunkt entsteht beim Einhängen, nicht beim Rendern —
   * `useRef(Date.now())` würde die Zeit bei jedem Bild neu lesen und
   * wieder verwerfen. Gerechnet wird aus der Differenz zweier
   * Zeitstempel: `setInterval` driftet, und iOS drosselt Timer im
   * Hintergrund.
   */
  useEffect(() => {
    const t0 = Date.now()
    let bild = 0
    const tick = () => {
      setMs(Date.now() - t0)
      bild = requestAnimationFrame(tick)
    }
    bild = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(bild)
  }, [])

  // ── Bildschirm an lassen ──
  useEffect(() => {
    type Lock = { release: () => Promise<void> }
    let lock: Lock | null = null
    let abgebrochen = false

    const holen = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<Lock> } })
          .wakeLock
        if (!wl) return
        const l = await wl.request('screen')
        if (abgebrochen) void l.release()
        else lock = l
      } catch {
        // Kein Wake Lock — kein Grund, den Durchgang abzubrechen.
      }
    }
    void holen()

    // iOS gibt die Sperre beim Wegschalten frei. Kommt man zurück, muss
    // sie neu geholt werden, sonst dimmt der Bildschirm doch noch.
    const beiRueckkehr = () => {
      if (document.visibilityState === 'visible') void holen()
    }
    document.addEventListener('visibilitychange', beiRueckkehr)
    return () => {
      abgebrochen = true
      document.removeEventListener('visibilitychange', beiRueckkehr)
      void lock?.release()
      document.removeEventListener('visibilitychange', beiRueckkehr)
    }
  }, [])

  // ── Tonhinweise an den Bandgrenzen ──
  const sek = Math.floor(ms / 1000)
  useEffect(() => {
    if (!tonhinweise || !ziel || !audio.current) return
    for (const [grenze, anzahl] of [
      [ziel[0], 2],
      [ziel[1], 3],
    ] as const) {
      // Einmal je Grenze, auch wenn die Uhr mehrfach denselben Wert liest.
      if (sek === grenze && !gemeldet.current.has(grenze)) {
        gemeldet.current.add(grenze)
        piep(audio.current, anzahl)
      }
    }
  }, [sek, ziel, tonhinweise])

  // Der Kontext darf nur aus einer Geste heraus entstehen — das Tippen
  // auf „Let's Brew" ist sie, und dieser Bildschirm erscheint dadurch.
  useEffect(() => {
    try {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (C) audio.current = new C()
    } catch {
      /* ohne Ton geht es auch */
    }
    return () => void audio.current?.close()
  }, [])

  const alsUhr = method !== 'espresso'
  const anzeige = alsUhr ? fmtClock(sek) : String(sek)

  // Der Bogen: das Zielband als heller Abschnitt, die gelaufene Zeit
  // darüber. Skala bis 150 % der oberen Bandgrenze, damit ein zu langer
  // Durchgang nicht aus dem Ring läuft.
  const skala = ziel ? ziel[1] * 1.5 : Math.max(60, sek * 1.4)
  const U = 2 * Math.PI * 76
  const anteil = Math.min(1, sek / skala)
  const bandVon = ziel ? Math.min(1, ziel[0] / skala) : 0
  const bandBis = ziel ? Math.min(1, ziel[1] / skala) : 0

  const imBand = ziel ? sek >= ziel[0] && sek <= ziel[1] : false
  const drueber = ziel ? sek > ziel[1] : false

  /**
   * Als Portal über allem, nicht im Inhaltsbereich.
   *
   * Der Bildschirm gehört nicht in den scrollenden Teil der App: Sonst
   * bleibt die Reiterleiste stehen, schneidet die Knöpfe ab und bietet
   * mitten im Shot einen Wechsel an, den niemand will. Er liegt deshalb
   * fest über der ganzen Seite.
   */
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#14100e] text-[#f7efe3]">
      <div className="pt-safe flex items-center justify-between px-5 pt-3">
        <div>
          <div className="text-2xs tracking-[0.14em] text-[#8e939e]">
            {METHOD_LABEL[method].toUpperCase()}
          </div>
          <div className="text-sm text-[#b8bdc7]">{beanName}</div>
        </div>
        <button
          type="button"
          onClick={() => onTon(!tonhinweise)}
          aria-label={tonhinweise ? 'Tonhinweise aus' : 'Tonhinweise an'}
          aria-pressed={tonhinweise}
          className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-[#b8bdc7] active:bg-white/10"
        >
          {tonhinweise ? '♪' : '♪̸'}
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <div className="relative grid place-items-center">
          <svg viewBox="0 0 180 180" width="212" height="212" aria-hidden="true">
            <circle cx="90" cy="90" r="76" fill="none" stroke="#2a2c33" strokeWidth="9" />
            {ziel && (
              <circle
                cx="90" cy="90" r="76" fill="none" stroke="#4a4f59" strokeWidth="9"
                strokeDasharray={`${(bandBis - bandVon) * U} ${U}`}
                strokeDashoffset={-bandVon * U}
                transform="rotate(-90 90 90)"
              />
            )}
            <circle
              cx="90" cy="90" r="76" fill="none"
              stroke={drueber ? '#d96a56' : imBand ? '#8fb36b' : '#d9a566'}
              strokeWidth="9" strokeLinecap="round"
              strokeDasharray={`${anteil * U} ${U}`}
              transform="rotate(-90 90 90)"
            />
          </svg>
          <div className="absolute text-center">
            <div className="tnum text-[54px] leading-none font-semibold tracking-[-0.04em]">
              {anzeige}
            </div>
            <div className="text-2xs tracking-[0.1em] text-[#8e939e]">
              {alsUhr ? 'MIN:SEK' : 'SEKUNDEN'}
            </div>
          </div>
        </div>

        <p className="text-sm text-[#b8bdc7]" role="status">
          {!ziel
            ? 'Läuft.'
            : drueber
              ? `Über dem Zielband — ${alsUhr ? fmtClock(ziel[1]) : `${ziel[1]} s`} wären das Ziel gewesen.`
              : imBand
                ? 'Im Zielband.'
                : `Zielband ab ${alsUhr ? fmtClock(ziel[0]) : `${ziel[0]} s`} · noch ${ziel[0] - sek} s`}
        </p>
      </div>

      <div className="pb-safe flex gap-3 px-5 pb-4">
        <button
          type="button"
          onClick={onAbbruch}
          className="h-14 flex-1 rounded-card border border-white/25 text-lg"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={() => onStopp(sek)}
          className="h-14 flex-[2] rounded-card bg-[#f7efe3] text-lg font-semibold text-[#14100e]"
        >
          Stopp
        </button>
      </div>
    </div>,
    document.body,
  )
}
