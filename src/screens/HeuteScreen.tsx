/**
 * Heute — eine Ebene, zwei Achsen, eine Handlung.
 *
 * Die erste Fassung hatte drei Blöcke, die alle dasselbe wollten: eine
 * Heldenkarte mit der vorgeschlagenen Bohne, darunter der Knopf mit den
 * Dial-in-Werten, darunter „Oder nach Methode", darunter „Oder nach
 * Bohne". Jeder für sich richtig, zusammen ohne Reihenfolge — man las
 * dreimal dieselbe Frage in unterschiedlicher Form.
 *
 * Dahinter steckt eine einfache Logik, und die steht jetzt auch so da:
 *
 *     Methode   quer oben, angeheftet
 *     Bohne     die Liste darunter, nach Eignung für diese Methode
 *     Brühen    schwebt unten, immer erreichbar
 *
 * Zwei Achsen, eine Handlung. Die zuletzt gebrühte Bohne steht oben in
 * der Liste und ist vorausgewählt — sie bekommt aber keinen eigenen
 * Platz mehr, denn sie ist eine Bohne unter anderen und keine Kategorie.
 *
 * Erklärsätze braucht das keine: Wer oben eine Methode antippt, sieht
 * die Liste darunter umsortieren. Das erklärt sich selbst.
 */
import { useState } from 'react'
import type { Route } from '@/router'
import type { BrewMethod } from '@domain'
import { useStore, selectActiveWater, grinderFor } from '@/store'
import type { EngineContext } from '@/domain'
import { daysOffRoast } from '@/domain'
import { heuteVorschlag } from '@/engine/heute'
import { bestBeansFor } from '@/engine/suitability'
import { startingPoint } from '@/engine/starting'
import { getMethod } from '@/kb'
import { METHOD_LABEL, METHOD_SHORT, METHODS } from '@/labels'
import { MethodIcon } from '@/components/methodicons'
import { Screen, Section, Card, Button, Empty, FreshnessRing, GearButton, LogButton, num } from '@/components/ui'
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

  /**
   * Was gerade gewählt ist — vorbelegt mit dem, was die App vorschlägt.
   *
   * `undefined` heißt „noch nichts angefasst", und dann gilt der
   * Vorschlag. Sobald jemand tippt, gilt seine Wahl; der Vorschlag
   * bleibt trotzdem sichtbar, weil die Liste ihre Reihenfolge behält.
   */
  const [methodeGewaehlt, setMethode] = useState<BrewMethod | undefined>()
  const [bohneGewaehlt, setBohne] = useState<string | undefined>()

  if (!heute) {
    return (
      <Screen>
        <Kopf navigate={navigate} />
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

  const method = methodeGewaehlt ?? heute.method

  /**
   * Welche Methoden angeboten werden.
   *
   * Dieselbe Auswahl wie im Brühbildschirm: Was nicht im Haus ist,
   * gehört auch hier nicht angeboten. Die gewählte bleibt in jedem Fall
   * dabei — sie stünde sonst als leerer Zustand in der Reihe.
   */
  const gesetzt = (s.settings.favoriteMethods ?? []).filter((m) =>
    (METHODS as readonly string[]).includes(m),
  )
  const basis = gesetzt.length ? gesetzt : METHODS
  const methoden = METHODS.filter((m) => basis.includes(m) || m === method)

  /**
   * Die Liste, nach Eignung für die gewählte Methode — mit der zuletzt
   * gebrühten Bohne vorn.
   *
   * Sie steht oben, weil man sie meistens meint, nicht weil sie besser
   * wäre. Deshalb trägt sie die Notiz „zuletzt" und sonst nichts: Wer
   * eine andere will, sieht sie im selben Format direkt darunter.
   */
  const rangliste = bestBeansFor(method, s.beans, s.bags, new Date())
  const zuletzt = s.settings.lastBeanId
  const liste = [
    ...rangliste.filter((r) => r.bean.id === zuletzt),
    ...rangliste.filter((r) => r.bean.id !== zuletzt),
  ]

  const gewaehlt = liste.find((r) => r.bean.id === bohneGewaehlt) ?? liste[0]
  if (!gewaehlt) return null

  const ctx: EngineContext = {
    bean: gewaehlt.bean,
    bag: gewaehlt.bag,
    method,
    grinder: grinderFor(s, method),
    water: selectActiveWater(s),
    settings: s.settings,
    learned: s.learned,
    beanHistory: s.brews.filter((b) => b.beanId === gewaehlt.bean.id && b.method === method),
    methodHistory: s.brews.filter((b) => b.method === method),
    allBeans: s.beans,
    today: new Date(),
  }
  const sp = startingPoint(ctx)

  return (
    <Screen>
      <Kopf navigate={navigate}>
        {/*
          Die Methoden sind angeheftet, nicht eingebettet.

          Sie sind der Rahmen, in dem alles darunter gilt — wie ein
          Reiter. Scrollt man die Bohnen, bleiben sie stehen, und man
          sieht jederzeit, worauf sich die Liste bezieht.
        */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-2.5">
          {methoden.map((m) => {
            const aktiv = m === method
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMethode(m)}
                aria-pressed={aktiv}
                aria-label={METHOD_LABEL[m]}
                className={`flex min-w-[64px] shrink-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-colors ${
                  aktiv ? 'bg-crema text-on-crema' : 'text-mute active:bg-raised'
                }`}
              >
                <MethodIcon icon={getMethod(m).icon ?? m} className="h-6 w-6" />
                <span className="text-2xs whitespace-nowrap">{METHOD_SHORT[m]}</span>
              </button>
            )
          })}
        </div>
      </Kopf>

      <BackupBanner />
      <SetupNudge onGrinder={() => navigate({ tab: 'setup', detail: 'grinder' })} />

      <Section>
        <div className="space-y-2">
          {liste.map((r) => {
            const aktiv = r.bean.id === gewaehlt.bean.id
            const tage = daysOffRoast(r.bag, new Date())
            return (
              <Card
                key={r.bean.id}
                onClick={() => setBohne(r.bean.id)}
                className={aktiv ? 'border-crema bg-crema/5' : ''}
              >
                <div className="flex items-center gap-3">
                  <FreshnessRing
                    score={r.freshness.score}
                    size={44}
                    {...(tage !== null ? { label: String(tage) } : {})}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="truncate text-lg font-semibold tracking-tight">{r.bean.name}</p>
                      {r.bean.id === zuletzt && (
                        <span className="shrink-0 text-2xs text-faint">zuletzt</span>
                      )}
                    </div>
                    <p className="truncate text-sm text-mute">
                      {r.note ?? r.freshness.label}
                    </p>
                  </div>
                  {aktiv && <span className="shrink-0 text-lg text-crema">✓</span>}
                </div>
              </Card>
            )
          })}
        </div>
      </Section>

      {/* Platz, damit die letzte Bohne nicht unter dem Knopf verschwindet. */}
      <div className="h-[104px]" />

      {/*
        Der Knopf schwebt, auch wenn die Liste kurz ist.

        `sticky` hätte ihn bei drei Bohnen einfach unter die Liste
        gesetzt — er soll aber immer am unteren Rand kleben und vor den
        Bohnen liegen, egal wie weit man gescrollt hat. Er sitzt deshalb
        fest, genau über der Reiterleiste; wie hoch die baut, steht als
        `--nav-h` in index.css und muss hier nicht geraten werden.

        Milchglas statt Verlauf: Was darunter durchläuft, bleibt
        erkennbar, und der Knopf trotzdem lesbar.
      */}
      <div
        className="pb-safe-0 fixed inset-x-0 z-30 border-t border-line/60 bg-paper/80 px-4 pt-3 pb-3 backdrop-blur-xl"
        style={{ bottom: 'var(--nav-h)' }}
      >
        <Button
          size="lg"
          className="w-full"
          onClick={() => navigate({ tab: 'brew', id: method, detail: gewaehlt.bean.id })}
        >
          <MethodIcon icon={getMethod(method).icon ?? method} className="h-6 w-6" />
          {METHOD_LABEL[method]} brühen
        </Button>
        <p className="mt-1.5 text-center text-sm text-mute">
          {gewaehlt.bean.name} · {num(sp.proposal.doseG)} g → {num(sp.proposal.yieldG)} g
          {sp.proposal.targetTimeS
            ? ` in ${sp.proposal.targetTimeS[0]}–${sp.proposal.targetTimeS[1]} s`
            : ''}
        </p>
      </div>
    </Screen>
  )
}

/**
 * Kopf und Methodenreihe als ein angehefteter Block.
 *
 * Der Standardkopf ist für sich schon `sticky`; eine zweite angeheftete
 * Leiste darunter müsste seine Höhe kennen und würde bei jeder Änderung
 * daran verrutschen. Beides zusammen als ein Block hat keine solche
 * Fuge — und spart die Zeile, die der große Titel sonst kostet.
 */
function Kopf({
  navigate,
  children,
}: {
  navigate: (r: Route, replace?: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <header className="pt-safe sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-xl">
      <div className="flex h-[58px] items-center gap-3 px-4">
        <h1 className="flex-1 truncate text-3xl leading-tight font-bold tracking-tight">Heute</h1>
        <LogButton onClick={() => navigate({ tab: 'log' })} />
        <GearButton onClick={() => navigate({ tab: 'setup' })} />
      </div>
      {children}
    </header>
  )
}
