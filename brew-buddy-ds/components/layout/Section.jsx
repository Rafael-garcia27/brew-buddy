import React from 'react'

export function Section({ title, action, children }) {
  return (
    <section style={{ padding: '24px 16px 0' }}>
      {(title || action) && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: title ? 'space-between' : 'flex-end' }}>
          {title && <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, letterSpacing: 'var(--tracking-wide)', color: 'var(--color-mute)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
