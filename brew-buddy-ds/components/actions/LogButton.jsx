import React from 'react'

export function LogButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Logbuch"
      className="bb-press-raised"
      style={{ width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, color: 'var(--color-mute)' }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M5 4h11l3 3v13H5V4zm3 5h8M8 13h8M8 17h5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
