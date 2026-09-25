import type { ReactNode, CSSProperties } from 'react'

/**
 * Angehefteter Kopf mit Titel, optionalem Untertitel, Zurück und rechter Aktion.
 */
export interface HeaderProps {
  title: string
  subtitle?: string
  right?: ReactNode
  onBack?: () => void
  /** 70 statt 58 px, Titel 28 statt 20 px — für die Hauptbildschirme */
  large?: boolean
  /** angeheftete Zusatzzeile, z. B. die Methodenreihe auf „Brühen" */
  children?: ReactNode
}

export declare function Header(props: HeaderProps): JSX.Element
