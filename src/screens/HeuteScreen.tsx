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
import type { Bean, BrewMethod } from '@domain'
import { useStore } from '@/store'
import type { BeanTrash } from '@/domain'
import { heuteVorschlag } from '@/engine/heute'
import { bestBeansFor } from '@/engine/suitability'
import { getMethod } from '@/kb'
import { METHOD_LABEL, METHOD_SHORT, METHODS } from '@/labels'
import { MethodIcon } from '@/components/methodicons'
import { Screen, Header, Section, Button, Empty, GearButton } from '@/components/ui'
import { BackupBanner, SetupNudge } from '@/components/system'
import { Liste, ListenZeile, BohnenZeile } from '@/components/Bohnenliste'
import { BeanSheet } from './BeanForms'

interface Props {
  route: Route
  navigate: (r: Route, replace?: boolean) => void
  /** Damit eine hier gelöschte Bohne dieselbe Rücknahme bekommt wie im Regal. */
  onDeleted?: (t: BeanTrash) => void
}

export default function HeuteScreen({ navigate, onDeleted }: Props) {
  const s = useStore()
  /**
   * Bearbeiten und Löschen gehören auch hierher.
   *
   * Die Liste zeigt dieselben Bohnen wie das Regal, mit denselben
   * Angaben — nur war sie bisher schreibgeschützt. Wer hier ein falsches
   * Röstdatum sieht, musste erst ins Regal wechseln, um es zu ändern.
   * Dieselbe Geste, dieselben zwei Aktionen, dieselbe Rücknahme.
   */
  const [editBean, setEditBean] = useState<Bean | undefined>()
  const loeschen = (bean: Bean) => {
    const papierkorb = s.deleteBean(bean.id)
    if (bean.id === bohneGewaehlt) setBohne(undefined)
    if (papierkorb && onDeleted) onDeleted(papierkorb)
  }
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


  return (
    <Screen>
      <Kopf navigate={navigate}>
        {/*
          Die Methoden sind angeheftet, nicht eingebettet.

          Sie sind der Rahmen, in dem alles darunter gilt — wie ein
          Reiter. Scrollt man die Bohnen, bleiben sie stehen, und man
          sieht jederzeit, worauf sich die Liste bezieht.
        */}
        {/*
          Mittig, solange sie passen — sonst scrollend ab links.

          `justify-center` allein schneidet bei Überlauf die erste
          Methode ab, weil der Inhalt dann links aus dem Sichtfeld
          ragt und nicht mehr erreichbar ist. Eine innere Reihe mit
          `w-max mx-auto` zentriert, solange Platz ist, und lässt die
          Ränder los, sobald es eng wird.
        */}
        <div className="overflow-x-auto px-4 pb-2.5">
        <div className="mx-auto flex w-max gap-2">
          {methoden.map((m) => {
            const aktiv = m === method
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMethode(m)}
                aria-pressed={aktiv}
                aria-label={METHOD_LABEL[m]}
                className={`flex min-w-[64px] shrink-0 flex-col items-center gap-1 rounded-card px-3 py-2 transition-colors ${
                  aktiv ? 'bg-crema text-on-crema' : 'text-mute active:bg-raised'
                }`}
              >
                <MethodIcon icon={getMethod(m).icon ?? m} className="h-6 w-6" />
                <span className="text-2xs whitespace-nowrap">{METHOD_SHORT[m]}</span>
              </button>
            )
          })}
        </div>
        </div>
      </Kopf>

      <BackupBanner />
      <SetupNudge onGrinder={() => navigate({ tab: 'setup', detail: 'grinder' })} />

      {/* Dieselbe Liste wie im Regal, aus demselben Baustein. Was sich
          unterscheidet, ist nur, was sie sagt: Hier steht unter dem Namen,
          wie die Bohne zur gewählten Methode passt, dort, wofür sie am
          besten taugt. Und Tippen wählt hier aus, statt aufzuklappen. */}
      <Section>
        <Liste>
          {liste.map((r) => {
            const aktiv = r.bean.id === gewaehlt.bean.id
            return (
              <ListenZeile
                key={r.bean.id}
                wischen={{
                  actions: [
                    { label: 'Edit', onClick: () => setEditBean(r.bean) },
                    { label: 'Löschen', tone: 'bad', onClick: () => loeschen(r.bean) },
                  ],
                  onSwipeAway: () => loeschen(r.bean),
                }}
              >
                <BohnenZeile
                  bean={r.bean}
                  score={r.freshness.score}
                  tage={r.freshness.days}
                  hinweis={r.note ?? r.freshness.label}
                  hinweisTon={r.suitability.isWarning ? 'warn' : 'still'}
                  {...(r.bean.id === zuletzt ? { marke: 'zuletzt' } : {})}
                  rechts={aktiv ? '✓' : ''}
                  gewaehlt={aktiv}
                  onClick={() => setBohne(r.bean.id)}
                />
              </ListenZeile>
            )
          })}
        </Liste>
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
      </div>

      {editBean && <BeanSheet bean={editBean} onClose={() => setEditBean(undefined)} />}
    </Screen>
  )
}

/**
 * Der Kopf von „Brühen" — der gemeinsame, mit der Methodenreihe darin.
 *
 * Bis hierher baute sich dieser Bildschirm einen eigenen Kopf, damit die
 * Methoden mit ihm zusammen angeheftet bleiben. Das kann der gemeinsame
 * inzwischen selbst (`children`), und damit sehen alle drei Reiter oben
 * gleich aus.
 */
function Kopf({
  navigate,
  children,
}: {
  navigate: (r: Route, replace?: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <Header title="Brühen" right={<GearButton onClick={() => navigate({ tab: 'setup' })} />}>
      {children}
    </Header>
  )
}
