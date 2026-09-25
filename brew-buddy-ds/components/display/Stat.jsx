import React from 'react'
import { InfoDot } from '../overlay/InfoDot.jsx'

export const toneColor = (tone, fallback) => tone === 'ok' ? 'var(--color-ok)' : tone === 'warn' ? 'var(--color-warn)' : tone === 'bad' ? 'var(--color-bad)' : (fallback || 'var(--color-ink)')

export function Stat({ label, value, unit, term, tone, hint }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-mute)' }}>{label}</span>
        {term && <InfoDot term={term} />}
      </div>
      <div className="tnum" style={{ fontSize: 'var(--text-2xl)', lineHeight: 'var(--leading-tight)', fontWeight: 600, color: toneColor(tone) }}>
        {value}
        {unit && <span style={{ marginLeft: 2, fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--color-mute)' }}>{unit}</span>}
      </div>
      {hint && <div style={{ marginTop: 2, fontSize: 'var(--text-xs)', color: 'var(--color-faint)' }}>{hint}</div>}
    </div>
  )
}
