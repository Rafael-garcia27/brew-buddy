import type { ReactNode, CSSProperties } from 'react'

/**
 * Untere Reiterleiste mit den drei Einstiegen Brühen · Regal · Verlauf.
 */
export interface TabBarProps {
  items?: { id: string; label: string; icon: string }[]
  active: string
  onChange?: (id: string) => void
}

export declare function TabBar(props: TabBarProps): JSX.Element
