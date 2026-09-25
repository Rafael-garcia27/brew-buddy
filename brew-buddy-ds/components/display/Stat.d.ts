import type { ReactNode, CSSProperties } from 'react'

/**
 * Einzelwert mit Beschriftung, Einheit und optionaler Zusatzzeile.
 * @startingPoint section="Anzeige" subtitle="Einzelwert mit Beschriftung, Einheit und optionaler Zusatzzeile." viewport="700x520"
 */
export interface StatProps {
  label: string
  value: string | number
  unit?: string
  term?: { term: string; aka?: string; short: string; long?: string; warning?: string }
  tone?: 'ok' | 'warn' | 'bad'
  hint?: string
}

export declare function Stat(props: StatProps): JSX.Element
