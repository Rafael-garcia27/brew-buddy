/** Hilfen aus src/components/ui.tsx — keine Komponenten. */
export function num(v, decimals) {
  if (decimals === undefined) decimals = 1
  return v.toFixed(decimals).replace('.', ',')
}
export function fmtClock(s) {
  const ganz = Math.max(0, Math.round(s))
  return Math.floor(ganz / 60) + ':' + String(ganz % 60).padStart(2, '0')
}
/** Tailwind-Deckkraft wie bg-crema/20: color-mix in oklab. */
export function mix(varName, pct) {
  return 'color-mix(in oklab, var(' + varName + ') ' + pct + '%, transparent)'
}
export const trunc = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
