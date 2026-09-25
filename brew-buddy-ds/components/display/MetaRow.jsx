import React from 'react'
import { InfoDot } from '../overlay/InfoDot.jsx'
import { toneColor } from './Stat.jsx'
import { mix } from '../_lib/format.js'

export function MetaRow({ items }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px' }}>
      {items.map((it) => {
        const wert = <span className="tnum" style={{ fontWeight: 500, whiteSpace: 'nowrap', color: toneColor(it.tone, 'var(--color-mute)') }}>{it.value}</span>
        return (
          <span key={it.label} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontSize: 'var(--text-sm)' }}>
            <span style={{ color: 'var(--color-faint)' }}>{it.label}</span>
            {it.onEdit ? <button type="button" onClick={it.onEdit} aria-label={it.label + ' anpassen'} className="bb-press-dim" style={{ borderBottom: '1px dashed ' + mix('--color-crema', 45) }}>{wert}</button> : wert}
            {it.hint && <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-faint)' }}>{it.hint}</span>}
            {it.term && <InfoDot term={it.term} />}
          </span>
        )
      })}
    </div>
  )
}
