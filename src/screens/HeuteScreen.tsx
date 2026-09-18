/**
 * Heute — ein Einstieg statt zwei.
 *
 * Bis 2.0 standen „Brew" und „Coffee" nebeneinander: „welche Methode?"
 * und „welche Bohne?". Beide sind Fragen an jemanden, der es schon weiß.
 * Wer morgens um halb sieben in die Küche kommt, hat die Antwort im Kopf
 * und musste sie der App trotzdem zweimal geben.
 *
 * Dieser Bildschirm nimmt sie vorweg — aus dem, was ohnehin im Bestand
 * steht: zuletzt gebrüht, um diese Zeit üblich, gerade brühbereit. Die
 * Herleitung steht daneben (`engine/heute.ts`), damit der Vorschlag kein
 * Orakel ist.
 *
 * Er entscheidet nichts: Ein Tipp daneben führt ins Regal.
 */
import type { Route } from '@/router'
import { useStore, selectActiveWater, grinderFor } from '@/store'
import { heuteVorschlag } from '@/engine/heute'
import { startingPoint } from '@/engine/starting'
import type { EngineContext } from '@/domain'
import { daysOffRoast } from '@/domain'
import { METHOD_LABEL } from '@/labels'
import { MethodIcon } from '@/components/methodicons'
import { getMethod } from '@/kb'
import { Screen, Header, Section, Card, Button, Empty, FreshnessRing, GearButton, LogButton, num } from '@/components/ui'
import { BackupBanner, SetupNudge } from '@/components/system'

interface Props {
  route: Route
  navigate: (r: Route, replace?: boolean) => void
}

export default function HeuteScreen({ navigate }: Props) {
  const s = useStore()
  const heute = heuteVorschlag({
    beans: s.beans,
    bags: s.bags,
    brews: s.brews,
    settings: s.settings,
    today: new Date(),
  })

  if (!heute) {
    return (
      <Screen>
        <Header
          title="Heute"
          large
          right={
            <div className="flex items-center gap-1">
              <LogButton onClick={() => navigate({ tab: 'log' })} />
              <GearButton onClick={() => navigate({ tab: 'setup' })} />
            </div>
          }
        />
        <Section>
          <Empty
            title="Noch keine Bohne"
            body="Trag deine erste Bohne ein — danach steht hier jeden Morgen, was dran ist."
            action={
              <Button onClick={() => navigate({ tab: 'coffee', detail: 'new' })}>
                Erste Bohne anlegen
              </Button>
            }
          />
        </Section>
      </Screen>
    )
  }

  const { bean, bag, method, freshness, grund, methodengrund, weitere } = heute
  const tage = daysOffRoast(bag, new Date())

  /**
   * Der Startpunkt schon hier, nicht erst im Brühbildschirm.
   *
   * Drei Zahlen unter dem Knopf sind der Unterschied zwischen „öffne mal
   * die App" und „ich weiß, was mich erwartet". Fällt er weg — etwa ohne
   * Mühle —, bleibt der Knopf trotzdem stehen.
   */
  const ctx: EngineContext = {
    bean,
    bag,
    method,
    grinder: grinderFor(s, method),
    water: selectActiveWater(s),
    settings: s.settings,
    learned: s.learned,
    beanHistory: s.brews.filter((b) => b.beanId === bean.id && b.method === method),
    methodHistory: s.brews.filter((b) => b.method === method),
    allBeans: s.beans,
    today: new Date(),
  }
  const sp = startingPoint(ctx)

  const losgehen = () => navigate({ tab: 'brew', id: method, detail: bean.id })

  return (
    <Screen>
      <Header
        title="Heute"
        large
        right={
          <div className="flex items-center gap-1">
            <LogButton onClick={() => navigate({ tab: 'log' })} />
            <GearButton onClick={() => navigate({ tab: 'setup' })} />
          </div>
        }
      />

      <BackupBanner />
      <SetupNudge onGrinder={() => navigate({ tab: 'setup', detail: 'grinder' })} />

      <Section>
        <Card onClick={() => navigate({ tab: 'profile', id: bean.id })}>
          <div className="flex items-center gap-3.5">
            {/* Die Tageszahl gehört in den Ring: Sie ist die Größe, um
                die es geht, und sie steht ohnehin schon daneben im Text. */}
            <FreshnessRing
              score={freshness.score}
              size={74}
              {...(tage !== null ? { label: String(tage) } : {})}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl leading-tight font-semibold tracking-tight">
                {bean.name}
              </p>
              <p className="mt-0.5 text-sm text-mute">{freshness.label}</p>
              <p className="mt-1 text-sm text-crema">
                {bag?.remainingGrams !== undefined ? `${num(bag.remainingGrams, 0)} g übrig · ` : ''}
                {grund}
              </p>
            </div>
          </div>
        </Card>
      </Section>

      <Section>
        <Button size="lg" className="w-full" onClick={losgehen}>
          <MethodIcon icon={getMethod(method).icon ?? method} className="h-6 w-6" />
          {METHOD_LABEL[method]} brühen
        </Button>
        <p className="mt-2 text-center text-sm text-mute">
          {`${num(sp.proposal.doseG)} g → ${num(sp.proposal.yieldG)} g${
            sp.proposal.targetTimeS
              ? ` in ${sp.proposal.targetTimeS[0]}–${sp.proposal.targetTimeS[1]} s`
              : ''
          }`}
        </p>
        <p className="mt-1 text-center text-2xs text-faint">
          {METHOD_LABEL[method]}, weil {methodengrund}
        </p>
      </Section>

      <Section
        title="Etwas anderes"
        action={
          <button
            type="button"
            onClick={() => navigate({ tab: 'coffee' })}
            className="text-sm font-medium text-crema"
          >
            Ins Regal
          </button>
        }
      >
        {weitere.length === 0 ? (
          <p className="text-base text-mute">Mehr steht gerade nicht im Regal.</p>
        ) : (
          <div className="space-y-2">
            {weitere.slice(0, 3).map((r) => (
              <Card key={r.bean.id} onClick={() => navigate({ tab: 'profile', id: r.bean.id })}>
                <div className="flex items-center gap-3">
                  <FreshnessRing score={r.freshness.score} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium">{r.bean.name}</p>
                    <p className="truncate text-sm text-mute">{r.note ?? r.freshness.label}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </Screen>
  )
}
