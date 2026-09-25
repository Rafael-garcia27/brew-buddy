import type { ReactNode, CSSProperties } from 'react'

/**
 * Schalter mit Beschriftung links über die volle Breite.
 */
export interface ToggleProps {
  checked: boolean
  onChange?: (v: boolean) => void
  label: string
}

export declare function Toggle(props: ToggleProps): JSX.Element
