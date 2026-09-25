import React from 'react'
import { Button } from '../actions/Button.jsx'
import { mix } from '../_lib/format.js'

export function StorageErrorBar({ text, onBackup, onDismiss, floating = true }) {
  return (
    <div className={floating ? 'pt-safe' : undefined} style={floating ? { position: 'sticky', top: 0, zIndex: 50, padding: '8px 16px' } : undefined}>
      <div style={{ borderRadius: 'var(--radius-card)', border: '1px solid ' + mix('--color-bad', 50), background: mix('--color-bad', 15), padding: '12px 16px', boxShadow: 'var(--shadow-bar)' }}>
        <p style={{ fontSize: 'var(--text-base)', lineHeight: 'var(--leading-snug)' }}>{text}</p>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <Button size="sm" onClick={onBackup}>Jetzt sichern</Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>Später</Button>
        </div>
      </div>
    </div>
  )
}
