import React from 'react'

const S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'
export const REITER = [
  { id: 'heute', label: 'Brühen', icon: '<path d="M6 9h11a3 3 0 010 6h-1M6 9v5a5 5 0 005 5h0a5 5 0 005-5V9M6 9H5m1-4v1m4-1v1m4-1v1M4 21h14" ' + S + '/>' },
  { id: 'coffee', label: 'Regal', icon: '<g transform="rotate(-30 12 12)" fill="none" stroke="currentColor"><ellipse cx="12" cy="12" rx="6" ry="9" stroke-width="1.8"/><path d="M12 3.2c-2.9 4.2-2.9 13.4 0 17.6" stroke-width="1.8" stroke-linecap="round"/></g>' },
  { id: 'log', label: 'Verlauf', icon: '<path d="M4 17l4-4 3 2 4-6 5 3" ' + S + '/>' },
]

export function TabBar({ items = REITER, active, onChange }) {
  return (
    <nav className="pb-nav" style={{ borderTop: '1px solid var(--color-line)', background: 'color-mix(in oklab, var(--color-paper) 95%, transparent)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
      <div style={{ display: 'flex' }}>
        {items.map((t) => {
          const on = t.id === active
          return (
            <button key={t.id} type="button" onClick={() => onChange && onChange(t.id)} aria-current={on ? 'page' : undefined} style={{ display: 'flex', height: 46, flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, color: on ? 'var(--color-crema-ink)' : 'var(--color-faint)' }}>
              <svg width="23" height="23" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: t.icon }} />
              <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 500 }}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
