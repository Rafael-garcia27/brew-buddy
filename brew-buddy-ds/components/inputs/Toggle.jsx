import React from 'react'

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} onClick={() => onChange && onChange(!checked)} style={{ display: 'flex', minHeight: 48, width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left' }}>
      <span style={{ fontSize: 'var(--text-xl)' }}>{label}</span>
      <span style={{ position: 'relative', height: 28, width: 48, flexShrink: 0, borderRadius: 9999, background: checked ? 'var(--color-crema)' : 'var(--color-line)', transition: 'background-color 150ms' }}>
        <span style={{ position: 'absolute', top: 2, left: 0, height: 24, width: 24, borderRadius: 9999, background: '#fff', transform: 'translateX(' + (checked ? 22 : 2) + 'px)', transition: 'transform 150ms' }} />
      </span>
    </button>
  )
}
