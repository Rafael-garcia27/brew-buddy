import React from 'react'
import { InfoDot } from '../overlay/InfoDot.jsx'

export function Field({ label, hint, term, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-mute)' }}>{label}</span>
        {term && <InfoDot term={term} />}
      </div>
      {children}
      {hint && <p style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-faint)' }}>{hint}</p>}
    </label>
  )
}
