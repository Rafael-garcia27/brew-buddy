import React, { useRef, useState } from 'react'

const AKTION_PX = 88

export function SwipeReveal({ actions = [], children }) {
  const [x, setX] = useState(0)
  const [ziehe, setZiehe] = useState(false)
  const zug = useRef(null)
  const breite = actions.length * AKTION_PX
  const down = (e) => { zug.current = { x0: e.clientX, ab: x, moved: false } }
  const move = (e) => {
    const z = zug.current
    if (!z) return
    const dx = e.clientX - z.x0
    if (!z.moved && Math.abs(dx) > 8) { z.moved = true; setZiehe(true) }
    if (z.moved) setX(Math.max(0, Math.min(breite, z.ab - dx)))
  }
  const up = () => {
    const z = zug.current
    zug.current = null
    setZiehe(false)
    if (!z || !z.moved) return
    const stufen = [0].concat(actions.map((_, i) => (i + 1) * AKTION_PX))
    setX((w) => stufen.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a)))
  }
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden={x === 0 ? 'true' : undefined} style={{ visibility: x === 0 && !ziehe ? 'hidden' : 'visible', position: 'absolute', top: 0, bottom: 0, right: 0, width: breite, display: 'flex', flexDirection: 'row-reverse', gap: 6, padding: 6 }}>
        {actions.map((a) => (
          <button key={a.label} type="button" onClick={() => { setX(0); a.onClick && a.onClick() }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 'var(--radius-input)', fontSize: 'var(--text-sm)', fontWeight: 500, background: a.tone === 'bad' ? 'var(--color-bad)' : 'var(--color-raised)', color: a.tone === 'bad' ? '#fff' : 'var(--color-ink)' }}>{a.label}</button>
        ))}
      </div>
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ position: 'relative', transform: 'translateX(' + -x + 'px)', transition: ziehe ? 'none' : 'transform 200ms ease', touchAction: 'pan-y' }}>
        {children}
      </div>
    </div>
  )
}
