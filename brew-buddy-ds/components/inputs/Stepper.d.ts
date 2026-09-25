import type { ReactNode, CSSProperties } from 'react'

/**
 * Zahleneingabe mit großen −/+-Knöpfen; Gedrückthalten beschleunigt, der Wert ist tippbar.
 */
export interface StepperProps {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
  decimals?: number
  label?: string
  /** Zeit als m:ss */
  clock?: boolean
}

export declare function Stepper(props: StepperProps): JSX.Element
