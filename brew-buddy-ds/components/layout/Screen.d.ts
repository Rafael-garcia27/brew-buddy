import type { ReactNode, CSSProperties } from 'react'

/**
 * Bildschirm-Hülle: min. volle Höhe plus 40 px Luft unter dem letzten Element.
 * @startingPoint section="Layout" subtitle="Bildschirm-Hülle: min. volle Höhe plus 40 px Luft unter dem letzten Element." viewport="700x520"
 */
export interface ScreenProps {
  children: ReactNode
}

export declare function Screen(props: ScreenProps): JSX.Element
