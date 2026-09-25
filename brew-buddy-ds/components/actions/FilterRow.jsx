import React from 'react'

export function FilterRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 68, flexShrink: 0, fontSize: 'var(--text-2xs)', lineHeight: 'var(--leading-tight)', color: 'var(--color-faint)' }}>{label}</span>
      <div className="scroll-area bb-noscroll" style={{ margin: '0 -4px', display: 'flex', flex: 1, gap: 6, overflowX: 'auto', padding: '2px 4px' }}>
        {children}
      </div>
    </div>
  )
}
