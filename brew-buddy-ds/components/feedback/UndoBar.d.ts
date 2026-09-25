import type { ReactNode, CSSProperties } from 'react'

/**
 * Rückgängig-Leiste nach einer Löschung, unten schwebend, geht nach 8 s von selbst.
 */
export interface UndoBarProps {
  text: string
  detail?: string
  onUndo: () => void
  /** false = im Fluss statt fixiert */
  floating?: boolean
}

export declare function UndoBar(props: UndoBarProps): JSX.Element
