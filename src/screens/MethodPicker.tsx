/**
 * Brew, erster Schritt — welche Methode?
 *
 * Zwei Betriebsarten, dieselbe Liste:
 *
 *   `#/brew`            ohne Bohne  → Katalog, zuletzt benutzte oben
 *   `#/brew/-/<bohne>`  mit Bohne   → nach Eignung FÜR DIESE BOHNE sortiert
 *
 * Der zweite Fall ist die Spiegelung von BeanPicker und damit die Antwort
 * auf „ich habe diese Bohne, wie brühe ich sie am besten?". Beide
 * Richtungen benutzen dieselben Daten — `suitability` für die
 * Schwierigkeit, `origin.methodSuitability` für die Empfehlung —, damit
 * sie sich nicht widersprechen können.
 */
import type { Bean, BrewMethod } from '@domain'
import type { Route } from '@/router'
import { useStore } from '@/store'
import { METHODS, METHOD_LABEL, ROAST_LABEL, PROCESS_LABEL } from '@/labels'
import { getMethod, getOrigin } from '@/kb'
import { suitability, SUITABILITY_LABEL, type Suitability } from '@/engine/suitability'
import { Screen, Header, Section, Card, GearButton } from '@/components/ui'

interface Props {
  /** Gesetzt: Die Methoden werden für diese Bohne bewertet und sortiert. */
  bean?: Bean
  route: Route
  navigate: (r: Route, replace?: boolean) => void
  back: () => void
}

interface Bewertet {
  method: BrewMethod
  suitability?: Suitability
  rank: number
}

export default function MethodPicker({ bean, navigate, back }: Props) {
  const lastMethod = useStore((s) => s.settings.lastMethod)

  const liste: Bewertet[] = METHODS.map((m) => {
    if (!bean) {
      // Ohne Bohne gibt es keine Eignung — dann steht die zuletzt
      // benutzte Methode oben, weil sie am wahrscheinlichsten wieder
      // gebraucht wird. Alles andere behält die Anzeigereihenfolge.
      return { method: m, rank: m === lastMethod ? 1 : 0 }
    }
    const suit = suitability(bean, m)
    const origin = bean.origins[0] ? getOrigin(bean.origins[0].country) : undefined
    const fit = origin?.methodSuitability?.[m]
    // Dieselbe Rechnung wie in bestMethodFor: Empfohlen wird nach dem
    // Herkunftsprofil, die Schwierigkeit kommt als Abschlag dazu.
    const basis = fit ?? suit.score
    return { method: m, suitability: suit, rank: basis - (suit.score < 3.5 ? 0.75 : 0) }
  }).sort((a, b) => b.rank - a.rank)

  return (
    <Screen>
      <Header
        title={bean ? bean.name : 'Brew'}
        large={!bean}
        subtitle={
          bean ? `${ROAST_LABEL[bean.roastLevel]} · ${PROCESS_LABEL[bean.process]}` : undefined
        }
        onBack={bean ? back : undefined}
        right={bean ? undefined : <GearButton onClick={() => navigate({ tab: 'setup' })} />}
      />

      <Section
        action={
          <span className="text-[12px] text-faint">
            {bean ? 'nach Eignung für diese Bohne' : 'Methode wählen'}
          </span>
        }
      >
        <div className="space-y-2">
          {liste.map((e, i) => {
            const profil = getMethod(e.method)
            const erste = i === 0 && !!bean && e.rank >= 3
            const zuletzt = !bean && e.method === lastMethod
            return (
              <Card
                key={e.method}
                tone={erste || zuletzt ? 'accent' : 'default'}
                onClick={() =>
                  navigate(
                    bean
                      ? { tab: 'brew', id: e.method, detail: bean.id }
                      : { tab: 'brew', id: e.method },
                  )
                }
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="text-[17px] leading-tight font-semibold">
                        {METHOD_LABEL[e.method]}
                      </p>
                      {erste && <span className="shrink-0 text-[11px] text-crema">beste Wahl</span>}
                      {zuletzt && <span className="shrink-0 text-[11px] text-crema">zuletzt</span>}
                    </div>

                    {/* Mit Bohne trägt die Zeile das Urteil, ohne Bohne
                        den Kurztext der Methode. Beides gleichzeitig wäre
                        eine Zeile zu viel. */}
                    {e.suitability ? (
                      <>
                        <p className="mt-0.5 text-[13px] text-mute">
                          {SUITABILITY_LABEL[e.suitability.level]}
                        </p>
                        <p
                          className={`mt-1 text-[12px] leading-snug ${
                            e.suitability.isWarning ? 'text-warn' : 'text-faint'
                          }`}
                        >
                          {e.suitability.reason}
                        </p>
                      </>
                    ) : (
                      profil.short && (
                        <p className="mt-1 text-[13px] leading-snug text-mute">{profil.short}</p>
                      )
                    )}
                  </div>
                  <span className="mt-0.5 shrink-0 text-faint">›</span>
                </div>
              </Card>
            )
          })}
        </div>
      </Section>
    </Screen>
  )
}
