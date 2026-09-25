import type { ReactNode, CSSProperties } from 'react'

/**
 * Die Grundfläche: Karte mit 1-px-Kante; antippbar, wenn onClick gesetzt ist.
 */
export interface CardProps {
  children?: ReactNode
  onClick?: () => void
  /** accent = hervorgehoben (Vorschlag, Hinweis) · warn / bad = Kante in Signalfarbe */
  tone?: 'default' | 'accent' | 'warn' | 'bad'
  /** gewählt in einer Liste: Akzentkante + 5 % Akzentfläche */
  selected?: boolean
  style?: CSSProperties
}

export declare function Card(props: CardProps): JSX.Element
