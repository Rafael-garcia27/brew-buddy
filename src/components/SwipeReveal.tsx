/**
 * Nach links wischen, um Aktionen freizulegen.
 *
 * Drei Stufen, wie man sie vom Telefon kennt:
 *   ein Stück   → die erste Aktion steht offen
 *   weiter      → die zweite deutet sich an und wird voll sichtbar
 *   ganz hinaus → beim Loslassen greift die letzte Aktion
 *
 * Warum überhaupt selbst gebaut: Die App hat keine Bibliothek dafür, und
 * eine Wischgeste ist zwanzig Zeilen Zeigerlogik plus zwei Fallen. Die
 * erste ist die Scrollrichtung — wer senkrecht wischen will, darf nicht
 * versehentlich die Karte aufziehen. Die zweite ist die Tastatur: Die
 * Aktionen liegen deshalb als echte Knöpfe im Dokument, auch wenn sie
 * gerade verdeckt sind, und sind damit erreichbar, ohne zu wischen.
 */
import { useRef, useState, type ReactNode } from 'react'

export interface SwipeAction {
  label: string
  /** `bad` färbt in Warnfarbe — für alles, was Daten entfernt. */
  tone?: 'default' | 'bad'
  onClick: () => void
}

/** Breite einer Aktionsfläche. 88 px trifft man auch im Vorbeigehen. */
const AKTION_PX = 88

/**
 * Ab welchem Anteil der Kartenbreite das Loslassen die letzte Aktion
 * auslöst. 55 % ist weit genug, dass man es nicht aus Versehen erreicht,
 * und nah genug, dass es sich nach „ganz hinausschieben" anfühlt.
 */
const HINAUS_ANTEIL = 0.55

/** Unterhalb davon gilt eine Bewegung als Wackeln, nicht als Wischen. */
const SCHWELLE_PX = 8

export default function SwipeReveal({
  actions,
  onSwipeAway,
  swipeAwayLabel,
  className = 'rounded-2xl',
  children,
}: {
  actions: SwipeAction[]
  /** Eckenradius der Zeile — muss zu dem des Inhalts passen. */
  className?: string
  /**
   * Vollständig nach links geschoben und losgelassen. Die Aktion muss
   * rücknehmbar sein — eine Geste, die ohne Rückfrage Daten entfernt,
   * braucht einen Weg zurück.
   */
  onSwipeAway?: () => void
  swipeAwayLabel?: string
  children: ReactNode
}) {
  const box = useRef<HTMLDivElement | null>(null)
  const zug = useRef<{ x0: number; y0: number; ab: number; achse: 'offen' | 'x' | 'y' } | null>(null)
  const [ab, setAb] = useState(0)
  const [zieht, setZieht] = useState(false)

  const offenBreite = actions.length * AKTION_PX
  const breite = box.current?.offsetWidth ?? 0
  const hinausAb = breite * HINAUS_ANTEIL
  const hinaus = !!onSwipeAway && ab >= hinausAb

  const onDown = (e: React.PointerEvent) => {
    // Maustaste rechts oder Mitte ignorieren.
    if (e.pointerType === 'mouse' && e.button !== 0) return
    zug.current = { x0: e.clientX, y0: e.clientY, ab, achse: 'offen' }
    setZieht(true)
  }

  const onMove = (e: React.PointerEvent) => {
    const z = zug.current
    if (!z) return
    const dx = e.clientX - z.x0
    const dy = e.clientY - z.y0

    // Richtung einmal festlegen und dabei bleiben. Ohne das übernimmt die
    // Karte mitten im senkrechten Scrollen die Geste.
    if (z.achse === 'offen') {
      if (Math.abs(dx) < SCHWELLE_PX && Math.abs(dy) < SCHWELLE_PX) return
      z.achse = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (z.achse === 'y') {
        zug.current = null
        setZieht(false)
        return
      }
      // Ab hier gehört der Zeiger uns, auch wenn er das Element verlässt.
      // In try/catch, weil der Aufruf für einen Zeiger wirft, den der
      // Browser nicht kennt — und ein Wurf hier würde die Bewegung
      // darunter verschlucken, statt nur die Erfassung zu verlieren.
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      } catch {
        /* ohne Erfassung geht es auch, nur endet die Geste am Rand */
      }
    }

    const rohe = z.ab - dx
    // Nach rechts über die Ruhelage hinaus gibt es nichts zu zeigen.
    // Nach links höchstens bis zum Rand, sonst verschwindet die Karte.
    const grenze = onSwipeAway ? breite : offenBreite
    setAb(Math.max(0, Math.min(grenze, rohe)))
  }

  const onUp = () => {
    if (!zug.current) return
    zug.current = null
    setZieht(false)

    if (onSwipeAway && ab >= hinausAb) {
      onSwipeAway()
      setAb(0)
      return
    }
    // Einrasten auf die nächstgelegene Stufe: geschlossen, erste Aktion,
    // alle Aktionen. Nichts bleibt auf halbem Weg stehen.
    const stufen = [0, ...actions.map((_, i) => (i + 1) * AKTION_PX)]
    const naechste = stufen.reduce((a, b) => (Math.abs(b - ab) < Math.abs(a - ab) ? b : a), 0)
    setAb(naechste)
  }

  const schliessen = () => setAb(0)

  return (
    <div ref={box} className={`relative overflow-hidden ${className}`}>
      {/* Aktionen liegen darunter und werden von der Karte verdeckt.
          Umgekehrte Laufrichtung: Die Zeile schiebt sich nach links, frei
          wird also der Streifen am RECHTEN Rand. Die erste Aktion muss
          deshalb außen liegen, sonst greift der Daumen beim kurzen Wisch
          zuerst auf die letzte — und das ist hier die, die löscht. */}
      <div className="absolute inset-y-0 right-0 flex flex-row-reverse">
        {actions.map((a, i) => {
          // Die letzte Aktion deutet sich erst an, wenn man weiter zieht:
          // Sie soll nicht mit dem ersten Anfassen als Angebot dastehen.
          const abGesehen = i * AKTION_PX
          const voll = (i + 1) * AKTION_PX
          const anteil = Math.max(0, Math.min(1, (ab - abGesehen) / (voll - abGesehen || 1)))
          return (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                schliessen()
                a.onClick()
              }}
              style={{ width: AKTION_PX, opacity: 0.25 + 0.75 * anteil }}
              className={`flex flex-col items-center justify-center gap-1 text-[13px] font-medium ${
                a.tone === 'bad' ? 'bg-bad text-white' : 'bg-raised text-ink'
              }`}
            >
              {a.label}
            </button>
          )
        })}
      </div>

      {/* Der Hinweis für das vollständige Hinausschieben. Er liegt über
          den Aktionen und füllt die ganze Zeile, sobald die Schwelle
          erreicht ist — dann ist die Geste eine andere. */}
      {onSwipeAway && hinaus && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-end bg-bad pr-5 text-[14px] font-semibold text-white">
          {swipeAwayLabel ?? 'Loslassen'}
        </div>
      )}

      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        // pan-y: Senkrechtes Scrollen bleibt beim Browser, waagerechtes
        // Wischen bei uns. Ohne das ruckelt die Liste.
        style={{
          transform: `translateX(${-ab}px)`,
          touchAction: 'pan-y',
          transition: zieht ? 'none' : 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        className="relative"
      >
        {/* Solange Aktionen offen stehen, schließt ein Tipp auf die Karte
            sie wieder, statt darunterliegende Knöpfe auszulösen. */}
        {ab > 0 && (
          <button
            type="button"
            aria-label="Aktionen schließen"
            onClick={schliessen}
            className="absolute inset-0 z-10"
          />
        )}
        {children}
      </div>
    </div>
  )
}
