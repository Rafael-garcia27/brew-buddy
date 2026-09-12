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
 *
 * Während der Geste wird NICHT über React gezeichnet. Der erste Entwurf
 * hat bei jedem `pointermove` den Zustand gesetzt — damit rendert die
 * ganze Zeile samt Bohnengrafik sechzigmal in der Sekunde neu, und das
 * Ziehen hakt. Jetzt schreiben die Bewegungen direkt in den Stil der
 * beiden beteiligten Elemente und in eine CSS-Variable `--ab`, aus der
 * die Aktionskacheln ihre Deckkraft selbst ableiten. React erfährt erst
 * beim Loslassen davon, wenn die Zeile auf ihre Stufe einrastet.
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
  const karte = useRef<HTMLDivElement | null>(null)
  const hinweis = useRef<HTMLDivElement | null>(null)
  const zug = useRef<{ x0: number; y0: number; ab: number; achse: 'offen' | 'x' | 'y' } | null>(null)
  /** Der laufende Wert während der Geste — bewusst außerhalb von React. */
  const abJetzt = useRef(0)
  const [ab, setAb] = useState(0)
  const [zieht, setZieht] = useState(false)

  const offenBreite = actions.length * AKTION_PX

  /**
   * Kartenbreite, gemessen wenn der Finger aufsetzt — nicht beim Rendern.
   *
   * Vorher stand hier `box.current?.offsetWidth ?? 0` mitten im Render.
   * Beim ersten Durchlauf ist `box.current` aber noch leer, weil React das
   * Element erst danach einhängt: Die erste Bewegung auf einer frisch
   * eingehängten Karte rechnete deshalb mit Breite 0 und schob sie um
   * nichts. Gefunden vom Linter (`react(refs)`), siehe P7.
   *
   * Beim Aufsetzen zu messen ist ohnehin richtiger: Dann stimmt der Wert
   * auch nach einer Drehung des Geräts, ohne dass etwas neu rendern muss.
   */
  const breiteRef = useRef(0)
  const hinausAb = () => breiteRef.current * HINAUS_ANTEIL

  /**
   * Den Stand zeichnen, ohne React zu bemühen.
   *
   * Drei Schreibvorgänge pro Bewegung statt eines Renderdurchlaufs: die
   * Verschiebung und das Ausblenden der Karte, die Variable, aus der die
   * Kacheln ihre Deckkraft rechnen, und der Hinweis fürs Hinausschieben.
   */
  const zeichnen = (wert: number) => {
    abJetzt.current = wert
    const k = karte.current
    if (k) {
      /**
       * Zurücktreten, nicht durchsichtig werden.
       *
       * Der erste Versuch nahm 22 % Deckkraft — damit schien die rote
       * Kachel durch die Karte hindurch, und die Überlappung sah
       * verschmiert aus statt gestaffelt. Zehn Prozent plus anderthalb
       * Prozent Verkleinerung geben dieselbe Aussage („diese Karte ist
       * gerade nicht mehr die Hauptsache") ohne Durchscheinen.
       *
       * Ankerpunkt rechts: Sonst liefe die Karte durch das Verkleinern
       * von ihrer eigenen Kante weg und gäbe rechts einen Spalt frei.
       */
      const anteil = breiteRef.current > 0 ? Math.min(1, wert / breiteRef.current) : 0
      k.style.transform = `translateX(${-wert}px) scale(${1 - 0.015 * anteil})`
      k.style.opacity = String(1 - 0.1 * anteil)
    }
    box.current?.style.setProperty('--ab', String(wert))
    if (hinweis.current) {
      hinweis.current.style.opacity = onSwipeAway && wert >= hinausAb() ? '1' : '0'
    }
  }

  /** Einrasten: React übernimmt wieder, die Übergangsdauer macht den Rest. */
  const rasten = (wert: number) => {
    abJetzt.current = wert
    setAb(wert)
    const k = karte.current
    if (k) {
      k.style.transform = ''
      k.style.opacity = ''
    }
    box.current?.style.setProperty('--ab', String(wert))
    if (hinweis.current) hinweis.current.style.opacity = '0'
  }

  const onDown = (e: React.PointerEvent) => {
    // Maustaste rechts oder Mitte ignorieren.
    if (e.pointerType === 'mouse' && e.button !== 0) return
    breiteRef.current = box.current?.offsetWidth ?? 0
    zug.current = { x0: e.clientX, y0: e.clientY, ab: abJetzt.current, achse: 'offen' }
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
      // Erst jetzt den Übergang abschalten: Solange die Achse offen war,
      // hat sich nichts bewegt, und ein Render zu diesem Zeitpunkt kostet
      // nichts.
      setZieht(true)
    }

    const rohe = z.ab - dx
    // Nach rechts über die Ruhelage hinaus gibt es nichts zu zeigen.
    // Nach links höchstens bis zum Rand, sonst verschwindet die Karte.
    const grenze = onSwipeAway ? breiteRef.current : offenBreite
    zeichnen(Math.max(0, Math.min(grenze, rohe)))
  }

  const onUp = () => {
    if (!zug.current) return
    const gezogen = zug.current.achse === 'x'
    zug.current = null
    if (!gezogen) return
    setZieht(false)

    const wert = abJetzt.current
    if (onSwipeAway && wert >= hinausAb()) {
      onSwipeAway()
      rasten(0)
      return
    }
    // Einrasten auf die nächstgelegene Stufe: geschlossen, erste Aktion,
    // alle Aktionen. Nichts bleibt auf halbem Weg stehen.
    const stufen = [0, ...actions.map((_, i) => (i + 1) * AKTION_PX)]
    rasten(stufen.reduce((a, b) => (Math.abs(b - wert) < Math.abs(a - wert) ? b : a), 0))
  }

  const schliessen = () => rasten(0)

  return (
    <div
      ref={box}
      className={`relative overflow-hidden ${className}`}
      style={{ '--ab': ab } as React.CSSProperties}
    >
      {/* Aktionen liegen darunter und werden von der Karte verdeckt.
          Umgekehrte Laufrichtung: Die Zeile schiebt sich nach links, frei
          wird also der Streifen am RECHTEN Rand. Die erste Aktion muss
          deshalb außen liegen, sonst greift der Daumen beim kurzen Wisch
          zuerst auf die letzte — und das ist hier die, die löscht.

          Als gerundete Kacheln mit Abstand, nicht als randlose Vollflächen:
          Der rote Streifen sah sonst aus wie ein roher Block, der mit dem
          Rest der Oberfläche nichts zu tun hat. */}
      <div
        className="absolute inset-y-0 right-0 flex flex-row-reverse gap-1.5 p-1.5"
        style={{ width: offenBreite }}
      >
        {actions.map((a, i) => (
          <button
            key={a.label}
            type="button"
            onClick={() => {
              schliessen()
              a.onClick()
            }}
            /**
             * Die Deckkraft rechnet die Kachel selbst aus `--ab`: Die
             * letzte Aktion deutet sich erst an, wenn man weiter zieht —
             * sie soll nicht schon beim Anfassen als Angebot dastehen.
             * In CSS statt in JavaScript, damit die Geste ohne Render
             * auskommt.
             */
            style={
              {
                '--start': i * AKTION_PX,
                opacity: `clamp(0.2, calc(0.2 + 0.8 * (var(--ab, 0) - var(--start)) / ${AKTION_PX}), 1)`,
              } as React.CSSProperties
            }
            className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[13px] font-medium ${
              a.tone === 'bad' ? 'bg-bad text-white' : 'bg-raised text-ink'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Der Hinweis für das vollständige Hinausschieben. Er liegt über
          den Aktionen und füllt die ganze Zeile, sobald die Schwelle
          erreicht ist — dann ist die Geste eine andere. Immer im
          Dokument und nur ausgeblendet, damit das Umschalten während der
          Geste keinen Render kostet. */}
      {onSwipeAway && (
        <div
          ref={hinweis}
          /* Reine Rückmeldung zur Geste: Er wird nur sichtbar, während der
             Finger zieht, und sagt jemandem, der nicht zieht, nichts. Ohne
             `aria-hidden` liest der Screenreader ihn in JEDER Zeile mit —
             bei zwölf Bohnen zwölfmal „Loslassen zum Löschen" (F-19).
             Die Aktionen darunter behalten ihre Beschriftung: Sie sind der
             Weg für alle, die nicht wischen können. */
          aria-hidden="true"
          style={{ opacity: 0 }}
          className={`pointer-events-none absolute inset-0 flex items-center justify-end bg-bad pr-5 text-[14px] font-semibold text-white transition-opacity duration-150 ${className}`}
        >
          {swipeAwayLabel ?? 'Loslassen'}
        </div>
      )}

      <div
        ref={karte}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        // pan-y: Senkrechtes Scrollen bleibt beim Browser, waagerechtes
        // Wischen bei uns. Ohne das ruckelt die Liste.
        style={{
          transform: `translateX(${-ab}px)`,
          touchAction: 'pan-y',
          transformOrigin: 'right center',
          transition: zieht ? 'none' : 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 220ms',
          willChange: 'transform',
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
