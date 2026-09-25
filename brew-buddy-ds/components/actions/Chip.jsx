import React from 'react'
import { mix } from '../_lib/format.js'

export function Chip({ label, active, onClick, tone = 'neutral' }) {
  const t = tone === 'bad' ? ['--color-bad', '--color-bad'] : tone === 'good' ? ['--color-ok', '--color-ok'] : ['--color-crema', '--color-crema-ink']
  const look = active
    ? { background: mix(t[0], 20), borderColor: mix(t[0], 50), color: 'var(' + t[1] + ')', fontWeight: 500 }
    : { background: 'var(--color-raised)', borderColor: 'var(--color-line)', color: 'var(--color-mute)' }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={active ? undefined : 'bb-press-line'}
      style={{ minHeight: 44, borderRadius: 9999, padding: '0 14px', fontSize: 'var(--text-lg)', border: '1px solid', whiteSpace: 'nowrap', flexShrink: 0, transition: 'background-color 150ms, color 150ms', ...look }}
    >
      {label}
    </button>
  )
}
