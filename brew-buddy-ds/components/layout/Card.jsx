import React from 'react'
import { mix } from '../_lib/format.js'

const TONES = {
  default: { background: 'var(--color-card)', borderColor: 'var(--color-line)' },
  accent: { background: 'var(--color-card-accent)', borderColor: mix('--color-crema', 40) },
  warn: { background: 'var(--color-card)', borderColor: mix('--color-warn', 40) },
  bad: { background: 'var(--color-card)', borderColor: mix('--color-bad', 40) },
}

export function Card({ children, onClick, tone = 'default', selected, style }) {
  const Comp = onClick ? 'button' : 'div'
  const sel = selected ? { borderColor: 'var(--color-crema)', background: 'color-mix(in oklab, var(--color-crema) 5%, var(--color-card))' } : null
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={onClick ? 'bb-press-scale' : undefined}
      style={{ display: 'block', width: '100%', borderRadius: 'var(--radius-card)', border: '1px solid', padding: 16, textAlign: 'left', color: 'var(--color-ink)', ...TONES[tone], ...sel, ...style }}
    >
      {children}
    </Comp>
  )
}
