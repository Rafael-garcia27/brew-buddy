import React from 'react'

export function FreshnessRing({ score, size = 36, label }) {
  const dicke = Math.max(3, Math.round(size / 14))
  const r = (size - dicke - 2) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score))
  const color = pct > 65 ? 'var(--color-ok)' : pct > 35 ? 'var(--color-warn)' : 'var(--color-bad)'
  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={dicke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={dicke} strokeLinecap="round" strokeDasharray={(pct / 100) * c + ' ' + c} />
      </svg>
      {label && <span className="tnum" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: Math.max(11, Math.round(size / 3.6)) }}>{label}</span>}
    </div>
  )
}
