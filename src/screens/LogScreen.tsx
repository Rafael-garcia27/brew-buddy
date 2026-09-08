/**
 * Brew Log.
 *
 * Zeigt nicht nur, was war, sondern auch die damals gegebene Empfehlung —
 * und ob sie eingetroffen ist. Das macht die App überprüfbar.
 */
import { useState } from 'react'
import type { Route } from '@/router'
import { useStore } from '@/store'
import type { BrewMethod } from '@domain'
import { METHODS, METHOD_LABEL, DEFECT_LABEL, CHARACTER_LABEL, FLOW_LABEL } from '@/labels'
import { Screen, Header, Section, Card, Empty, Chip, Stat, Button, num } from '@/components/ui'
// Dieselbe Schreibweise wie in den Empfehlungen: „25 s“, nicht „25s“.
import { fmtDauer } from '@/engine/text'
import { formatSetting } from '@/engine/grinder'

interface Props {
  route: Route
  navigate: (r: Route) => void
  back: () => void
}

export default function LogScreen({ route, navigate, back }: Props) {
  const brews = useStore((s) => s.brews)
  const beans = useStore((s) => s.beans)
  const [filterMethod, setFilterMethod] = useState<BrewMethod | 'all'>('all')
  /**
   * Kommt der Log von einer Bohne, ist er auf sie vorgefiltert.
   *
   * Der Filter bleibt trotzdem bedienbar: „Alle Bohnen" ist ein Tipp
   * entfernt. Ein Log, der nur eine Bohne zeigen KANN, wäre eine
   * Sackgasse — Vergleiche zwischen Bohnen sind der halbe Nutzen.
   */
  const [filterBean, setFilterBean] = useState<string | 'all'>(route.id ?? 'all')

  // `detail` trägt die Brew-Kennung, `id` die vorgefilterte Bohne. Der
  // Log kennt nur eine Art Detail, deshalb braucht es keine Marke davor.
  const detail = route.detail ? brews.find((b) => b.id === route.detail) : undefined
  if (detail) return <BrewDetail brewId={detail.id} onBack={back} />

  const gefilterteBohne = filterBean === 'all' ? undefined : beans.find((b) => b.id === filterBean)

  const filtered = brews.filter(
    (b) =>
      (filterMethod === 'all' || b.method === filterMethod) &&
      (filterBean === 'all' || b.beanId === filterBean),
  )

  const beanName = (id: string) => beans.find((b) => b.id === id)?.name ?? 'Unbekannt'

  return (
    <Screen>
      <Header title="Log" subtitle={gefilterteBohne?.name} onBack={back} />

      {brews.length === 0 ? (
        <Empty
          title="Noch keine Brews"
          body="Jeder Brew macht die Empfehlungen präziser. Nach drei gut bewerteten Tassen pro Bohne kennt die App deinen Geschmack."
          action={
            gefilterteBohne ? (
              <Button onClick={() => navigate({ tab: 'brew', detail: gefilterteBohne.id })}>
                Ersten Kaffee brühen
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Section title="Filter">
            <div className="flex flex-wrap gap-2">
              <Chip label="Alle" active={filterMethod === 'all'} onClick={() => setFilterMethod('all')} />
              {METHODS.map((m) => (
                <Chip
                  key={m}
                  label={METHOD_LABEL[m]}
                  active={filterMethod === m}
                  onClick={() => setFilterMethod(filterMethod === m ? 'all' : m)}
                />
              ))}
            </div>
            {beans.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Chip label="Alle Bohnen" active={filterBean === 'all'} onClick={() => setFilterBean('all')} />
                {beans.map((b) => (
                  <Chip
                    key={b.id}
                    label={b.name}
                    active={filterBean === b.id}
                    onClick={() => setFilterBean(filterBean === b.id ? 'all' : b.id)}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Brews">
            {filtered.length === 0 && (
              <Card>
                <p className="text-[14px] text-mute">
                  Für diesen Filter gibt es noch keinen Brew.
                </p>
              </Card>
            )}
            <div className="space-y-2">
              {filtered.map((b) => (
                <Card
                  key={b.id}
                  onClick={() => navigate({ tab: 'log', detail: b.id, id: route.id })}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Auf eine Bohne gefiltert steht ihr Name schon im
                          Kopf — in jeder Zeile noch einmal verdrängt er
                          nur das Rezept, das den Eintrag unterscheidet. */}
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">
                          {gefilterteBohne ? METHOD_LABEL[b.method] : beanName(b.beanId)}
                        </p>
                        {b.isBest && <span className="shrink-0 text-[11px] text-crema">REFERENZ</span>}
                      </div>
                      <p className="mt-0.5 text-[13px] text-mute">
                        {!gefilterteBohne && `${METHOD_LABEL[b.method]} · `}
                        {num(b.actual.doseG)} g →{' '}
                        {b.actual.yieldG ? `${num(b.actual.yieldG)} g` : `${b.actual.waterG} g`} ·{' '}
                        {fmtDauer(b.actual.timeS)}
                      </p>
                      <p className="mt-1 text-[12px] text-faint">
                        {new Date(b.createdAt).toLocaleDateString('de-DE', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                        {b.tasting?.defects.length
                          ? ` · ${b.tasting.defects.map((d) => DEFECT_LABEL[d]).join(', ')}`
                          : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] text-crema">
                      {'★'.repeat(b.tasting?.rating ?? 0)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        </>
      )}
    </Screen>
  )
}

function BrewDetail({ brewId, onBack }: { brewId: string; onBack: () => void }) {
  const brew = useStore((s) => s.brews.find((b) => b.id === brewId))
  const bean = useStore((s) => s.beans.find((b) => b.id === brew?.beanId))
  const setBest = useStore((s) => s.setBestBrew)
  const del = useStore((s) => s.deleteBrew)
  const grinders = useStore((s) => s.grinders)
  if (!brew) return null

  const a = brew.actual
  return (
    <Screen>
      <Header
        title={bean?.name ?? 'Brew'}
        subtitle={`${METHOD_LABEL[brew.method]} · ${new Date(brew.createdAt).toLocaleString('de-DE')}`}
        onBack={onBack}
      />

      <Section title="Parameter">
        <Card>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Dose" value={num(a.doseG)} unit="g" />
            {a.yieldG !== undefined && <Stat label="Yield" value={num(a.yieldG)} unit="g" />}
            {a.waterG !== undefined && <Stat label="Wasser" value={a.waterG} unit="g" />}
            <Stat label="Zeit" value={fmtDauer(a.timeS)} />
            <Stat
              label="Ratio"
              value={`1:${num((a.yieldG ?? a.waterG ?? 0) / a.doseG)}`}
            />
            {a.waterTempC && <Stat label="Temp" value={a.waterTempC} unit="°C" />}
            {a.grindSetting && (
              <Stat
                label="Grind"
                // In der Schreibweise der Mühle, mit der damals gemahlen
                // wurde — „2,4" auf der Mylo, „4,5" auf der Sage.
                value={formatSetting(
                  a.grindSetting.value,
                  grinders.find((g) => g.id === a.grindSetting!.equipmentId),
                )}
              />
            )}
            {a.yieldG && (
              <Stat label="Flow Rate" value={num(a.yieldG / a.timeS, 2)} unit="g/s" />
            )}
          </div>
        </Card>
      </Section>

      {brew.observations && Object.values(brew.observations).some(Boolean) && (
        <Section title="Beobachtungen">
          <Card>
            <div className="flex flex-wrap gap-2">
              {brew.observations.flowState && (
                <Chip label={FLOW_LABEL[brew.observations.flowState]} active tone={brew.observations.flowState === 'normal' ? 'good' : 'bad'} />
              )}
              {brew.observations.drawdownS && <Chip label={`Drawdown ${brew.observations.drawdownS}s`} active />}
            </div>
          </Card>
        </Section>
      )}

      {brew.tasting && (
        <Section title="Tasting">
          <Card>
            <p className="text-[20px] text-crema">{'★'.repeat(brew.tasting.rating)}</p>
            {brew.tasting.defects.length > 0 && (
              <div className="mt-3">
                <p className="text-[12px] text-mute">Was störte</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {brew.tasting.defects.map((d) => (
                    <Chip key={d} label={DEFECT_LABEL[d]} active tone="bad" />
                  ))}
                </div>
              </div>
            )}
            {brew.tasting.characters.length > 0 && (
              <div className="mt-3">
                <p className="text-[12px] text-mute">Charakter</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {brew.tasting.characters.map((c) => (
                    <Chip key={c} label={CHARACTER_LABEL[c] ?? c} active />
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Section>
      )}

      <Section>
        <div className="space-y-2">
          {!brew.isBest && (
            <Button variant="secondary" className="w-full" onClick={() => setBest(brew.id)}>
              Als Referenz für diese Bohne setzen
            </Button>
          )}
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              if (confirm('Diesen Brew löschen?')) { del(brew.id); onBack() }
            }}
          >
            Löschen
          </Button>
        </div>
      </Section>
    </Screen>
  )
}
