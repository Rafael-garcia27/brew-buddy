import React from 'react'

export const inputStyle = { width: '100%', borderRadius: 'var(--radius-input)', border: '1px solid var(--color-line)', background: 'var(--color-raised)', padding: '12px 14px', color: 'var(--color-ink)', outline: 'none' }

export function TextInput({ value, onChange, placeholder, type = 'text' }) {
  return <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange && onChange(e.target.value)} className="bb-input" style={inputStyle} />
}
