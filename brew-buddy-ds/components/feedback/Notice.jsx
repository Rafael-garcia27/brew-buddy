import React from 'react'
import { Card } from '../layout/Card.jsx'
import { Button } from '../actions/Button.jsx'

export function Notice({ tone = 'accent', children, action, onAction, dismissLabel = 'Später', onDismiss }) {
  return (
    <Card tone={tone}>
      <div style={{ fontSize: 'var(--text-lg)', lineHeight: 'var(--leading-snug)' }}>{children}</div>
      {(action || onDismiss) && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          {action && <Button size="sm" onClick={onAction}>{action}</Button>}
          {onDismiss && <Button size="sm" variant="ghost" onClick={onDismiss}>{dismissLabel}</Button>}
        </div>
      )}
    </Card>
  )
}
