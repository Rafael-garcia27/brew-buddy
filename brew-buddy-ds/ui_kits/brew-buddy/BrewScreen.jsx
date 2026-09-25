import React, { useEffect, useState } from 'react'
import { Screen, Header, Section, Card, Button, SegmentedControl, MethodIcon, Triad, MetaRow, BrewButton, Stepper, Chip, num } from '../../components'
import { METHODS, METHOD_LABEL, METHOD_SHORT, BEANS, RATIO_TERM } from './data.js'

export function BrewScreen({ params, back }) {
  const bean = BEANS.find((b) => b.id === params.bean) || BEANS[0]
  const [method, setMethod] = useState(params.method || 'espresso')
  const [phase, setPhase] = useState('proposal')
  const [t, setT] = useState(0)
  const [yieldG, setYield] = useState(36)
  const [wahl, setWahl] = useState(null)
  const esp = method === 'espresso'
  useEffect(() => {
    if (phase !== 'timer') return
    const id = setInterval(() => setT((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  const karte = (id, titel, unter) => (
    <button type="button" onClick={() => setWahl(id)} aria-pressed={wahl === id} style={{ width: '100%', borderRadius: 'var(--radius-card)', border: '1px solid', padding: '16px', textAlign: 'left', transition: 'background-color 150ms', borderColor: wahl === id ? 'var(--color-crema)' : 'var(--color-line)', background: wahl === id ? 'color-mix(in oklab, var(--color-crema) 10%, transparent)' : 'var(--color-card)' }}>
      <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{titel}</div>
      <div style={{ marginTop: 2, fontSize: 'var(--text-sm)', color: 'var(--color-mute)' }}>{unter}</div>
    </button>
  )

  return (
    <Screen>
      <Header title={bean.name} subtitle={METHOD_LABEL[method] + ' · im Fenster'} onBack={phase === 'proposal' ? back : () => setPhase('proposal')} />
      {phase === 'proposal' && (
        <>
          <Section>
            <SegmentedControl value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m, label: METHOD_SHORT[m], icon: <MethodIcon icon={m} size={22} /> }))} />
          </Section>
          <Section>
            <Card tone="accent">
              <p style={{ marginBottom: 12, fontSize: 'var(--text-xs)', fontWeight: 500, letterSpacing: 'var(--tracking-wider)', color: 'var(--color-crema-ink)', textTransform: 'uppercase' }}>Dein letzter guter Brew</p>
              <Triad items={esp
                ? [{ label: 'In', value: '18,0', unit: 'g', onEdit: () => {} }, { label: 'Time', value: '27–30', unit: 's' }, { label: 'Out', value: num(yieldG), unit: 'g', onEdit: () => {} }]
                : [{ label: 'In', value: '15,0', unit: 'g', onEdit: () => {} }, { label: 'Time', value: '2:45–3:15' }, { label: 'Out', value: '250', unit: 'g', hint: '≈ 220 g Tasse', onEdit: () => {} }]} />
              <div style={{ marginTop: 16, borderTop: '1px solid var(--color-line)', paddingTop: 12 }}>
                <MetaRow items={[{ label: 'Ratio', value: esp ? '1:2,0' : '1:16,7', term: RATIO_TERM, tone: esp ? 'ok' : undefined }, { label: 'Temp', value: esp ? '92–94 °C' : '94 °C', hint: esp ? 'geräteseitig' : undefined, onEdit: esp ? undefined : () => {} }, { label: 'Grind', value: '12', onEdit: () => {} }]} />
              </div>
              <div style={{ marginTop: 12, borderTop: '1px solid var(--color-line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', color: 'var(--color-mute)' }}>▸ Die Bohne ist 4 Tage älter als beim letzten guten Shot — einen Klick feiner.</p>
                <button type="button" style={{ alignSelf: 'flex-start', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-crema-ink)' }}>Woher die Zahlen kommen</button>
              </div>
            </Card>
          </Section>
          <Section>
            <BrewButton icon={method} onClick={() => { setT(0); setPhase('timer') }} />
          </Section>
        </>
      )}
      {phase === 'timer' && (
        <Section>
          <div style={{ padding: '48px 0 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 500, letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase', color: 'var(--color-mute)' }}>Ziel {esp ? '27–30 s' : '2:45–3:15'}</div>
            <div className="tnum" style={{ marginTop: 8, fontSize: 96, lineHeight: 1, fontWeight: 600 }}>{esp ? t : Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0')}</div>
          </div>
          <Button size="lg" block onClick={() => setPhase('capture')}>Stopp</Button>
        </Section>
      )}
      {phase === 'capture' && (
        <>
          <Section title="Brew">
            <Stepper label="Out" value={yieldG} step={0.1} decimals={1} unit="g" onChange={setYield} />
          </Section>
          <Section><h2 className="titel" style={{ fontSize: 'var(--text-2xl)' }}>Wie war er?</h2></Section>
          <Section>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {karte('sauer', 'Zu sauer', 'dünn, scharf, kurzer Abgang')}
              {karte('sitzt', 'Sitzt', 'süß, rund, trägt')}
              {karte('bitter', 'Zu bitter', 'trocken, kratzig, schwer')}
            </div>
          </Section>
          <Section title="Sonst noch" action={<span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-faint)' }}>löst Korrekturen aus</span>}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Chip label="Kanalbildung" tone="bad" />
              <Chip label="Wässrig" tone="bad" />
            </div>
          </Section>
          <Section>
            <Button size="lg" block disabled={wahl === null} onClick={() => setPhase('result')}>Auswerten</Button>
            {wahl === null && <p style={{ marginTop: 8, textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-faint)' }}>Erst die eine Frage oben — ohne sie weiß die App nicht, in welche Richtung sie korrigieren soll.</p>}
          </Section>
        </>
      )}
      {phase === 'result' && (
        <>
          <Section>
            <Card tone="accent">
              <p style={{ marginBottom: 8, fontSize: 'var(--text-xs)', fontWeight: 500, letterSpacing: 'var(--tracking-wider)', color: 'var(--color-crema-ink)', textTransform: 'uppercase' }}>Eine Änderung</p>
              <p className="titel" style={{ fontSize: 'var(--text-2xl)', lineHeight: 'var(--leading-tight)' }}>3 Klicks gröber</p>
              <p style={{ marginTop: 6, fontSize: 'var(--text-lg)', color: 'var(--color-mute)' }}>Erwartete Zeit danach 28–29 s.</p>
              <p style={{ marginTop: 12, borderTop: '1px solid var(--color-line)', paddingTop: 12, fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', color: 'var(--color-mute)' }}>▸ Shot lief 35 s statt 28 s: √(35/28) = 1,12.</p>
            </Card>
          </Section>
          <Section>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button size="lg" block onClick={back}>Speichern</Button>
              <Button variant="ghost" block onClick={back}>Als Referenz merken</Button>
            </div>
          </Section>
        </>
      )}
    </Screen>
  )
}
