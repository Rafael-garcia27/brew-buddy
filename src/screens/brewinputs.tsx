/**
 * Die Eingabeteile des Kernloops, die ein Thema für sich sind.
 *
 * Herausgelöst aus `BrewScreen.tsx` (P9, Befund F-09). Nicht nach
 * Phasengrenzen geschnitten, sondern nach Thema: Das Mahlwerk, die
 * Feinjustage der Zahlen und die Sinnesbeobachtungen sind jeweils in sich
 * geschlossen und hängen an acht bis vierzehn Werten — der Rest des
 * Startpunkt- und Erfassen-Schritts hängt an vierzig und bleibt deshalb
 * dort, wo er ist.
 *
 * Reines Verschieben, kein Verhalten geändert.
 */
import type { RefObject } from 'react'
import type {
  BrewMethod, Grinder, FlowState, PuckState, BloomBehavior,
} from '@domain'
import { GRINDER_CATALOG, type GrinderCatalogEntry } from '@/kb'
import GrinderDial from '@/components/GrinderDial'
import SageGrindDial from '@/components/SageGrindDial'
import { vendorRange } from '@/engine/grinder'
import { METHOD_LABEL } from '@/labels'
import {
  FLOW_LABEL, FLOW_CHOICES, PUCK_LABEL, PUCK_CHOICES, BLOOM_LABEL, BLOOM_CHOICES,
} from '@/labels'
import {
  Section, Chip, SegmentedControl, Stepper, Field, Sheet, InfoDot, num,
} from '@/components/ui'

/**
 * Das Mahlwerk.
 *
 * Ohne Überschrift „Grind": Der Wert steht schon in der Kennzeilen-Zeile
 * der Karte, und das Rad darunter ist als Mahlwerk unverwechselbar. Eine
 * Überschrift, eine große Zahl, ein Empfehlungstext, das Rad und darunter
 * noch eine Übersichtsskala waren fünf Elemente für einen einzigen Wert.
 */
export function Mahlwerk({
  method,
  grinder,
  grinderChoices,
  setGrinderId,
  grindVal,
  setGrindVal,
  catalogEntry,
  mahlwerkRef,
}: {
  method: BrewMethod
  grinder: Grinder
  grinderChoices: Grinder[]
  setGrinderId: (m: BrewMethod, id: string) => void
  grindVal: number
  setGrindVal: (v: number) => void
  catalogEntry: GrinderCatalogEntry | undefined
  /** Ziel für „Grind antippen" — der Startpunkt scrollt hierher. */
  mahlwerkRef: RefObject<HTMLDivElement | null>
}) {
  return (
          <Section>
            <div ref={mahlwerkRef} className="scroll-mt-20">
            {/* Der Umschalter erscheint nur, wo es wirklich zwei Mühlen
                gibt — beim Siebträger mit verbautem Mahlwerk. */}
            {grinderChoices.length > 1 && (
              <div className="mb-3">
                <SegmentedControl
                  value={grinder.id}
                  onChange={(id) => setGrinderId(method, id)}
                  options={grinderChoices.map((g) => ({
                    value: g.id,
                    label:
                      GRINDER_CATALOG.find((c) => c.id === g.catalogId)?.shortName ?? g.name,
                  }))}
                />
              </div>
            )}

            {grinder.scaleType === 'stepless' ? (
              <SageGrindDial
                value={grindVal}
                onChange={setGrindVal}
                max={grinder.usableRange?.[1] ?? 18}
                step={grinder.step ?? 0.5}
                highlight={(() => {
                  const v = vendorRange(grinder, method)
                  return v
                    ? { range: v.clicks as [number, number], label: METHOD_LABEL[method] }
                    : undefined
                })()}
              />
            ) : (
              <GrinderDial
                clicks={grindVal}
                onChange={setGrindVal}
                clicksPerNumber={grinder.clicksPerNumber ?? 10}
                maxNumber={Math.round(
                  (grinder.usableRange?.[1] ?? 100) / (grinder.clicksPerNumber ?? 10),
                )}
                ringLabels={catalogEntry?.ringLabels}
                wordmark={catalogEntry?.wordmark}
                highlight={(() => {
                  const v = vendorRange(grinder, method)
                  return v
                    ? { range: v.clicks, label: METHOD_LABEL[method], derived: v.isDerived }
                    : undefined
                })()}
              />
            )}
            </div>
          </Section>
  )
}

/**
 * Werte anpassen — die Feinjustage als Blatt über dem Startpunkt.
 *
 * Als Blatt und nicht als weiterer Abschnitt darunter: Das spart die
 * Höhe, die der Startknopf braucht, um ohne Scrollen erreichbar zu bleiben.
 */
export function WerteAnpassen({
  isEspresso,
  doseG,
  changeDose,
  yieldG,
  setYieldG,
  waterG,
  setWaterG,
  tempC,
  setTempC,
  tempFrei,
  tempSpanne,
  setShowTweak,
}: {
  isEspresso: boolean
  doseG: number
  changeDose: (n: number) => void
  yieldG: number
  setYieldG: (n: number) => void
  waterG: number
  setWaterG: (n: number) => void
  tempC: number
  setTempC: (n: number) => void
  tempFrei: boolean
  tempSpanne: { min: number; max: number }
  setShowTweak: (v: boolean) => void
}) {
  return (
          <Sheet title="Werte anpassen" onClose={() => setShowTweak(false)}>
            <div className="space-y-4">
              <Field label="Dose" term="dose">
                <Stepper value={doseG} onChange={changeDose} step={0.1} min={5} max={30} unit="g" decimals={1} label="Dose" />
              </Field>
              {isEspresso ? (
                <Field label="Ziel-Yield" term="yield">
                  <Stepper value={yieldG} onChange={setYieldG} step={0.1} min={10} max={90} unit="g" decimals={1} label="Ziel-Yield" />
                </Field>
              ) : (
                <Field label="Wasser" hint={`Verhältnis 1:${num(waterG / doseG)}`}>
                  <Stepper value={waterG} onChange={setWaterG} step={1} min={80} max={900} unit="g" label="Wasser" />
                </Field>
              )}
              {tempFrei ? (
                <Field label="Temp">
                  <Stepper value={tempC} onChange={setTempC} step={1} min={70} max={100} unit="°C" label="Temp" />
                </Field>
              ) : (
                <Field label="Temp" hint={`${tempSpanne.min}–${tempSpanne.max} °C, geräteseitig`}>
                  <p className="text-lg leading-snug text-mute">
                    Die Maschine brüht mit ihrer eigenen Temperatur. Wenn der Kaffee bitter wird,
                    hilft hier nicht kühler, sondern gröber oder eine weitere Ratio.
                  </p>
                </Field>
              )}
            </div>
          </Sheet>
  )
}

/**
 * Was man sieht, riecht und hört — die Beobachtungen zum Durchgang.
 *
 * Je Methode eine andere Frage: Bei der French Press entscheidet sich der
 * Fehler nach dem Pressen, beim Espresso am Fluss und am Puck, beim
 * Handfilter am Bloom.
 */
export function Beobachtungen({
  method,
  isEspresso,
  isPro,
  decanted,
  setDecanted,
  flow,
  setFlow,
  puck,
  setPuck,
  bloom,
  setBloom,
  drawdown,
  setDrawdown,
}: {
  method: BrewMethod
  isEspresso: boolean
  isPro: boolean
  decanted: boolean | undefined
  setDecanted: (v: boolean | undefined) => void
  flow: FlowState | undefined
  setFlow: (v: FlowState | undefined) => void
  puck: PuckState | undefined
  setPuck: (v: PuckState | undefined) => void
  bloom: BloomBehavior | undefined
  setBloom: (v: BloomBehavior | undefined) => void
  drawdown: number
  setDrawdown: (v: number) => void
}) {
  return (
    <>
        {/* Die einzige Beobachtung, die bei der French Press zählt: Der
            Fehler passiert nach dem Brühen, nicht währenddessen. */}
        {method === 'frenchpress' && (
          <Section title="Nach dem Pressen" action={<InfoDot termId="decant" />}>
            <div className="flex flex-wrap gap-2">
              <Chip
                label="Sofort umgefüllt"
                active={decanted === true}
                tone="good"
                onClick={() => setDecanted(decanted === true ? undefined : true)}
              />
              <Chip
                label="Stand in der Kanne"
                active={decanted === false}
                tone="bad"
                onClick={() => setDecanted(decanted === false ? undefined : false)}
              />
            </div>
          </Section>
        )}

        {isEspresso && (
          <>
            <Section title="Flow" action={<InfoDot termId="flow-state" />}>
              <div className="flex flex-wrap gap-2">
                {FLOW_CHOICES.map((f) => (
                  <Chip
                    key={f}
                    label={FLOW_LABEL[f]}
                    active={flow === f}
                    tone={f === 'normal' ? 'good' : 'bad'}
                    onClick={() => setFlow(flow === f ? undefined : f)}
                  />
                ))}
              </div>
            </Section>
            {isPro && (
            <Section title="Puck" action={<InfoDot termId="puck" />}>
              <div className="flex flex-wrap gap-2">
                {PUCK_CHOICES.map((p) => (
                  <Chip
                    key={p}
                    label={PUCK_LABEL[p]}
                    active={puck === p}
                    tone={p === 'even' ? 'good' : 'bad'}
                    onClick={() => setPuck(puck === p ? undefined : p)}
                  />
                ))}
              </div>
            </Section>
            )}
          </>
        )}

        {method === 'v60' && (
          <>
            <Section title="Bloom" action={<InfoDot termId="bloom" />}>
              <div className="flex flex-wrap gap-2">
                {BLOOM_CHOICES.map((b) => (
                  <Chip
                    key={b}
                    label={BLOOM_LABEL[b]}
                    active={bloom === b}
                    tone={b === 'moderate' ? 'good' : 'bad'}
                    onClick={() => setBloom(bloom === b ? undefined : b)}
                  />
                ))}
              </div>
            </Section>
            {isPro && (
              <Section title="Drawdown" action={<InfoDot termId="drawdown" />}>
                <Stepper value={drawdown} onChange={setDrawdown} step={5} min={0} max={180} unit="s" />
              </Section>
            )}
          </>
        )}
    </>
  )
}
