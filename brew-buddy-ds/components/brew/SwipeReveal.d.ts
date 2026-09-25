import type { ReactNode, CSSProperties } from 'react'

/**
 * Wischgeste nach links legt Aktionen (Edit, Löschen) hinter einer Zeile frei.
 */
export interface SwipeRevealProps {
  actions: { label: string; tone?: 'bad'; onClick?: () => void }[]
  children: ReactNode
}

export declare function SwipeReveal(props: SwipeRevealProps): JSX.Element
