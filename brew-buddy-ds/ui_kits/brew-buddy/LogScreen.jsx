import React from 'react'
import { Screen, Header, Section, Card, MethodIcon } from '../../components'
import { BREWS, METHOD_LABEL } from './data.js'

export function LogScreen({ back }) {
  return (
    <Screen>
      <Header title="Log" onBack={back} />
      <Section title="Brews">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BREWS.map((b) => (
            <Card key={b.id} onClick={() => {}}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ marginTop: 2, flexShrink: 0, color: 'var(--color-mute)' }}><MethodIcon icon={b.method} size={24} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{b.bean}</p>
                    {b.best && <span style={{ flexShrink: 0, fontSize: 'var(--text-2xs)', color: 'var(--color-crema-ink)' }}>REFERENZ</span>}
                  </div>
                  <p style={{ marginTop: 2, fontSize: 'var(--text-sm)', color: 'var(--color-mute)' }}>{METHOD_LABEL[b.method]} · {b.line}</p>
                  <p style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-faint)' }}>{b.when}{b.defects ? ' · ' + b.defects : ''}</p>
                </div>
                <span style={{ flexShrink: 0, fontSize: 'var(--text-sm)', color: 'var(--color-crema-ink)' }}>{'★'.repeat(b.stars)}</span>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </Screen>
  )
}
