/**
 * Formatierung für Texte, die der Nutzer liest.
 *
 * Lag vorher zweimal wörtlich in `diagnose.ts` und `runcheck.ts` und in
 * Teilen ein drittes Mal in `freshness.ts`. Zahlen und Einheiten in ganzen
 * Sätzen sind aber kein Detail der jeweiligen Engine: Wenn die Oberfläche
 * daneben „1:2,8" schreibt und die Engine „1:2.8", ist eines von beidem
 * falsch — und man merkt erst hinterher, welches.
 */

/** Zahl in deutscher Schreibweise. */
export function de(v: number, decimals = 1): string {
  return v.toFixed(decimals).replace('.', ',')
}

/** Dauer lesbar: Sekunden beim Espresso, m:ss beim Handfilter. */
export function fmtDauer(s: number): string {
  const ganz = Math.round(s)
  if (ganz < 60) return `${ganz} s`
  return `${Math.floor(ganz / 60)}:${String(ganz % 60).padStart(2, '0')} min`
}

/**
 * Zeitspanne mit einer Einheit am Ende.
 *
 * Zweimal `fmtDauer` ergäbe „22 s–28 s" — die Einheit gehört an eine
 * Spanne einmal, nicht an jede Grenze.
 */
export function fmtSpanne([von, bis]: [number, number]): string {
  if (bis < 60) return `${Math.round(von)}–${Math.round(bis)} s`
  const uhr = (x: number) => {
    const g = Math.round(x)
    return `${Math.floor(g / 60)}:${String(g % 60).padStart(2, '0')}`
  }
  return `${uhr(von)}–${uhr(bis)} min`
}

/** Vorzeichenbehaftete Zahl mit typografischem Minus. Null hat keins. */
export function vorz(n: number): string {
  if (n === 0) return '0'
  return `${n > 0 ? '+' : '−'}${Math.abs(n)}`
}

/**
 * Tage im Nominativ: „1 Tag", „14 Tage".
 *
 * Klingt nach Kleinkram, ist aber der Unterschied zwischen einer App, die
 * jemand gebaut hat, und einer, die jemand fertig gebaut hat. „1 Tage —
 * noch zu frisch" stand bisher am ersten Tag jeder neuen Bag.
 */
export function tage(n: number): string {
  return `${n} ${n === 1 ? 'Tag' : 'Tage'}`
}

/** Dieselben Tage im Dativ: „nach 1 Tag", „nach 14 Tagen". */
export function tagen(n: number): string {
  return `${n} ${n === 1 ? 'Tag' : 'Tagen'}`
}
