import React from 'react'

export function Screen({ children }) {
  return (
    <div style={{ minHeight: '100%' }}>
      {children}
      <div style={{ height: 40 }} />
    </div>
  )
}
