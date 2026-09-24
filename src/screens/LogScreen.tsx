/**
 * Brew Log.
 *
 * Zeigt nicht nur, was war, sondern auch die damals gegebene Empfehlung —
 * und ob sie eingetroffen ist. Das macht die App überprüfbar.
 */
import { useState } from 'react'
import { Lernkurve, Versuchskette } from '@/components/lernkurve'
import { targetTimeRange } from '@/kb'
import type { Route } from '@/router'
import { useStore } from '@/store'
import type { BrewMethod } from '@domain'
import { METHODS, METHOD_LABEL, METHOD_SHORT, DEFECT_LABEL, CHARACTER_LABEL, FLOW_LABEL } from '@/labels'
import {
  Screen,
  Header,
  Section,
  Card,
  Empty,
  Chip,
  Field,
  Select,
  SegmentedControl,
  Stat,
  Button,
  num,
} from '@/components/ui'
import { MethodIcon } from '@/components/methodicons'
import { getMethod } from '@/kb'

/**
 * „Alle" braucht auch ein Zeichen, sonst steht ein leerer Platz neben
 * fünf Symbolen und der Umschalter sieht kaputt aus. Drei Punkte im
 * Strichstil der übrigen Icons.
 */
function AlleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden>
      <g fill="currentColor">
        <circle cx="6" cy="12" r="1.8" />
        <circle cx="12" cy="12" r="1.8" />
        <circle cx="18" cy="12" r="1.8" />
      </g>
    </svg>
  )
}
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
  const empfehlungen = useStore((s) => s.empfehlungen)
  /**
   * Zwei Sichten auf dieselben Daten.
   *
   * „Verlauf" beantwortet „wie lief es?", „Versuche" beantwortet „was hat
   * geholfen?". Die zweite Frage stellte man bisher an eine
   * chronologische Liste, in der die Antwort über zwei Einträge verteilt
   * stand, die nichts voneinander wussten.
   */
  const [sicht, setSicht] = useState<'verlauf' | 'versuche'>('verlauf')
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

  /**
   * Die Daten für die Kurve — oder nichts.
   *
   * Zeiten verschiedener Methoden auf einer Achse wären bedeutungslos,
   * deshalb braucht die Kurve genau eine. Ist keine gewählt, nimmt sie
   * die meistgebrühte der gefilterten Auswahl — das ist hilfreicher, als
   * eine weitere Bedienung zu verlangen.
   */
  const kurve = (() => {
    if (filtered.length < 2) return null
    const zaehler = new Map<BrewMethod, number>()
    for (const b of filtered) zaehler.set(b.method, (zaehler.get(b.method) ?? 0) + 1)
    const method =
      filterMethod !== 'all'
        ? filterMethod
        : [...zaehler.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    if (!method) return null

    // Chronologisch, ältester zuerst — der Verlauf liest sich von links.
    const reihe = filtered
      .filter((b) => b.method === method)
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    if (reihe.length < 2) return null

    const letzter = reihe[reihe.length - 1]!
    const bohne = beans.find((b) => b.id === letzter.beanId)
    const band =
      targetTimeRange(method, letzter.actual.doseG, bohne?.roastLevel, letzter.actual.yieldG) ??
      undefined
    return { method, brews: reihe, band }
  })()

  /**
   * Was im Logbuch tatsächlich vorkommt — und nur das wird angeboten.
   *
   * Die gerade gewählte Bohne bleibt in jedem Fall in der Liste: Sie kann
   * aus der Route kommen (`#/log/<bohne>`), auch wenn zu ihr noch kein
   * Brew existiert. Ohne sie zeigte das Auswahlfeld einen Wert an, den
   * es in seiner eigenen Liste nicht gibt.
   */
  const gebrauchteMethoden = METHODS.filter((m) => brews.some((b) => b.method === m))
  const gebrauchteBohnen = beans.filter(
    (b) => b.id === filterBean || brews.some((x) => x.beanId === b.id),
  )

  return (
    <Screen>
      <Header title="Log" subtitle={gefilterteBohne?.name} onBack={back} />

      {brews.length === 0 ? (
        <Empty
          title="Noch keine Brews"
          body="Jeder Brew macht die Empfehlungen präziser. Nach drei gut bewerteten Tassen pro Bohne kennt die App deinen Geschmack."
          action={
            // Auch ohne vorgefilterte Bohne führt der leere Log irgendwohin:
            // Ohne Handlung war der Zurück-Pfeil im Kopf der einzige Ausgang.
            beans.length > 0 ? (
              <Button
                onClick={() =>
                  navigate(
                    gefilterteBohne
                      ? { tab: 'brew', detail: gefilterteBohne.id }
                      : { tab: 'brew' },
                  )
                }
              >
                Ersten Kaffee brühen
              </Button>
            ) : (
              <Button onClick={() => navigate({ tab: 'coffee', detail: 'new' })}>
                Erste Bohne anlegen
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Dieselbe Sprache wie unter Brew: Die Methode wählt man am
              Symbolumschalter, nicht an einer Chipzeile. Zwei Bildschirme,
              die dieselbe Frage stellen, sollen sie auch gleich stellen.

              Die Bohne dagegen bleibt eine Liste ohne feste Länge — bei
              zwölf Bohnen wären zwölf Chips vier Zeilen, und ein
              Umschalter ginge gar nicht. Dafür ist ein Auswahlfeld da.

              Angeboten wird in beiden Fällen nur, was im Logbuch
              vorkommt: Ein Filter, dessen Ergebnis man vorher kennt, ist
              keine Auswahl. */}
          {(gebrauchteMethoden.length > 1 || gebrauchteBohnen.length > 1) && (
            <Section title="Filter">
              <Card>
                <div className="space-y-4">
                  {gebrauchteMethoden.length > 1 && (
                    <Field label="Methode">
                      <SegmentedControl<BrewMethod | 'all'>
                        value={filterMethod}
                        onChange={setFilterMethod}
                        options={[
                          { value: 'all' as const, label: 'Alle', icon: <AlleIcon /> },
                          ...gebrauchteMethoden.map((m) => ({
                            value: m,
                            label: METHOD_SHORT[m],
                            icon: (
                              <MethodIcon
                                icon={getMethod(m).icon ?? m}
                                className="h-[22px] w-[22px]"
                              />
                            ),
                          })),
                        ]}
                      />
                    </Field>
                  )}
                  {gebrauchteBohnen.length > 1 && (
                    <Field label="Bohne">
                      <Select
                        value={filterBean}
                        onChange={setFilterBean}
                        options={[
                          { value: 'all', label: 'Alle Bohnen' },
                          ...gebrauchteBohnen.map((b) => ({ value: b.id, label: b.name })),
                        ]}
                      />
                    </Field>
                  )}
                </div>
              </Card>
            </Section>
          )}

          <Section>
            <SegmentedControl
              value={sicht}
              onChange={(v) => setSicht(v as 'verlauf' | 'versuche')}
              options={[
                { value: 'verlauf', label: 'Verlauf' },
                { value: 'versuche', label: 'Versuche' },
              ]}
            />
          </Section>

          {sicht === 'versuche' ? (
            <Section title="Was geholfen hat">
              <Versuchskette
                empfehlungen={
                  filterBean === 'all'
                    ? empfehlungen
                    : empfehlungen.filter((e) => e.beanId === filterBean)
                }
                alsUhr={(m) => m !== 'espresso'}
                methodLabel={(m) => METHOD_LABEL[m]}
              />
            </Section>
          ) : (
          <>
          {/* Die Kurve braucht eine Methode: V60-Zeiten neben
              Espresso-Zeiten auf einer Achse wären bedeutungslos. Ist
              keine gewählt, nimmt sie die meistgebrühte der Auswahl. */}
          {kurve && (
            <Section
              title="Lernkurve"
              action={<span className="text-2xs text-faint">{METHOD_LABEL[kurve.method]}</span>}
            >
              <Card>
                <Lernkurve
                  brews={kurve.brews}
                  {...(kurve.band ? { band: kurve.band } : {})}
                  alsUhr={kurve.method !== 'espresso'}
                />
              </Card>
            </Section>
          )}

          <Section title="Brews">
            {filtered.length === 0 && (
              <Card>
                <p className="text-base text-mute">
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
                    {/* Das Methodenzeichen wie im Katalog und im
                        Umschalter. Eine Liste aus lauter gleich
                        aussehenden Textzeilen ist beim Durchsehen
                        mühsam; das Symbol trägt die Sortierung, die man
                        beim Blättern sucht. */}
                    <span className="mt-0.5 shrink-0 text-mute">
                      <MethodIcon icon={getMethod(b.method).icon ?? b.method} className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* Auf eine Bohne gefiltert steht ihr Name schon im
                          Kopf — in jeder Zeile noch einmal verdrängt er
                          nur das Rezept, das den Eintrag unterscheidet. */}
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">
                          {gefilterteBohne ? METHOD_LABEL[b.method] : beanName(b.beanId)}
                        </p>
                        {b.isBest && <span className="shrink-0 text-2xs text-crema-ink">REFERENZ</span>}
                      </div>
                      <p className="mt-0.5 text-sm text-mute">
                        {!gefilterteBohne && `${METHOD_LABEL[b.method]} · `}
                        {num(b.actual.doseG)} g →{' '}
                        {b.actual.yieldG ? `${num(b.actual.yieldG)} g` : `${b.actual.waterG} g`} ·{' '}
                        {fmtDauer(b.actual.timeS)}
                      </p>
                      <p className="mt-1 text-xs text-faint">
                        {new Date(b.createdAt).toLocaleDateString('de-DE', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                        {b.tasting?.defects.length
                          ? ` · ${b.tasting.defects.map((d) => DEFECT_LABEL[d]).join(', ')}`
                          : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm text-crema-ink">
                      {'★'.repeat(b.tasting?.rating ?? 0)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </Section>
          </>
          )}
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
            <p className="text-2xl text-crema-ink">{'★'.repeat(brew.tasting.rating)}</p>
            {brew.tasting.defects.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-mute">Was störte</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {brew.tasting.defects.map((d) => (
                    <Chip key={d} label={DEFECT_LABEL[d]} active tone="bad" />
                  ))}
                </div>
              </div>
            )}
            {brew.tasting.characters.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-mute">Charakter</p>
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
