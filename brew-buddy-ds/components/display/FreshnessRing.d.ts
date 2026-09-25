import type { ReactNode, CSSProperties } from 'react'

/**
 * Frische-Ring einer Tüte: Anteil als Bogen, Farbe nach Zustand, optional Tage in der Mitte.
 */
export interface FreshnessRingProps {
  score: number
  size?: number
  label?: string
}

export declare function FreshnessRing(props: FreshnessRingProps): JSX.Element
