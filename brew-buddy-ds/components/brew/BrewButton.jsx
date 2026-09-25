import React from 'react'
import { MethodIcon } from './MethodIcon.jsx'

export function BrewButton({ icon, label = "Let's Brew", onClick }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <button type="button" onClick={onClick} className="bb-press-95" style={{ height: 132, width: 132, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 9999, background: 'var(--color-crema)', color: 'var(--color-on-crema)', boxShadow: 'var(--shadow-brew)' }}>
        <MethodIcon icon={icon} size={48} />
        <span style={{ fontSize: 'var(--text-lg)', lineHeight: 1, fontWeight: 600, letterSpacing: 'var(--tracking-tight)' }}>{label}</span>
      </button>
    </div>
  )
}
