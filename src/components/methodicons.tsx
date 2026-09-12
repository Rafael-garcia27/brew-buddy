/**
 * Ein Zeichen je Methode, alle im selben Strich.
 *
 * Konvention, kein Nachbau: Praktisch jede App dieser Kategorie zeigt die
 * Methoden als monochrome Umrisslinie ihres Geräts. Die Sprache ist
 * verbreitet und gehört niemandem — die Zeichnungen hier sind eigene.
 *
 * Regeln, damit sie eine Familie bleiben (docs/05 §3.3):
 *
 *   24er Raster, `stroke-width` 1.8, `currentColor`, keine Füllung.
 *
 * Keine Füllung ist nicht Geschmack, sondern Notwendigkeit: Die Icons
 * stehen in beiden Paletten, auf Karten und in gedämpfter Farbe für die
 * angekündigten Methoden. Eine gefüllte Fläche müsste dafür dreimal
 * gedacht werden, eine Linie funktioniert überall.
 *
 * Und keine Emoji — die Designregel der App verbietet sie, weil sie auf
 * jedem Gerät anders aussehen und keine Strichstärke haben.
 *
 * Die eigentliche Schwierigkeit sind die drei Kegel: V60, Kalita und
 * Chemex. Was sie im Umriss unterscheidet, ist jeweils genau ein Merkmal
 * — Rippen und Spitze, Flachboden und Füße, Sanduhr mit Manschette —, und
 * dieses Merkmal muss deshalb das deutlichste der Zeichnung sein.
 */
import type { ReactElement } from 'react'

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Dünner, für Nebenlinien innerhalb einer Form (Rippen, Siebkante). */
const S_FEIN = { ...S, strokeWidth: 1.2, strokeOpacity: 0.65 }

const ZEICHNUNGEN: Record<string, ReactElement> = {
  // Siebträger im Profil: Griff nach links, zwei Ausläufe, Tropfen.
  espresso: (
    <g {...S}>
      <path d="M2.8 10.2h5.7" />
      <path d="M8.5 7h11l-1.5 5.1a2.5 2.5 0 01-2.4 1.8h-3.2a2.5 2.5 0 01-2.4-1.8z" />
      <path d="M12.4 13.9l-.7 3M15.6 13.9l.7 3" />
      <path d="M11.5 19.6v1.6M16.5 19.6v1.6" {...S_FEIN} />
    </g>
  ),

  // V60: Kegel mit Rippen und spitzem Auslauf.
  v60: (
    <g {...S}>
      <path d="M3.5 6.5h17" />
      <path d="M5.2 6.5l5 11.4h3.6l5-11.4" />
      <path d="M10.2 17.9h3.6l-.7 2.7h-2.2z" />
      <path d="M9 8.6v7.4M12 8.6v9.1M15 8.6v7.4" {...S_FEIN} />
    </g>
  ),

  // AeroPress: Zylinder mit Kolbengriff oben, Filterkappe unten.
  aeropress: (
    <g {...S}>
      <path d="M8.6 2.6h6.8" />
      <path d="M12 2.6v3" />
      <path d="M7 5.6h10v10.8a2.2 2.2 0 01-2.2 2.2H9.2A2.2 2.2 0 017 16.4z" />
      <path d="M9.2 18.6h5.6l-.4 2.4H9.6z" />
      <path d="M7 9.2h10" {...S_FEIN} />
    </g>
  ),

  // French Press: Glaszylinder mit Deckel, Kolbenstange und Griff.
  frenchpress: (
    <g {...S}>
      <path d="M12 1.6v1.9" />
      <path d="M6.6 3.5h10.8v2H6.6z" />
      <path d="M8 5.5h8v13.4a2.1 2.1 0 01-2.1 2.1h-3.8A2.1 2.1 0 018 18.9z" />
      <path d="M16 9.4h1.8a1.7 1.7 0 010 3.4H16" />
      <path d="M8.4 11.4h7.2" {...S_FEIN} />
    </g>
  ),

  // Filterkaffeemaschine: Brühkopf, Korb, Kanne mit Griff. Das Merkmal ist
  // der Brühkopf ÜBER dem Korb — nur diese Methode gießt nicht selbst.
  // Deshalb steht er breiter als alles darunter: Er ist die Aussage.
  batchbrew: (
    <g {...S}>
      <path d="M3.6 2.8h16.8v3H3.6z" />
      <path d="M12 5.8v1.6" {...S_FEIN} />
      <path d="M7.6 7.4h8.8l-1.3 3.8H8.9z" />
      <path d="M8.1 12.2h7.4v5.1a2.7 2.7 0 01-2.7 2.7h-2a2.7 2.7 0 01-2.7-2.7z" />
      <path d="M15.5 13.9h1.6a1.7 1.7 0 010 3.4h-1.6" />
    </g>
  ),

  // Chemex: Sanduhr mit Holzmanschette an der Taille und Ausgusstülle.
  chemex: (
    <g {...S}>
      <path d="M6.2 3.6h11.6l-4.4 8.2v.7l3.5 3.9a3.3 3.3 0 01-2.5 5.2h-4.8a3.3 3.3 0 01-2.5-5.2l3.5-3.9v-.7z" />
      <path d="M8 12.8h8M7.6 14.4h8.8" />
      <path d="M17.8 3.6l2 1.1" {...S_FEIN} />
    </g>
  ),

  // Kalita Wave: Kegel mit FLACHEM Boden und drei Standfüßen.
  kalita: (
    <g {...S}>
      <path d="M3.5 6.5h17" />
      <path d="M5.2 6.5l3.1 9.9h7.4l3.1-9.9" />
      <path d="M8.3 16.4h7.4" />
      <path d="M9.4 16.4v3.4M12 16.4v3.4M14.6 16.4v3.4" />
    </g>
  ),

  // Mokkakanne: zwei Kegel gegeneinander, Taille in der Mitte, Winkelgriff.
  // Bewusst wenige Linien — mit Deckelkontur wurde daraus auf 24 px ein
  // Knäuel. Der Knopf allein sagt schon „Deckel".
  mokapot: (
    <g {...S}>
      <path d="M11 3.4h2" />
      <path d="M12 3.4v1.2" {...S_FEIN} />
      <path d="M9.4 4.6h5.2l1.3 8.1H8.1z" />
      <path d="M7.4 12.7h9.2" />
      <path d="M8.4 12.7l-.9 6a1.8 1.8 0 001.8 2.1h5.4a1.8 1.8 0 001.8-2.1l-.9-6" />
      <path d="M17 9.6l3.4 1.6-1.6 3.2" />
    </g>
  ),

  // Cezve: unten weit, oben eng, langer gerader Griff. Kein Filter, kein
  // Deckel — die Silhouette sagt schon, dass hier gekocht wird.
  cezve: (
    <g {...S}>
      <path d="M4.6 6.4h8.8" />
      <path d="M5.6 6.4l1.4 10.4a2.6 2.6 0 002.6 2.2h1.2a2.6 2.6 0 002.6-2.2l1-7.4" />
      <path d="M13.4 7.2l2.2-1" {...S_FEIN} />
      <path d="M13.9 9.6l6.5-2.6" />
    </g>
  ),
}

/**
 * Das Zeichen zu einer Methodenkennung.
 *
 * Eine unbekannte Kennung zeichnet einen Kreis statt nichts: Ein leerer
 * Platz an der Stelle eines Symbols sieht wie ein Ladefehler aus, und in
 * einem Raster verschiebt er alles Übrige. Dass es passieren KANN, prüft
 * ein Test — die Kennungen stehen in methods.json und werden hier
 * gezeichnet, also können sie auseinanderlaufen.
 */
export const METHOD_ICON_IDS = Object.keys(ZEICHNUNGEN)

export function MethodIcon({
  icon,
  className = 'h-7 w-7',
}: {
  icon: string
  className?: string
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {ZEICHNUNGEN[icon] ?? <circle cx="12" cy="12" r="8" {...S} />}
    </svg>
  )
}

/**
 * Der Knopf, der den Durchgang startet.
 *
 * Kein Rechteck, sondern die Methode selbst: Wer einen V60 aufgesetzt
 * hat, sieht einen V60 und tippt ihn an. Das Zeichen wechselt mit der
 * gewählten Methode, und genau das ist der Punkt — der Knopf bestätigt
 * im Vorbeigehen, womit gleich gebrüht wird.
 *
 * Rund statt eckig hat außerdem einen nüchternen Grund: Ein Kreis mit
 * 132 px ist die einzige Form, die das Symbol groß genug zeigt und
 * trotzdem weniger hoch baut als ein Knopf über die volle Breite mit
 * Symbol und Text nebeneinander. Auf diesem Bildschirm zählt jede
 * Zeile — er muss ohne Scrollen erreichbar bleiben.
 */
export function BrewButton({
  icon,
  label = "Let's Brew",
  onClick,
}: {
  icon: string
  label?: string
  onClick: () => void
}) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={onClick}
        className="flex h-[132px] w-[132px] flex-col items-center justify-center gap-1 rounded-full bg-crema text-on-crema shadow-[0_6px_20px_-8px_rgba(0,0,0,0.45)] transition-transform active:scale-95"
      >
        <MethodIcon icon={icon} className="h-12 w-12" />
        <span className="text-lg leading-none font-semibold tracking-tight">{label}</span>
      </button>
    </div>
  )
}
