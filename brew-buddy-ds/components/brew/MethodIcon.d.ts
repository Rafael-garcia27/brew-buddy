import type { ReactNode, CSSProperties } from 'react'

/**
 * Strichzeichnung einer Brühmethode (Siebträger, V60, AeroPress …).
 * @startingPoint section="Brühen" subtitle="Strichzeichnung einer Brühmethode (Siebträger, V60, AeroPress …)." viewport="700x440"
 */
export interface MethodIconProps {
  /** espresso · v60 · aeropress · frenchpress · batchbrew · chemex · kalita · mokapot · cezve */
  icon: string
  size?: number
  style?: CSSProperties
}

export declare function MethodIcon(props: MethodIconProps): JSX.Element
