import React from 'react'
import { Button } from '../actions/Button.jsx'

export function UpdateToast({ onReload, floating = true }) {
  return (
    <div className={floating ? 'pb-safe' : undefined} style={{ ...{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 'var(--radius-card)', border: '1px solid var(--color-line)', background: 'var(--color-raised)', padding: '12px 16px', boxShadow: 'var(--shadow-bar)' }, ...(floating ? { position: 'fixed', left: 16, right: 16, bottom: 96, zIndex: 40 } : null) }}>
      <p style={{ minWidth: 0, flex: 1, fontSize: 'var(--text-base)', lineHeight: 'var(--leading-snug)' }}>Eine neue Version steht bereit.</p>
      <Button size="sm" onClick={onReload}>Neu laden</Button>
    </div>
  )
}
