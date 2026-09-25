import type { ReactNode, CSSProperties } from 'react'

/**
 * Zahnrad-Symbol im Kopf, führt ins Setup; bewusst gedämpft (faint).
 */
export interface GearButtonProps {
  onClick?: () => void
}

export declare function GearButton(props: GearButtonProps): JSX.Element
