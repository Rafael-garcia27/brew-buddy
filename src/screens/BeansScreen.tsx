/**
 * Beans — die Hauptoberfläche der App.
 *
 * Briefing A6: Herkunft, Farm, Röstdatum und Röster-Empfehlung sind keine
 * Deko, sondern Eingaben für die Startpunkt-Berechnung.
 *
 * Warum das der Startbildschirm ist und keine Registerkarte: Jeder
 * Durchgang beginnt mit der Frage „welche Bohne?" — vorher stand sie
 * zweimal in der App, einmal hier als Bibliothek und einmal im Brüh-Screen
 * als Auswahlliste. Jetzt gibt es sie einmal, und Brühen, Profil und Log
 * sind Aktionen an der gewählten Bohne. Eine Navigationsleiste braucht es
 * dafür nicht: Es gibt nur einen Ort, an den man zurückkehrt.
 */
import { lazy, Suspense, useMemo, useState } from 'react'
import type { Route } from '@/router'
import { useStore } from '@/store'
import type { Bean, RoastLevel, Process, BrewMethod } from '@domain'
import { assessFreshness } from '@/engine/freshness'
import { suitability, bestMethodFor, SUITABILITY_LABEL } from '@/engine/suitability'
import { ORIGIN_NAMES, getOrigin } from '@/kb'

/** Sammelwert für Mischungen — dann greifen keine Herkunfts-Modifikatoren. */
const BLEND = 'Blend'
import { METHODS, ROAST_LABEL, PROCESS_LABEL, METHOD_LABEL } from '@/labels'
import {
  Screen, Header, Section, Card, Button, Field, TextInput, Select, Sheet,
  Empty, Stat, FreshnessRing, Stepper, Toggle, Chip, GearButton, num,
} from '@/components/ui'
import { BackupBanner, SetupNudge } from '@/components/system'
/**
 * Nachgeladen, nicht mitgeliefert: Die Kartendaten sind das größte
 * Einzelstück der App und werden nur hier gebraucht. Der Platzhalter hat
 * dasselbe Seitenverhältnis, damit die Karte beim Eintreffen nichts
 * verschiebt.
 */
const OriginMap = lazy(() => import('@/components/OriginMap'))

interface Props {
  route: Route
  navigate: (r: Route, replace?: boolean) => void
  back: () => void
}

/** Typische Anbauhöhe eines Ursprungslands, Mitte der bekannten Spanne. */
function typicalAltitude(country: string): number | null {
  const o = getOrigin(country)
  if (!o?.altitudeMasl) return null
  return Math.round((o.altitudeMasl[0] + o.altitudeMasl[1]) / 2 / 50) * 50
}

export default function BeansScreen({ route, navigate }: Props) {
  const beans = useStore((s) => s.beans)
  const bags = useStore((s) => s.bags)
  const brews = useStore((s) => s.brews)
  const lastBeanId = useStore((s) => s.settings.lastBeanId)
  const [showNew, setShowNew] = useState(route.detail === 'new')
  /**
   * Die Vorauswahl. Erst sie schaltet die Aktionen frei — ein Tippen auf
   * eine Bohne soll nicht sofort irgendwo hinspringen, sondern zeigen,
   * was mit dieser Bohne möglich ist.
   *
   * Sie steht zusätzlich in der Route, damit sie den Weg nach Brühen und
   * zurück übersteht: Ohne das sprang die Auswahl beim Zurückkommen auf
   * die zuletzt gebrühte Bohne, nicht auf die gerade gewählte.
   */
  const [selected, setSelected] = useState<string | undefined>(route.id ?? lastBeanId)
  const waehle = (id: string | undefined) => {
    setSelected(id)
    // Ersetzen, nicht anhängen: Ein Auswahlwechsel ist kein Schritt, den
    // man mit der Zurück-Geste rückgängig machen will.
    navigate({ tab: 'beans', id }, true)
  }

  // „Welche Bohne heute?" — nach Frischefenster sortiert (Briefing Teil D)
  const ranked = beans
    .map((b) => {
      const best = bestMethodFor(b)
      const bag = bags.filter((x) => x.beanId === b.id && !x.depleted)[0]
      const f = assessFreshness(bag, best.method, b.roastLevel, !!b.isDecaf, new Date(), b.process)
      return {
        bean: b,
        bag,
        fresh: f,
        best,
        count: brews.filter((x) => x.beanId === b.id).length,
      }
    })
    .sort((a, b) => b.fresh.score - a.fresh.score)

  return (
    <Screen>
      <Header
        title="Beans"
        large
        right={
          <div className="flex items-center gap-1">
            {beans.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setShowNew(true)}>
                + Bohne
              </Button>
            )}
            {/* Setup gehört nicht in den Weg: Es wird einmal eingerichtet
                und danach selten angefasst. Ein Zahnrad reicht. */}
            <GearButton onClick={() => navigate({ tab: 'setup' })} />
          </div>
        }
      />

      {beans.length === 0 ? (
        <Empty
          title="Noch keine Bohne"
          body="Trag deine erste Bohne ein. Je mehr du angibst — Röstdatum, Höhe, Aufbereitung — desto präziser wird der Startpunkt."
          action={<Button onClick={() => setShowNew(true)}>Erste Bohne anlegen</Button>}
        />
      ) : (
        <>
          <BackupBanner />
          <SetupNudge onGrinder={() => navigate({ tab: 'setup', detail: 'grinder' })} />

          <Section action={<span className="text-[12px] text-faint">nach Frische</span>}>
            <div className="space-y-2">
              {ranked.map(({ bean, fresh, count, best, bag }) => {
                const aktiv = bean.id === selected
                return (
                  <div key={bean.id}>
                    <Card
                      tone={aktiv ? 'accent' : 'default'}
                      onClick={() => waehle(aktiv ? undefined : bean.id)}
                    >
                      <div className="flex items-center gap-3">
                        <FreshnessRing
                          score={fresh.score}
                          label={fresh.days !== null ? String(fresh.days) : '?'}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[17px] leading-tight font-semibold">{bean.name}</p>
                          <p className="mt-0.5 truncate text-[13px] text-mute">
                            {bean.roaster ? `${bean.roaster} · ` : ''}
                            {ROAST_LABEL[bean.roastLevel]} · {PROCESS_LABEL[bean.process]}
                          </p>
                          {/* Eine Aussage je Bohne, und zwar die dringendere:
                              „überaltert" neben „am besten als V60" würde
                              sich für den Leser widersprechen. */}
                          {fresh.state === 'stale' ? (
                            <p className="mt-1 truncate text-[12px] text-bad">
                              {fresh.label} — die Bag gibt nichts mehr her
                            </p>
                          ) : bag?.remainingGrams !== undefined && bag.remainingGrams < 20 ? (
                            <p className="mt-1 truncate text-[12px] text-warn">
                              Nur noch {num(bag.remainingGrams, 0)} g in der Bag
                            </p>
                          ) : (
                            <>
                              <p className="mt-1 truncate text-[12px] text-faint">
                                {fresh.label}
                                {count > 0 && ` · ${count}× gebrüht`}
                              </p>
                              <p className="mt-0.5 truncate text-[12px] text-crema">
                                Am besten als {METHOD_LABEL[best.method]}
                              </p>
                            </>
                          )}
                        </div>
                        <span className={aktiv ? 'text-crema' : 'text-faint'}>{aktiv ? '✓' : '›'}</span>
                      </div>
                    </Card>

                    {/* Die Aktionen erscheinen erst nach der Vorauswahl —
                        sonst stünden sie dreifach je Bohne in der Liste und
                        keine davon wüsste, worauf sie sich bezieht. */}
                    {aktiv && (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <Button className="w-full" onClick={() => navigate({ tab: 'brew', id: bean.id })}>
                          Brühen
                        </Button>
                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={() => navigate({ tab: 'profile', id: bean.id })}
                        >
                          Profil
                        </Button>
                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={() => navigate({ tab: 'log', id: bean.id })}
                        >
                          Log
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>

          {!selected && (
            <p className="px-4 pt-4 text-[13px] leading-snug text-faint">
              Bohne antippen — dann kannst du sie brühen, ihr Profil ansehen
              oder ihre Protokolle durchgehen.
            </p>
          )}
        </>
      )}

      {/* Die gerade angelegte Bohne ist die, mit der man weitermachen
          will — sie kommt vorausgewählt aus dem Formular zurück. */}
      {showNew && (
        <BeanSheet
          onClose={() => setShowNew(false)}
          onCreated={(id) => { setShowNew(false); waehle(id) }}
        />
      )}
    </Screen>
  )
}

// ── Detailansicht ─────────────────────────────────────────────────────

export function BeanDetail({ bean, onBack }: { bean: Bean; onBack: () => void }) {
  const allBags = useStore((s) => s.bags)
  const allBrews = useStore((s) => s.brews)
  const bags = useMemo(() => allBags.filter((b) => b.beanId === bean.id), [allBags, bean.id])
  const brews = useMemo(() => allBrews.filter((b) => b.beanId === bean.id), [allBrews, bean.id])
  const deleteBean = useStore((s) => s.deleteBean)
  const addBag = useStore((s) => s.addBag)
  const updateBag = useStore((s) => s.updateBag)
  const [showBag, setShowBag] = useState(false)

  const bestByMethod = METHODS
    .map((m) => {
      const list = brews.filter((b) => b.method === m && (b.tasting?.rating ?? 0) >= 4)
      const best = list.sort((a, b) => (b.tasting!.rating - a.tasting!.rating))[0]
      return best ? { method: m, brew: best } : null
    })
    .filter(Boolean) as { method: BrewMethod; brew: (typeof brews)[number] }[]

  return (
    <Screen>
      <Header title={bean.name} subtitle={bean.roaster} onBack={onBack} />

      <Section title="Profil">
        <Card>
          {/* Wo sie wächst, bevor was sie ist: Die Karte ist der einzige
              Teil dieses Bildschirms, den man ohne Lesen erfasst. */}
          <Suspense
            fallback={
              <div className="mb-4">
                <div className="aspect-[360/116] w-full rounded-xl border border-line bg-paper" />
                <div className="mt-1.5 h-[15px]" />
              </div>
            }
          >
            <OriginMap origins={bean.origins} className="mb-4" />
          </Suspense>

          <div className="grid grid-cols-2 gap-4">
            <Stat label="Roast" value={ROAST_LABEL[bean.roastLevel]} />
            <Stat label="Process" value={PROCESS_LABEL[bean.process]} />
            <Stat label="Origin" value={bean.origins.map((o) => o.country).join(', ') || '—'} />
            {bean.origins[0]?.farm && <Stat label="Farm" value={bean.origins[0].farm} />}
            {bean.altitudeMasl && (
              <Stat label="Altitude" value={`${bean.altitudeMasl[0]}–${bean.altitudeMasl[1]}`} unit="m" />
            )}
            {bean.varieties?.length ? <Stat label="Varietal" value={bean.varieties.join(', ')} /> : null}
            {bean.isDecaf && <Stat label="Koffein" value="Entkoffeiniert" />}
          </div>
          {bean.flavorNotes?.length ? (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-[12px] text-mute">Notizen des Rösters</p>
              <p className="mt-1 text-[15px]">{bean.flavorNotes.join(', ')}</p>
            </div>
          ) : null}
        </Card>
      </Section>

      <Section title="Fit">
        <Card>
          <div className="space-y-2">
            {METHODS.map((m) => {
              const fit = suitability(bean, m)
              return (
                <div key={m} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[14px]">{METHOD_LABEL[m]}</span>
                  <span className="flex gap-0.5" aria-label={SUITABILITY_LABEL[fit.level]}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={`h-1.5 w-5 rounded-full ${
                          n <= Math.round(fit.score)
                            ? fit.isWarning
                              ? 'bg-warn'
                              : 'bg-crema'
                            : 'bg-line'
                        }`}
                      />
                    ))}
                  </span>
                  <span className="text-[13px] text-mute">{SUITABILITY_LABEL[fit.level]}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-3 border-t border-line pt-3 text-[13px] leading-relaxed text-mute">
            {suitability(bean, bestMethodFor(bean).method).reason}
          </p>
        </Card>
      </Section>

      <Section title="Bags" action={<Button size="sm" variant="ghost" onClick={() => setShowBag(true)}>+ Bag</Button>}>
        {bags.length === 0 ? (
          <Card>
            <p className="text-[14px] text-mute">
              Noch keine Bag. Ohne Röstdatum kann ich die Frische nicht mitführen.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {bags.map((bag) => {
              // Dieselbe Methode wie in der Übersicht: Das Ruhefenster ist
              // methodenabhängig — mit 'espresso' als Notnagel nannte die
              // Detailansicht eine andere Tageszahl als die Karte, von der
              // man gerade kam.
              const f = assessFreshness(
                bag,
                bean.preferredMethod ?? bestMethodFor(bean).method,
                bean.roastLevel,
                !!bean.isDecaf,
                new Date(),
                bean.process,
              )
              return (
                <Card key={bag.id}>
                  <div className="flex items-center gap-3">
                    <FreshnessRing score={bag.depleted ? 0 : f.score} label={f.days !== null ? String(f.days) : '?'} />
                    <div className="flex-1">
                      <p className="text-[15px]">
                        {bag.roastDate
                          ? `Geröstet ${new Date(bag.roastDate).toLocaleDateString('de-DE')}`
                          : 'Röstdatum fehlt'}
                      </p>
                      <p className="text-[13px] text-mute">
                        {bag.remainingGrams !== undefined ? `${bag.remainingGrams} g übrig` : ''}
                        {bag.storage === 'frozen' ? ' · eingefroren' : ''}
                        {bag.depleted ? ' · leer' : ''}
                      </p>
                    </div>
                    {!bag.depleted && (
                      <Button size="sm" variant="ghost" onClick={() => updateBag(bag.id, { depleted: true })}>
                        leer
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </Section>

      {bestByMethod.length > 0 && (
        <Section title="Deine besten Einstellungen">
          <div className="space-y-2">
            {bestByMethod.map(({ method, brew }) => (
              <Card key={method}>
                <p className="text-[13px] text-mute">{METHOD_LABEL[method]}</p>
                <p className="mt-1 text-[16px]">
                  {brew.actual.doseG} g →{' '}
                  {brew.actual.yieldG ? `${brew.actual.yieldG} g` : `${brew.actual.waterG} g Wasser`} ·{' '}
                  {brew.actual.timeS} s
                  {brew.actual.grindSetting ? ` · Mahlgrad ${brew.actual.grindSetting.value}` : ''}
                </p>
                <p className="mt-1 text-[13px] text-crema">{'★'.repeat(brew.tasting?.rating ?? 0)}</p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Section>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            if (confirm(`„${bean.name}“ mit allen Bags und Protokollen löschen?`)) {
              deleteBean(bean.id)
              onBack()
            }
          }}
        >
          Bohne löschen
        </Button>
      </Section>

      {showBag && (
        <BagSheet
          onClose={() => setShowBag(false)}
          onSave={(b) => {
            addBag({ beanId: bean.id, ...b })
            setShowBag(false)
          }}
        />
      )}
    </Screen>
  )
}

// ── Formulare ─────────────────────────────────────────────────────────

function BeanSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated?: (id: string) => void
}) {
  const addBean = useStore((s) => s.addBean)
  const addBag = useStore((s) => s.addBag)

  const [name, setName] = useState('')
  const [roaster, setRoaster] = useState('')
  const [country, setCountry] = useState('Kolumbien')
  const [roast, setRoast] = useState<RoastLevel>('medium')
  const [process, setProcess] = useState<Process>('washed')
  // Kein fester Vorgabewert: 1500 m wäre eine erfundene Angabe, die jede
  // Bohne bekäme — und die Herkunftsableitung der Engine käme nie zum Zug.
  const [altitude, setAltitude] = useState<number | null>(null)
  const [altitudeTouched, setAltitudeTouched] = useState(false)
  const [notes, setNotes] = useState('')
  const [decaf, setDecaf] = useState(false)
  const [roastDate, setRoastDate] = useState(new Date().toISOString().slice(0, 10))
  const [grams, setGrams] = useState(250)

  const save = () => {
    if (!name.trim()) return
    const id = addBean({
      name: name.trim(),
      roaster: roaster.trim() || undefined,
      origins: [{ country }],
      process,
      roastLevel: roast,
      altitudeMasl: altitude !== null ? [altitude - 100, altitude + 100] : undefined,
      flavorNotes: notes ? notes.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      isDecaf: decaf || undefined,
    })
    addBag({ beanId: id, roastDate, purchasedGrams: grams, remainingGrams: grams, storage: 'ambient' })
    if (onCreated) onCreated(id)
    else onClose()
  }

  return (
    <Sheet
      title="Neue Bohne"
      onClose={onClose}
      footer={
        <Button className="w-full" size="lg" disabled={!name.trim()} onClick={save}>
          Bohne anlegen
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <TextInput value={name} onChange={setName} placeholder="z. B. Finca La Esperanza" />
        </Field>
        <Field label="Roaster">
          <TextInput value={roaster} onChange={setRoaster} placeholder="optional" />
        </Field>
        <Field label="Origin" hint="Beeinflusst Mahlgrad und Temperatur">
          <Select
            value={country}
            onChange={setCountry}
            options={[
              { value: BLEND, label: 'Blend (mehrere Herkünfte)' },
              ...ORIGIN_NAMES.map((n) => ({ value: n, label: n })),
            ]}
          />
        </Field>
        <Field label="Roast" hint="Die wichtigste Angabe für den Startpunkt">
          <Select
            value={roast}
            onChange={setRoast}
            options={(Object.keys(ROAST_LABEL) as RoastLevel[]).map((r) => ({ value: r, label: ROAST_LABEL[r] }))}
          />
        </Field>
        <Field label="Process" term="process">
          <Select
            value={process}
            onChange={setProcess}
            options={(Object.keys(PROCESS_LABEL) as Process[]).map((p) => ({ value: p, label: PROCESS_LABEL[p] }))}
          />
        </Field>
        <Field
          label="Altitude"
          hint={
            altitude === null
              ? `Steht meist auf der Bag. Ohne Angabe rechne ich mit dem, was für ${country === BLEND ? 'die Herkunft' : country} üblich ist.`
              : altitudeTouched
                ? 'Höher gewachsen heißt dichter — mehr Extraktion nötig.'
                : `Typisch für ${country}. Überschreib es, wenn die Bag etwas anderes sagt.`
          }
        >
          {altitude === null ? (
            <Button
              variant="ghost"
              onClick={() => setAltitude(typicalAltitude(country) ?? 1500)}
              className="w-full"
            >
              Höhe angeben
            </Button>
          ) : (
            <Stepper
              value={altitude}
              onChange={(v) => { setAltitude(v); setAltitudeTouched(true) }}
              step={100}
              min={400}
              max={2400}
              unit="m"
              label="Altitude"
            />
          )}
        </Field>
        <Field label="Tasting Notes des Rösters" hint="Kommagetrennt">
          <TextInput value={notes} onChange={setNotes} placeholder="Schokolade, Nuss, Karamell" />
        </Field>
        <Toggle checked={decaf} onChange={setDecaf} label="Decaf" />

        <div className="border-t border-line pt-4">
          <p className="mb-3 text-[13px] font-semibold tracking-wide text-mute uppercase">Erste Bag</p>
          <Field label="Roast Date" hint="Ohne dieses Datum kann ich die Frische nicht mitführen">
            <TextInput value={roastDate} onChange={setRoastDate} type="date" />
          </Field>
          <div className="mt-4">
            <Field label="Menge">
              <Stepper value={grams} onChange={setGrams} step={50} min={50} max={2000} unit="g" />
            </Field>
          </div>
        </div>
      </div>
    </Sheet>
  )
}

function BagSheet({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (b: { roastDate?: string; purchasedGrams?: number; remainingGrams?: number; storage?: 'ambient' | 'frozen'; frozenAt?: string }) => void
}) {
  const [roastDate, setRoastDate] = useState(new Date().toISOString().slice(0, 10))
  const [grams, setGrams] = useState(250)
  const [frozen, setFrozen] = useState(false)

  return (
    <Sheet
      title="Neuer Bag"
      onClose={onClose}
      footer={
        <Button
          className="w-full"
          size="lg"
          onClick={() =>
            onSave({ roastDate, purchasedGrams: grams, remainingGrams: grams, storage: frozen ? 'frozen' : 'ambient', frozenAt: frozen ? new Date().toISOString() : undefined })
          }
        >
          Hinzufügen
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Roast Date">
          <TextInput value={roastDate} onChange={setRoastDate} type="date" />
        </Field>
        <Field label="Menge">
          <Stepper value={grams} onChange={setGrams} step={50} min={50} max={2000} unit="g" />
        </Field>
        <Toggle
          checked={frozen}
          onChange={setFrozen}
          label="Eingefroren (hält die Frische-Uhr an)"
        />
        {frozen && (
          <div className="flex flex-wrap gap-2">
            <Chip label="Gefroren gemahlen: 1–2 Schritte gröber starten" />
          </div>
        )}
      </div>
    </Sheet>
  )
}
