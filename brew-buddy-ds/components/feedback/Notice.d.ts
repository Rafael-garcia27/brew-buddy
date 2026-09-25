import type { ReactNode, CSSProperties } from 'react'

/**
 * Hinweiskarte mit Satz und bis zu zwei Knöpfen (Aktion + „Später").
 * @startingPoint section="Rückmeldung" subtitle="Hinweiskarte mit Satz und bis zu zwei Knöpfen (Aktion + „Später')." viewport="700x480"
 */
export interface NoticeProps {
  tone?: 'accent' | 'warn' | 'bad'
  children: ReactNode
  action?: string
  onAction?: () => void
  dismissLabel?: string
  onDismiss?: () => void
}

export declare function Notice(props: NoticeProps): JSX.Element
