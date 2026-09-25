import React, { useState } from 'react'
import { Screen, Header, Section, Card, Button, Chip, FilterRow, FreshnessRing, LogButton, GearButton, SwipeReveal, Sheet, Field, TextInput, Select } from '../../components'
import { BEANS } from './data.js'

export function RegalScreen({ go }) {
  const [filterOffen, setFilterOffen] = useState(false)
  const [fam, setFam] = useState()
  const [neu, setNeu] = useState(false)
  const [name, setName] = useState('')
  const liste = BEANS.filter((b) => !fam || b.process === fam).sort((a, b) => b.score - a.score)
  return (
    <Screen>
      <Header title="Regal" large right={<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Button size="sm" variant="secondary" onClick={() => setNeu(true)}>+ Bohne</Button><LogButton onClick={() => go('log')} /><GearButton /></div>} />
      {filterOffen && (
        <Section>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <FilterRow label="Aufbereitung">
              {['Washed', 'Natural', 'Wet-hulled'].map((f) => <Chip key={f} label={f} active={fam === f} onClick={() => setFam(fam === f ? undefined : f)} />)}
            </FilterRow>
            <FilterRow label="geeignet für">
              {['Espresso', 'V60', 'AeroPress'].map((f) => <Chip key={f} label={f} />)}
            </FilterRow>
            <div><Button size="sm" variant="ghost" style={{ marginLeft: -12 }} onClick={() => setFilterOffen(false)}>Zuklappen</Button></div>
          </div>
        </Section>
      )}
      <Section title="Nach Frische" action={!filterOffen && <button type="button" onClick={() => setFilterOffen(true)} style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-crema-ink)' }}>Filter</button>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {liste.map((b) => (
            <SwipeReveal key={b.id} actions={[{ label: 'Edit' }, { label: 'Löschen', tone: 'bad' }]}>
              <Card onClick={() => go('brew', { method: 'espresso', bean: b.id })}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <FreshnessRing score={b.score} size={44} label={String(b.tage)} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--text-lg)', fontWeight: 600, letterSpacing: 'var(--tracking-tight)' }}>{b.name}</p>
                    <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--text-sm)', color: 'var(--color-mute)' }}>{b.process} · {b.note}</p>
                  </div>
                </div>
              </Card>
            </SwipeReveal>
          ))}
        </div>
      </Section>
      {neu && (
        <Sheet inline title="Neue Bohne" onClose={() => setNeu(false)} footer={<Button block onClick={() => setNeu(false)}>Anlegen</Button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Name"><TextInput value={name} onChange={setName} placeholder="z. B. Hausmischung" /></Field>
            <Field label="Aufbereitung"><Select value="washed" options={[{ value: 'washed', label: 'Washed' }, { value: 'natural', label: 'Natural' }, { value: 'honey', label: 'Honey' }]} /></Field>
            <Field label="Röstdatum" hint="Steht auf der Tüte. Je genauer, desto besser der Startpunkt."><TextInput type="date" value="2026-09-13" /></Field>
          </div>
        </Sheet>
      )}
    </Screen>
  )
}
