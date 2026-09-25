import type { ReactNode, CSSProperties } from 'react'

/**
 * Eine Filterachse als waagerecht scrollende Zeile mit Achsennamen links.
 */
export interface FilterRowProps {
  label: string
  children: ReactNode
}

export declare function FilterRow(props: FilterRowProps): JSX.Element
