import type { ReactNode, CSSProperties } from 'react'

/**
 * Runder Startknopf (132 px) mit dem Zeichen der gewählten Methode.
 */
export interface BrewButtonProps {
  icon: string
  label?: string
  onClick?: () => void
}

export declare function BrewButton(props: BrewButtonProps): JSX.Element
