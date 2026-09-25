import React, { useState } from 'react'
import { Sheet } from './Sheet.jsx'
import { mix } from '../_lib/format.js'

export function InfoDot({ term, inline }) {
  const [open, setOpen] = useState(false)
  if (!term) return null
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
        aria-label={'Was ist ' + term.term + '?'}
        style={{ margin: -12, width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
      >
        <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, border: '1px solid var(--color-line)', fontSize: 'var(--text-2xs)', fontWeight: 600, color: 'var(--color-mute)' }}>?</span>
      </button>
      {open && (
        <Sheet title={term.term} onClose={() => setOpen(false)} inline={inline}>
          {term.aka && <p style={{ marginBottom: 8, fontSize: 'var(--text-base)', color: 'var(--color-faint)' }}>auch: {term.aka}</p>}
          <p style={{ fontSize: 'var(--text-xl)', lineHeight: 'var(--leading-snug)' }}>{term.short}</p>
          {term.long && <p style={{ marginTop: 12, fontSize: 'var(--text-lg)', lineHeight: 'var(--leading-relaxed)', color: 'var(--color-mute)' }}>{term.long}</p>}
          {term.warning && <p style={{ marginTop: 12, borderRadius: 'var(--radius-input)', border: '1px solid ' + mix('--color-warn', 40), background: mix('--color-warn', 10), padding: 12, fontSize: 'var(--text-base)', color: 'var(--color-warn)' }}>{term.warning}</p>}
        </Sheet>
      )}
    </>
  )
}
