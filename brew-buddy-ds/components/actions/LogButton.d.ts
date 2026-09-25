import type { ReactNode, CSSProperties } from 'react'

/**
 * Logbuch-Symbol im Kopf; eine Stufe präsenter als das Zahnrad (mute).
 */
export interface LogButtonProps {
  onClick?: () => void
}

export declare function LogButton(props: LogButtonProps): JSX.Element
