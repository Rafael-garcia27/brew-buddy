import type { ReactNode, CSSProperties } from 'react'

/**
 * Beschriftetes Formularfeld mit optionalem Hinweis und Glossar-Punkt.
 * @startingPoint section="Eingaben" subtitle="Beschriftetes Formularfeld mit optionalem Hinweis und Glossar-Punkt." viewport="700x520"
 */
export interface FieldProps {
  label: string
  hint?: string
  term?: { term: string; aka?: string; short: string; long?: string; warning?: string }
  children: ReactNode
}

export declare function Field(props: FieldProps): JSX.Element
