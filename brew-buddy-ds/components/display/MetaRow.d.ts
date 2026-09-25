import type { ReactNode, CSSProperties } from 'react'

/**
 * Nebenwerte in einer Zeile (Ratio, Temp, Grind).
 */
export interface MetaRowProps {
  items: { label: string; value: string; term?: { term: string; aka?: string; short: string; long?: string; warning?: string }; tone?: 'ok' | 'warn' | 'bad'; hint?: string; onEdit?: () => void }[]
}

export declare function MetaRow(props: MetaRowProps): JSX.Element
