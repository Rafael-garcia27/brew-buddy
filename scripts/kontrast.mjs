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
/** Alles, was als Textfarbe benutzt wird. */
const TEXT = ['--c-ink', '--c-mute', '--c-faint', '--c-crema', '--c-ok', '--c-warn', '--c-bad']
/** WCAG 2.1 AA für Fließtext. Die App hat viel Text unter 18 px. */
const MINDEST = 4.5

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
}

console.log()
if (durchgefallen) {
  console.error(`${durchgefallen} Kombination(en) unter ${MINDEST}:1 — mit ! markiert.`)
  process.exit(1)
}
console.log(`Alle Kombinationen ≥ ${MINDEST}:1 (WCAG 2.1 AA).`)
