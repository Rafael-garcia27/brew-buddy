/**
 * Die Bildmarke — zwei B aus Bohnenprofilen, die sich anlehnen.
 *
 * Übertragen aus `brew-buddy-ds/assets/logo/bildmarke-min-*.svg`, der
 * Detailstufe unter 32 px: nur die Bohnen, ohne das Geflecht des Sefed.
 * Mehr trägt eine Kopfzeile nicht; die Stiche verschwämmen zu Rauschen.
 *
 * Als Komponente statt als Bilddatei, weil die Marke dem Thema folgt.
 * Das Design-System liefert vier Dateien für vier Farbwelten; hier sind
 * es zwei Variablen, und die Marke färbt sich mit, wenn man in den
 * Einstellungen das Thema wechselt:
 *
 *   Scheibe  --c-raised  (dieselbe Fläche wie gewählte Zeilen)
 *   Bohnen   --c-mark    (Tinte in Hell, Crema in Dunkel, Terracotta in Organic)
 *
 * Nicht verändern (Design-System, Abschnitt Marke): Neigung, Bohnenform,
 * Reihenfolge. Keine Schatten, keine Verläufe.
 */
const BOHNE_OBEN = 'M63 66 C78.6 65.7 87.3 74.3 87 83.3 C86.7 92.9 75.6 98.3 63.6 98 C58.8 97.7 56.7 94.8 57.3 89 C56.1 82.6 56.4 75.6 57.6 71.1 C58.2 67.6 60 66 63 66 Z'
const NAHT_OBEN = 'M70.8 71.1 C76.9 77.5 74.6 87.1 69.6 93.5 C70.2 87.1 72.5 77.5 70.8 71.1 Z'
const BOHNE_UNTEN = 'M64.2 102 C82.9 101.7 93.4 110.8 93 120.4 C92.6 130.6 79.3 136.3 64.9 136 C59.2 135.7 56.6 132.6 57.4 126.5 C55.9 119.7 56.3 112.2 57.7 107.4 C58.4 103.7 60.6 102 64.2 102 Z'
const NAHT_UNTEN = 'M73.6 107.4 C80.4 114.2 77.6 124.4 72.1 131.2 C73.2 124.4 76 114.2 73.6 107.4 Z'

/** Ein B: zwei Bohnen übereinander. Das zweite B ist dasselbe, um 50 verschoben. */
function B({ dx, winkel, drehpunkt }: { dx: number; winkel: number; drehpunkt: number }) {
  const naht = { fill: 'var(--c-raised)', stroke: 'var(--c-raised)', strokeWidth: 1, strokeLinejoin: 'round' as const }
  return (
    <g transform={`rotate(${winkel} ${drehpunkt} 136) translate(${dx} 0)`}>
      <path d={BOHNE_OBEN} fill="var(--c-mark)" />
      <path d={NAHT_OBEN} {...naht} />
      <path d={BOHNE_UNTEN} fill="var(--c-mark)" />
      <path d={NAHT_UNTEN} {...naht} />
    </g>
  )
}

export default function Bildmarke({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className="shrink-0"
      // Schmuck neben einem Titel, der schon sagt, wo man ist. Der Name
      // der App steht unter dem Icon und in der Titelzeile.
      aria-hidden="true"
    >
      <circle cx="100" cy="100" r="98" fill="var(--c-raised)" />
      <g transform="translate(100 100) scale(1.42) translate(-100 -101)">
        <B dx={0} winkel={5} drehpunkt={57} />
        {/* Im Original stehen die Pfade des zweiten B bei x + 50 und
            drehen um (107 136). `translate` wirkt vor `rotate`, also
            liegt der Drehpunkt schon an der verschobenen Stelle. */}
        <B dx={50} winkel={-5} drehpunkt={107} />
      </g>
    </svg>
  )
}
