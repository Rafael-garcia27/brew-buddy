import React, { useEffect, useRef, useState } from 'react'
import { num, fmtClock } from '../_lib/format.js'

const knopf = { height: 56, width: 56, flexShrink: 0, borderRadius: 'var(--radius-input)', border: '1px solid var(--color-line)', background: 'var(--color-raised)', fontSize: 'var(--text-2xl)', color: 'var(--color-crema-ink)' }

export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, unit, decimals = 0, label, clock = false }) {
  const clamp = (v) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  const hold = useRef({})
  const valueRef = useRef(value)
  valueRef.current = value
  const [draft, setDraft] = useState(null)
  const anzeige = (v) => (clock ? fmtClock(v) : num(v, decimals))
  const shown = draft !== null ? draft : anzeige(value)

  const parse = (raw) => {
    const t = raw.trim()
    if (clock && t.includes(':')) {
      const [m, s] = t.split(':')
      return parseInt(m || '0', 10) * 60 + parseInt(s || '0', 10)
    }
    return parseFloat(t.replace(',', '.'))
  }
  const commit = (raw) => { setDraft(null); const n = parse(raw); if (Number.isFinite(n)) onChange(clamp(n)) }
  const stopHold = () => { clearTimeout(hold.current.timer); clearTimeout(hold.current.interval); hold.current = {} }
  const startHold = (dir) => {
    stopHold()
    hold.current.timer = setTimeout(() => {
      let speed = 120
      const tick = () => {
        valueRef.current = clamp(valueRef.current + dir * step)
        onChange(valueRef.current)
        speed = Math.max(30, speed * 0.85)
        hold.current.interval = setTimeout(tick, speed)
      }
      tick()
    }, 400)
  }
  useEffect(() => stopHold, [])
  const holdProps = (dir) => ({ onPointerDown: () => startHold(dir), onPointerUp: stopHold, onPointerLeave: stopHold, onPointerCancel: stopHold })

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
      <button type="button" aria-label="weniger" {...holdProps(-1)} onClick={() => onChange(clamp(value - step))} className="bb-press-line" style={knopf}>−</button>
      <div className="bb-within" style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-input)', border: '1px solid var(--color-line)', background: 'var(--color-raised)' }}>
        <input
          type="text"
          inputMode={clock ? 'numeric' : 'decimal'}
          aria-label={label}
          value={shown}
          onChange={(e) => {
            const raw = e.target.value.replace(clock ? /[^0-9:]/g : /[^0-9.,-]/g, '')
            setDraft(raw)
            const n = parse(raw)
            if (Number.isFinite(n) && n >= min && n <= max) onChange(clamp(n))
          }}
          onFocus={(e) => { setDraft(anzeige(value)); const el = e.target; requestAnimationFrame(() => el.select()) }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setDraft(null); e.target.blur() } }}
          className="tnum"
          style={{ width: '100%', minWidth: 0, border: 0, background: 'transparent', padding: '16px 0', textAlign: 'center', fontWeight: 600, outline: 'none', fontSize: 'var(--text-stepper)' }}
        />
        {unit && <span style={{ paddingRight: 12, fontSize: 'var(--text-base)', color: 'var(--color-mute)' }}>{unit}</span>}
      </div>
      <button type="button" aria-label="mehr" {...holdProps(1)} onClick={() => onChange(clamp(value + step))} className="bb-press-line" style={knopf}>+</button>
    </div>
  )
}
