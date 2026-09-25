import type { ReactNode, CSSProperties } from 'react'

/**
 * Die drei Zahlen des Rezepts (In · Time · Out) nebeneinander und groß.
 */
export interface TriadProps {
  items: { label: string; value: string; unit?: string; term?: { term: string; aka?: string; short: string; long?: string; warning?: string }; hint?: string; tone?: 'ok' | 'warn' | 'bad'; onEdit?: () => void }[]
}

export declare function Triad(props: TriadProps): JSX.Element
