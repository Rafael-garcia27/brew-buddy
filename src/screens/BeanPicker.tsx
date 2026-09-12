/**
 * Brew, zweiter Schritt — welche Bohne für diese Methode?
 *
 * Die Liste ist sortiert, und jede Zeile sagt, warum sie dort steht. Eine
 * sortierte Liste ohne Begründung wäre die einzige Stelle in dieser App,
 * an der man ihr glauben müsste statt sie zu prüfen.
 *
 * Die Reihenfolge kommt aus `bestBeansFor` und wiegt drei Dinge: wo die
 * Bohne ihre Stärken ausspielt, wie schwierig sie in dieser Methode ist,
 * und wie frisch sie noch ist. Was nicht im Haus ist, steht unten.
 */
import type { BrewMethod } from '@domain'
import type { Route } from '@/router'
import { useStore } from '@/store'
import { bestBeansFor, RANK_SCHWELLE, type BeanRanking } from '@/engine/suitability'
import { METHOD_LABEL, ROAST_LABEL, PROCESS_LABEL } from '@/labels'
import { Screen, Header, Section, Card, Button, Empty, num } from '@/components/ui'
import { BeanRing } from '@/components/beanviz'

interface Props {
  method: BrewMethod
  route: Route
  navigate: (r: Route, replace?: boolean) => void
  back: () => void
}

export default function BeanPicker({ method, navigate, back }: Props) {
  const beans = useStore((s) => s.beans)
  const bags = useStore((s) => s.bags)

  const rang = bestBeansFor(method, beans, bags)
  const brauchbar = rang.filter((r) => !r.unavailable)
  const nichtDa = rang.filter((r) => r.unavailable)
  /**
   * Nichts passt wirklich.
   *
   * kb/15 §6 lässt „die Bohne passt nicht zur Methode" ausdrücklich als
   * Aussage zu. Dann ist es ehrlicher, das zu sagen, als die am wenigsten
   * schlechte Bohne als Empfehlung auszugeben.
   */
  const nichtsPasst = brauchbar.length > 0 && brauchbar[0]!.rank < RANK_SCHWELLE

  if (beans.length === 0) {
    return (
      <Screen>
        <Header title={METHOD_LABEL[method]} subtitle="Bohne wählen" onBack={back} />
        <Empty
          title="Noch keine Bohne"
          body="Für eine Empfehlung braucht ich mindestens eine Bohne im Regal. Röstdatum, Herkunft und Röstgrad fließen direkt ein."
          action={<Button onClick={() => navigate({ tab: 'coffee', detail: 'new' })}>Bohne anlegen</Button>}
        />
      </Screen>
    )
  }

  return (
    <Screen>
      {/* Nicht der Kurztext der Methode: Der stand auf dem Bildschirm
          davor und wird im Kopf ohnehin abgeschnitten. Hier zählt, was
          jetzt zu tun ist. */}
      <Header title={METHOD_LABEL[method]} subtitle="Bohne wählen" onBack={back} />

      {nichtsPasst && (
        <Section>
          <Card tone="warn">
            <p className="text-lg leading-snug">
              <strong>Für {METHOD_LABEL[method]} passt gerade nichts richtig.</strong> Du kannst
              trotzdem brühen — es wird nur mehr Arbeit, als es sein müsste.
            </p>
            <p className="mt-2 text-sm leading-snug text-mute">
              Das ist keine Fehlbedienung, sondern eine Materialeigenschaft: Manche Bohnen spielen
              in dieser Methode ihre Stärken nicht aus.
            </p>
          </Card>
        </Section>
      )}

      {brauchbar.length > 0 && (
        <Section
          title={nichtsPasst ? 'Am ehesten' : 'Empfehlung'}
          action={<span className="text-xs text-faint">nach Eignung und Frische</span>}
        >
          <div className="space-y-2">
            {brauchbar.map((r, i) => (
              <BohnenZeile
                key={r.bean.id}
                r={r}
                erste={i === 0 && !nichtsPasst}
                onClick={() => navigate({ tab: 'brew', id: method, detail: r.bean.id })}
              />
            ))}
          </div>
        </Section>
      )}

      {nichtDa.length > 0 && (
        <Section
          title="Nicht im Haus"
          action={<span className="text-xs text-faint">nicht brühbar</span>}
        >
          <div className="space-y-2">
            {nichtDa.map((r) => (
              <BohnenZeile
                key={r.bean.id}
                r={r}
                onClick={() => navigate({ tab: 'profile', id: r.bean.id })}
              />
            ))}
          </div>
        </Section>
      )}
    </Screen>
  )
}

function BohnenZeile({
  r,
  erste,
  onClick,
}: {
  r: BeanRanking
  erste?: boolean
  onClick: () => void
}) {
  const { bean, freshness: f, suitability: s, unavailable } = r
  return (
    <Card tone={erste ? 'accent' : 'default'} onClick={onClick}>
      <div className="flex items-start gap-3">
        {/* Dasselbe Element wie im Regal: Wer von Coffee kommt, soll die
            Bohne am selben Zeichen wiedererkennen. */}
        <div className={unavailable ? 'opacity-40' : undefined}>
          <BeanRing bean={bean} score={f.score} label={f.days !== null ? String(f.days) : '?'} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-xl leading-tight font-semibold">{bean.name}</p>
            {erste && <span className="shrink-0 text-2xs text-crema">beste Wahl</span>}
          </div>
          {/* Nur die Identität der Bohne. Das Urteil steht eine Zeile
              tiefer und begründet sich dort auch — hier machte es die
              Zeile so lang, dass „gut geei…" übrig blieb. */}
          <p className="mt-0.5 truncate text-sm text-mute">
            {ROAST_LABEL[bean.roastLevel]} · {PROCESS_LABEL[bean.process]}
          </p>
          {/* Der Satz, der die Platzierung erklärt. Bei „nicht im Haus"
              in Warnfarbe, weil es dann kein Geschmacksurteil ist. */}
          <p
            className={`mt-1 text-xs leading-snug ${
              unavailable ? 'text-warn' : s.isWarning ? 'text-warn' : 'text-faint'
            }`}
          >
            {r.note}
          </p>
          {!unavailable && r.bag?.remainingGrams !== undefined && (
            <p className="mt-0.5 text-xs text-faint">
              {num(r.bag.remainingGrams, 0)} g übrig
            </p>
          )}
        </div>
        <span className="mt-0.5 shrink-0 text-faint">›</span>
      </div>
    </Card>
  )
}
