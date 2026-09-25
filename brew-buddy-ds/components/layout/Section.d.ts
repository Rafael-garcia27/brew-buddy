import type { ReactNode, CSSProperties } from 'react'

/**
 * Abschnitt mit 16 px Rand und 24 px Abstand nach oben; optional Versal-Überschrift und rechte Zusatzangabe.
 */
export interface SectionProps {
  title?: string
  action?: ReactNode
  children: ReactNode
}

export declare function Section(props: SectionProps): JSX.Element
