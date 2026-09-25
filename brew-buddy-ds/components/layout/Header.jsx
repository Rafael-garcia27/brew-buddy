import React from 'react'
import { trunc } from '../_lib/format.js'

export function Header({ title, subtitle, right, onBack, large, children }) {
  return (
    <header className="pt-safe" style={{ position: 'sticky', top: 0, zIndex: 20, borderBottom: '1px solid var(--color-line)', background: 'color-mix(in oklab, var(--color-paper) 90%, transparent)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: large ? 70 : 58 }}>
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Zurück" className="bb-press-raised" style={{ marginLeft: -8, width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, color: 'var(--color-crema-ink)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 className="titel" style={{ fontSize: large ? 'var(--text-3xl)' : 'var(--text-2xl)', lineHeight: 'var(--leading-tight)', ...trunc }}>{title}</h1>
          {subtitle && <p style={{ marginTop: 2, fontSize: 'var(--text-sm)', color: 'var(--color-mute)', ...trunc }}>{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </header>
  )
}
