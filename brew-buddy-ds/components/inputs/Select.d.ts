import type { ReactNode, CSSProperties } from 'react'

/**
 * Native Auswahlliste im Stil des Textfelds.
 */
export interface SelectProps {
  value: string
  onChange?: (v: string) => void
  options: { value: string; label: string }[]
}

export declare function Select(props: SelectProps): JSX.Element
