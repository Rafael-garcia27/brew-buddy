import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function Sheet({ title, onClose, children, footer, inline }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const node = (
    <div role="dialog" aria-modal="true" style={{ position: inline ? 'absolute' : 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div aria-hidden="true" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
      <div className="scroll-area" style={{ position: 'relative', maxHeight: inline ? '88%' : '88dvh', overflowY: 'auto', borderTopLeftRadius: 'var(--radius-sheet)', borderTopRightRadius: 'var(--radius-sheet)', borderTop: '1px solid var(--color-line)', background: 'var(--color-card)', boxShadow: 'var(--shadow-float)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--color-line)', background: 'var(--color-card)', padding: '12px 16px' }}>
          <h3 className="titel" style={{ fontSize: 'var(--text-xl)' }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Schließen" className="bb-press-raised" style={{ marginRight: -4, width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, color: 'var(--color-mute)' }}>✕</button>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
        {footer && <div style={{ position: 'sticky', bottom: 0, borderTop: '1px solid var(--color-line)', background: 'var(--color-card)', padding: '12px 16px' }}>{footer}</div>}
      </div>
    </div>
  )
  return inline ? node : createPortal(node, document.body)
}
