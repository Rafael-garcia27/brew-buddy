import type { ReactNode, CSSProperties } from 'react'

/**
 * Einzeiliges Textfeld auf erhöhter Fläche.
 */
export interface TextInputProps {
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  type?: string
}

export declare function TextInput(props: TextInputProps): JSX.Element
