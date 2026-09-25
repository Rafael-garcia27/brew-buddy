import React from 'react'
import { InfoDot } from '../overlay/InfoDot.jsx'
import { toneColor } from './Stat.jsx'
import { mix } from '../_lib/format.js'

export function Triad({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      {items.map((it, i) => {
        const groesse = it.value.length >= 9 ? 'var(--text-xl)' : it.value.length >= 5 ? 'var(--text-2xl)' : 'var(--text-3xl)'
        const zahl = (
          <>
            <div className="tnum" style={{ marginTop: 6, lineHeight: 1, fontWeight: 600, fontSize: groesse, color: toneColor(it.tone) }}>
              {it.value}
              {it.unit && <span style={{ marginLeft: 2, fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--color-mute)' }}>{it.unit}</span>}
            </div>
            {it.hint && <div style={{ marginTop: 4, fontSize: 'var(--text-2xs)', lineHeight: 'var(--leading-tight)', color: 'var(--color-faint)' }}>{it.hint}</div>}
          </>
        )
        return (
          <div key={it.label} style={{ minWidth: 0, textAlign: 'center', padding: i === 0 ? '0 2px 0 0' : i === items.length - 1 ? '0 0 0 2px' : '0 2px', borderLeft: i ? '1px solid var(--color-line)' : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 500, letterSpacing: 'var(--tracking-wider)', color: 'var(--color-mute)', textTransform: 'uppercase' }}>{it.label}</span>
              {it.term && <InfoDot term={it.term} />}
            </div>
            {it.onEdit ? (
              <button type="button" onClick={it.onEdit} aria-label={it.label + ' anpassen'} className="bb-press-dim" style={{ width: '100%', borderBottom: '1px dashed ' + mix('--color-crema', 45), paddingBottom: 4 }}>{zahl}</button>
            ) : zahl}
          </div>
        )
      })}
    </div>
  )
}
