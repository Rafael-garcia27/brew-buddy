import type { ReactNode, CSSProperties } from 'react'

/**
 * Schaltfläche in vier Varianten; primary ist die eine Hauptaktion eines Bildschirms.
 * @startingPoint section="Aktionen" subtitle="Schaltfläche in vier Varianten; primary ist die eine Hauptaktion eines Bildschirms." viewport="700x360"
 */
export interface ButtonProps {
  children?: ReactNode
  onClick?: () => void
  /** primary = Akzentfläche · secondary = erhöhte Fläche mit Kante · ghost = nur Akzenttext · danger = zartes Rot */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** sm 44 px · md 48 px · lg 56 px Höhe */
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  type?: 'button' | 'submit'
  /** volle Breite (w-full im Original) */
  block?: boolean
  style?: CSSProperties
}

export declare function Button(props: ButtonProps): JSX.Element
