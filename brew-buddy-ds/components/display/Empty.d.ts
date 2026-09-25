import type { ReactNode, CSSProperties } from 'react'

/**
 * Leerzustand mit Titel, einem Satz und optionaler Aktion.
 */
export interface EmptyProps {
  title: string
  body: string
  action?: ReactNode
}

export declare function Empty(props: EmptyProps): JSX.Element
