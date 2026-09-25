import React, { useState } from 'react'
import { Header, Section, Card, Button, FreshnessRing, LogButton, GearButton, MethodIcon, SwipeReveal, Notice } from '../../components'
import { METHODS, METHOD_LABEL, METHOD_SHORT, BEANS } from './data.js'

export function HeuteScreen({ go }) {
  const [method, setMethod] = useState('espresso')
  const [bean, setBean] = useState('haus')
  const [nudge, setNudge] = useState(true)
  return (
    <div>
      <Header title="Brühen" large right={<><LogButton onClick={() => go('log')} /><GearButton /></>}>
        <div className="bb-noscroll" style={{ overflowX: 'auto', padding: '0 16px 10px' }}>
          <div style={{ margin: '0 auto', display: 'flex', width: 'max-content', gap: 8 }}>
            {METHODS.map((m) => {
              const on = m === method
              return (
                <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={on} className={on ? undefined : 'bb-press-raised'} style={{ display: 'flex', minWidth: 64, flexShrink: 0, flexDirection: 'column', alignItems: 'center', gap: 4, borderRadius: 'var(--radius-card)', padding: '8px 12px', background: on ? 'var(--color-crema)' : undefined, color: on ? 'var(--color-on-crema)' : 'var(--color-mute)' }}>
                  <MethodIcon icon={m} size={24} />
                  <span style={{ fontSize: 'var(--text-2xs)', whiteSpace: 'nowrap' }}>{METHOD_SHORT[m]}</span>
                </button>
              )
            })}
          </div>
        </div>
      </Header>
      {nudge && (
        <div style={{ padding: '16px 16px 0' }}>
          <Notice action="Mühle wählen" onDismiss={() => setNudge(false)}><strong>Noch keine Mühle eingerichtet.</strong> Mit ihr werden aus Empfehlungen konkrete Klickzahlen statt Prozentangaben.</Notice>
        </div>
      )}
      <Section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BEANS.map((b) => {
            const on = b.id === bean
            return (
              <SwipeReveal key={b.id} actions={[{ label: 'Edit' }, { label: 'Löschen', tone: 'bad' }]}>
                <Card onClick={() => setBean(b.id)} selected={on}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <FreshnessRing score={b.score} size={44} label={String(b.tage)} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--text-lg)', fontWeight: 600, letterSpacing: 'var(--tracking-tight)' }}>{b.name}</p>
                        {b.id === 'haus' && <span style={{ flexShrink: 0, fontSize: 'var(--text-2xs)', color: 'var(--color-faint)' }}>zuletzt</span>}
                      </div>
                      <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--text-sm)', color: 'var(--color-mute)' }}>{b.note}</p>
                    </div>
                    {on && <span style={{ flexShrink: 0, fontSize: 'var(--text-lg)', color: 'var(--color-crema-ink)' }}>✓</span>}
                  </div>
                </Card>
              </SwipeReveal>
            )
          })}
        </div>
      </Section>
      <div style={{ position: 'sticky', bottom: 0, marginTop: 24, zIndex: 30, borderTop: '1px solid color-mix(in oklab, var(--color-line) 60%, transparent)', background: 'color-mix(in oklab, var(--color-paper) 80%, transparent)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', padding: '12px 16px' }}>
        <Button size="lg" block onClick={() => go('brew', { method, bean })}>
          <MethodIcon icon={method} size={24} />
          {METHOD_LABEL[method]} brühen
        </Button>
      </div>
    </div>
  )
}
