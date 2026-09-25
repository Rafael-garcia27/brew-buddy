import type { ReactNode, CSSProperties } from 'react'

/**
 * Umschaltbarer Filter- oder Merkmal-Chip, Pille mit 44 px Mindesthöhe.
 */
export interface ChipProps {
  label: string
  active?: boolean
  onClick?: () => void
  /** Farbe im aktiven Zustand: neutral = Akzent, bad = Fehler, good = Grün */
  tone?: 'neutral' | 'bad' | 'good'
}

export declare function Chip(props: ChipProps): JSX.Element
