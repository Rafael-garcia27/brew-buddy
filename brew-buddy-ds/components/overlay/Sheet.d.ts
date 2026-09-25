import type { ReactNode, CSSProperties } from 'react'

/**
 * Modales Blatt von unten mit Titel, Schließen und optionalem Fuß.
 * @startingPoint section="Overlay" subtitle="Modales Blatt von unten mit Titel, Schließen und optionalem Fuß." viewport="700x420"
 */
export interface SheetProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** im Elternelement statt per Portal an body — für Mockups in einem Gerätrahmen */
  inline?: boolean
}

export declare function Sheet(props: SheetProps): JSX.Element
