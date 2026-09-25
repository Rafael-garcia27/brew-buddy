import React from 'react'
import { Button } from '../actions/Button.jsx'
import { trunc } from '../_lib/format.js'

export function UndoBar({ text, detail, onUndo, floating = true }) {
  return (
    <div className={floating ? 'pb-safe' : undefined} style={floating ? { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, padding: '0 16px 12px' } : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 'var(--radius-card)', border: '1px solid var(--color-line)', background: 'var(--color-raised)', padding: '12px 16px', boxShadow: 'var(--shadow-bar)' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 'var(--text-base)', ...trunc }}>{text}</p>
          {detail && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-mute)', ...trunc }}>{detail}</p>}
        </div>
        <Button size="sm" onClick={onUndo}>Rückgängig</Button>
      </div>
    </div>
  )
}
