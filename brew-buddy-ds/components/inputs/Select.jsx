import React from 'react'
import { inputStyle } from './TextInput.jsx'

export function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange && onChange(e.target.value)} className="bb-input" style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none' }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
