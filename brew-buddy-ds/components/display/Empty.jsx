import React from 'react'

export function Empty({ title, body, action }) {
  return (
    <div style={{ padding: '64px 16px', textAlign: 'center' }}>
      <p style={{ fontSize: 'var(--text-xl)', fontWeight: 500 }}>{title}</p>
      <p style={{ margin: '8px auto 0', maxWidth: '34ch', fontSize: 'var(--text-lg)', lineHeight: 'var(--leading-relaxed)', color: 'var(--color-mute)' }}>{body}</p>
      {action && <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>{action}</div>}
    </div>
  )
}
