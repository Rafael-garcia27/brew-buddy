import type { ReactNode, CSSProperties } from 'react'

/**
 * Umschalter für 2–5 Optionen; mit Symbolen ab vier Segmenten.
 */
export interface SegmentedControlProps {
  options: { value: string; label: string; icon?: ReactNode }[]
  value: string
  onChange?: (v: string) => void
}

export declare function SegmentedControl(props: SegmentedControlProps): JSX.Element
