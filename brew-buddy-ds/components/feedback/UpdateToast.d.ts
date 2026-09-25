import type { ReactNode, CSSProperties } from 'react'

/**
 * Hinweis auf eine neue Version mit „Neu laden".
 */
export interface UpdateToastProps {
  onReload?: () => void
  floating?: boolean
}

export declare function UpdateToast(props: UpdateToastProps): JSX.Element
