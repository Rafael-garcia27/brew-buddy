import React from 'react'

export function SegmentedControl({ options, value, onChange }) {
  const mitSymbol = options.some((o) => o.icon)
  const eng = options.length > 3
  return (
    <div style={{ display: 'flex', gap: 4, borderRadius: 'var(--radius-btn)', background: 'var(--color-raised)', padding: 4 }}>
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange && onChange(o.value)}
            aria-current={on ? 'true' : undefined}
            className={on ? undefined : 'bb-press-line'}
            style={{
              minWidth: 0, flex: 1, borderRadius: 'var(--radius-btn)', padding: '0 4px', transition: 'background-color 150ms, color 150ms',
              ...(mitSymbol
                ? { height: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }
                : { height: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: eng ? 'var(--text-sm)' : 'var(--text-lg)' }),
              ...(on ? { background: 'var(--color-crema)', fontWeight: 600, color: 'var(--color-on-crema)' } : { color: 'var(--color-mute)' }),
            }}
          >
            {o.icon}
            <span style={mitSymbol ? { width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--text-2xs)', lineHeight: 1 } : undefined}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
