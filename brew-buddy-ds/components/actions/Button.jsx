import React from 'react'
import { mix } from '../_lib/format.js'

const VARIANTS = {
  primary: { background: 'var(--color-crema)', color: 'var(--color-on-crema)', fontWeight: 600, boxShadow: 'var(--shadow-soft)' },
  secondary: { background: 'var(--color-raised)', color: 'var(--color-ink)', border: '1px solid var(--color-line)' },
  ghost: { color: 'var(--color-crema-ink)' },
  danger: { background: mix('--color-bad', 15), color: 'var(--color-bad)', border: '1px solid ' + mix('--color-bad', 30) },
}
const SIZES = {
  sm: { height: 44, padding: '0 12px', fontSize: 'var(--text-base)' },
  md: { height: 48, padding: '0 20px', fontSize: 'var(--text-xl)' },
  lg: { height: 56, padding: '0 24px', fontSize: 'var(--text-xl)' },
}

export function Button({ children, onClick, variant = 'primary', size = 'md', disabled, type = 'button', block, style }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={'bb-btn bb-btn-' + variant}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderRadius: 'var(--radius-btn)', transition: 'background-color 150ms, color 150ms',
        width: block ? '100%' : undefined, whiteSpace: 'nowrap',
        ...VARIANTS[variant], ...SIZES[size], ...style,
      }}
    >
      {children}
    </button>
  )
}
