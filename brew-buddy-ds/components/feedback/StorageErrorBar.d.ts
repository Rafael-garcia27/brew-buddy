import type { ReactNode, CSSProperties } from 'react'

/**
 * Speicherfehler oben, geht nicht von selbst; führt zur Sicherung.
 */
export interface StorageErrorBarProps {
  text: string
  onBackup?: () => void
  onDismiss?: () => void
  floating?: boolean
}

export declare function StorageErrorBar(props: StorageErrorBarProps): JSX.Element
