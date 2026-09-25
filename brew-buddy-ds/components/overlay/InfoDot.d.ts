import type { ReactNode, CSSProperties } from 'react'

/**
 * Kleines „?" neben einem Fachbegriff; öffnet ein Blatt mit der Erklärung aus dem Glossar.
 */
export interface InfoDotProps {
  term?: { term: string; aka?: string; short: string; long?: string; warning?: string }
  inline?: boolean
}

export declare function InfoDot(props: InfoDotProps): JSX.Element
