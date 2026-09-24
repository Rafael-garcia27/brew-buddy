#!/usr/bin/env node
/**
 * Kontrastprüfung der Design-Tokens gegen WCAG 2.1 AA.
 *
 * Anlass ist Befund F-05: Vier Textfarben lagen unter 4,5:1, und
 * aufgefallen ist das erst beim Audit. Ein einmaliges Nachziehen hält
 * nicht — der nächste Griff in die Palette kippt es wieder, und niemand
 * rechnet dabei nach. Deshalb ist die Prüfung hier ein Kommando, das in
 * der CI mitläuft: `npm run kontrast`.
 *
 * Geprüft wird jede Textfarbe gegen jeden Untergrund, in beiden Themes.
 * Das ist strenger als nötig — nicht jede Kombination kommt in der App
 * wirklich vor —, aber die Alternative wäre eine gepflegte Liste, die
 * altert. Der Preis sind ein paar Töne, die dunkler sind als unbedingt
 * nötig; das ist der bessere Fehler.
 *
 * Rundungsfehler: Die Zahlen sind die der WCAG-Formel, nicht die von
 * Chrome DevTools — die runden anders. Abweichungen in der zweiten
 * Nachkommastelle sind normal.
 */
import { readFileSync } from 'node:fs'

/** Untergründe, auf denen in der App Text steht. */
const GRUND = ['--c-paper', '--c-card', '--c-raised']
/**
 * Alles, was als Textfarbe benutzt wird.
 *
 * `--c-crema` stand hier, solange es beides war: Akzentfläche UND
 * Akzenttext. Mit dem dritten Thema geht das nicht mehr zusammen — ein
 * Terracotta, das auf Creme als Fläche funktioniert, erreicht als
 * 13-px-Schrift keine 4,5:1. Seitdem gibt es `--c-crema-ink` für Text,
 * und `--c-crema` trägt nur noch Flächen, Ränder und Icons. Die Liste
 * hier folgt dieser Trennung; sonst prüfte sie eine Verwendung, die es
 * nicht mehr gibt, und verböte eine Palette, die richtig ist.
 */
const TEXT = ['--c-ink', '--c-mute', '--c-faint', '--c-crema-ink', '--c-ok', '--c-warn', '--c-bad']
/**
 * Nicht-Text: WCAG 1.4.11 verlangt für Bedienelemente 3:1.
 *
 * Nur der Akzent steht hier, und zwar genau deshalb, weil er seine Rolle
 * gewechselt hat: Er trägt keinen Text mehr, aber weiterhin Icons,
 * Ränder und den Fokusring. Für diese Rolle gilt 3:1 statt 4,5:1.
 *
 * `--c-line` und `--c-crema-dim` bleiben bewusst draußen. Haarlinien
 * zwischen Zeilen und abgeblendete Varianten sind nach 1.4.11 kein
 * Bedienelement; sie hier aufzunehmen hieße, drei Paletten wegen einer
 * Trennlinie umzubauen. Das wäre eine eigene Entscheidung.
 */
const NICHT_TEXT = ['--c-crema']
/** WCAG 2.1 AA für Fließtext. Die App hat viel Text unter 18 px. */
const MINDEST = 4.5
const MINDEST_UI = 3

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

function tokens(block) {
  const m = css.match(new RegExp(`${block}\\s*\\{([\\s\\S]*?)\\n\\}`))
  if (!m) throw new Error(`Block ${block} nicht gefunden — hat sich index.css umgebaut?`)
  const out = {}
  for (const [, k, v] of m[1].matchAll(/(--c-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[k] = v
  return out
}

const linear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const helligkeit = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const verhaeltnis = (a, b) => {
  const [hell, dunkel] = [helligkeit(a), helligkeit(b)].sort((x, y) => y - x)
  return (hell + 0.05) / (dunkel + 0.05)
}

let durchgefallen = 0

for (const [name, block] of [
  ['HELL — Milchkaffee', ':root'],
  ['DUNKEL — Espresso', 'html\\.dark'],
  ['ORGANIC', 'html\\.organic'],
]) {
  const t = tokens(block)
  console.log(`\n${name}`)
  console.log('  ' + 'Text'.padEnd(12) + GRUND.map((g) => g.slice(4).padStart(10)).join(''))
  for (const f of TEXT) {
    const zellen = GRUND.map((g) => {
      const v = verhaeltnis(t[f], t[g])
      if (v < MINDEST) durchgefallen++
      return (v.toFixed(2) + (v < MINDEST ? ' !' : '  ')).padStart(10)
    })
    console.log('  ' + f.slice(4).padEnd(12) + zellen.join(''))
  }
  // Ränder und Icons brauchen weniger, aber nicht nichts.
  for (const f of NICHT_TEXT) {
    const zellen = GRUND.map((g) => {
      if (f === g) return '—'.padStart(10)
      const v = verhaeltnis(t[f], t[g])
      if (v < MINDEST_UI) durchgefallen++
      return (v.toFixed(2) + (v < MINDEST_UI ? ' !' : '  ')).padStart(10)
    })
    console.log('  ' + (f.slice(4) + ' ·').padEnd(12) + zellen.join(''))
  }
}

console.log()
if (durchgefallen) {
  console.error(`${durchgefallen} Kombination(en) unter ${MINDEST}:1 — mit ! markiert.`)
  process.exit(1)
}
console.log(`Alle Kombinationen ≥ ${MINDEST}:1 (WCAG 2.1 AA).`)
