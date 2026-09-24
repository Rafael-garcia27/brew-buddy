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
 * Richtungen benutzen `rankMethodsFor` — dieselbe Funktion, aus der auch
 * die Empfehlung und der Fit im Profil kommen, damit sich nicht drei
 * Bildschirme über dieselbe Bohne widersprechen können.
 *
 * Drei Stufen von Sichtbarkeit, und jede hat einen Grund:
 *
 *   **Im Haus** — die Methoden, die man besitzt. Voll dargestellt.
 *   **Weitere** — eingemessen, aber nicht als vorhanden markiert.
 *   **Gibt es auch** — vom Katalog gekannt, von der Engine nicht. Gedämpft,
 *                      antippbar, öffnet keine Brühung, sondern die Erklärung.
 *
 * Die dritte Stufe ist die Neuerung, und sie ist eine Aussage über
 * Ehrlichkeit: „Mokkakanne" anzuzeigen und einen erfundenen Startpunkt
 * dazu auszugeben wäre schlimmer als sie weglassen. Sie zu zeigen UND zu
 * sagen, dass die Zahlen fehlen, ist besser als beides.
 */
import { useMemo, useState } from 'react'
import type { Bean, BrewMethod } from '@domain'
import type { Route } from '@/router'
import { useStore } from '@/store'
import { METHODS, METHOD_LABEL, ROAST_LABEL, PROCESS_LABEL } from '@/labels'
import { getMethod, ANNOUNCED_METHODS, type AnnouncedMethod } from '@/kb'
import { rankMethodsFor, SUITABILITY_LABEL, type MethodRanking } from '@/engine/suitability'
import { MethodIcon } from '@/components/methodicons'
import { Screen, Header, Section, Card, Button, GearButton, Sheet, Toggle } from '@/components/ui'

interface Props {
  /** Gesetzt: Die Methoden werden für diese Bohne bewertet und sortiert. */
  bean?: Bean
  route: Route
  navigate: (r: Route, replace?: boolean) => void
  back: () => void
}

/** Ohne Bohne gibt es keine Eignung — dann trägt nur die Reihenfolge. */
type Eintrag = MethodRanking | { method: BrewMethod; rank: number }

const hatEignung = (e: Eintrag): e is MethodRanking => 'suitability' in e

export default function MethodPicker({ bean, navigate, back }: Props) {
  const lastMethod = useStore((s) => s.settings.lastMethod)
  // Den Rohwert abonnieren, nicht `?? []`: Ein neues Array bei jedem
  // Rendern hat diese App schon einmal in eine Endlosschleife geschickt.
  const favRoh = useStore((s) => s.settings.favoriteMethods)
  const setSettings = useStore((s) => s.setSettings)

  const [bearbeiten, setBearbeiten] = useState(false)
  const [erklaert, setErklaert] = useState<AnnouncedMethod | null>(null)

  /**
   * Welche Methoden gelten als vorhanden?
   *
   * Leer heißt ALLE, nicht keine. Beim ersten Start hat niemand Favoriten
   * gesetzt; ein leerer Katalog wäre dann eine Sackgasse, die wie ein
   * Fehler aussieht. Gefiltert wird zusätzlich gegen METHODS, damit ein
   * alter gespeicherter Wert keine Zeile erzeugt, die es nicht mehr gibt.
   */
  const favoriten = useMemo<BrewMethod[]>(() => {
    const gesetzt = (favRoh ?? []).filter((m) => (METHODS as string[]).includes(m))
    return gesetzt.length ? gesetzt : METHODS
  }, [favRoh])

  const alleGewaehlt = favoriten.length === METHODS.length

  const liste: Eintrag[] = useMemo(() => {
    if (bean) return rankMethodsFor(bean)
    // Ohne Bohne steht die zuletzt benutzte Methode oben, weil sie am
    // wahrscheinlichsten wieder gebraucht wird. Alles andere behält die
    // Anzeigereihenfolge.
    return METHODS.map((m) => ({ method: m, rank: m === lastMethod ? 1 : 0 })).sort(
      (a, b) => b.rank - a.rank,
    )
  }, [bean, lastMethod])

  const imHaus = liste.filter((e) => favoriten.includes(e.method))
  const weitere = liste.filter((e) => !favoriten.includes(e.method))

  const umschalten = (m: BrewMethod) => {
    // Beim ersten Umschalten wird aus „alle" eine echte Liste — sonst
    // würde ein einzelnes Abwählen wie ein einzelnes Anwählen wirken.
    const basis: BrewMethod[] = (favRoh ?? []).length ? favRoh! : METHODS
    const neu = basis.includes(m) ? basis.filter((x) => x !== m) : [...basis, m]
    // Nie ins Leere: Leer bedeutet „alle", das Abwählen der letzten
    // Methode hätte also das Gegenteil des Gemeinten bewirkt.
    if (!neu.length) return
    setSettings({ favoriteMethods: neu })
  }

  const oeffnen = (m: BrewMethod) =>
    navigate(bean ? { tab: 'brew', id: m, detail: bean.id } : { tab: 'brew', id: m })

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

      {bearbeiten ? (
        <Section
          title="Was hast du im Haus?"
          action={
            <Button size="sm" variant="ghost" className="-mr-3" onClick={() => setBearbeiten(false)}>
              Fertig
            </Button>
          }
        >
          <Card>
            <div className="divide-y divide-line">
              {METHODS.map((m) => (
                <div key={m} className="flex items-center gap-3">
                  <span className="shrink-0 text-mute">
                    <MethodIcon icon={getMethod(m).icon ?? m} className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Toggle
                      checked={favoriten.includes(m)}
                      onChange={() => umschalten(m)}
                      label={METHOD_LABEL[m]}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 border-t border-line pt-2.5 text-xs leading-snug text-faint">
              Abgewählte Methoden verschwinden nicht — sie stehen nur eine Zeile weiter unten.
              Mindestens eine bleibt ausgewählt.
            </p>
          </Card>
        </Section>
      ) : (
        <>
          <Section
            action={
              <span className="text-xs text-faint">
                {bean ? 'nach Eignung für diese Bohne' : 'Methode wählen'}
              </span>
            }
          >
            <div className="space-y-2">
              {imHaus.map((e, i) => (
                <MethodenZeile
                  key={e.method}
                  eintrag={e}
                  erste={i === 0}
                  zuletzt={!bean && e.method === lastMethod}
                  onClick={() => oeffnen(e.method)}
                />
              ))}
            </div>
          </Section>

          {/* Eingemessen, aber nicht als vorhanden markiert. Sichtbar und
              nicht versteckt: Wer ein Gerät neu hat, findet es hier — und
              kann es gleich dauerhaft dazunehmen. */}
          {weitere.length > 0 && (
            <Section
              title="Weitere Methoden"
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  className="-mr-3"
                  onClick={() => setBearbeiten(true)}
                >
                  Auswählen
                </Button>
              }
            >
              <div className="space-y-2">
                {weitere.map((e) => (
                  <MethodenZeile
                    key={e.method}
                    eintrag={e}
                    gedaempft
                    onClick={() => oeffnen(e.method)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Ist alles ausgewählt, fehlt der Abschnitt „Weitere" und mit
              ihm der Weg zum Auswählen. Der Knopf muss trotzdem
              erreichbar bleiben. */}
          {alleGewaehlt && !bean && (
            <Section>
              <Button variant="ghost" className="w-full" onClick={() => setBearbeiten(true)}>
                Auswahl einschränken
              </Button>
            </Section>
          )}

          {ANNOUNCED_METHODS.length > 0 && (
            <Section
              title="Gibt es auch"
              action={<span className="text-xs text-faint">noch nicht eingemessen</span>}
            >
              <div className="space-y-2">
                {ANNOUNCED_METHODS.map((a) => (
                  <Card key={a.id} onClick={() => setErklaert(a)}>
                    <div className="flex items-start gap-3 opacity-55">
                      <span className="shrink-0 text-mute">
                        <MethodIcon icon={a.icon} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xl leading-tight font-medium">{a.label}</p>
                        <p className="mt-1 text-sm leading-snug text-mute">{a.teaser}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      {erklaert && (
        <Sheet title={erklaert.label} onClose={() => setErklaert(null)}>
          <div className="flex items-start gap-3">
            <span className="shrink-0 text-crema-ink">
              <MethodIcon icon={erklaert.icon} className="h-10 w-10" />
            </span>
            <p className="text-lg leading-snug">{erklaert.teaser}</p>
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-xs text-mute">Warum noch nicht brühbar</p>
            <p className="mt-1 text-lg leading-relaxed">{erklaert.why}</p>
          </div>
          <p className="mt-4 text-sm leading-snug text-faint">
            Für jede brühbare Methode führt die App Zielkorridore, Frischefenster und
            Korrekturregeln. Solange die für dieses Gerät fehlen, gibt sie keinen Startpunkt aus —
            ein geratener wäre schlechter als keiner.
          </p>
        </Sheet>
      )}
    </Screen>
  )
}

function MethodenZeile({
  eintrag,
  erste,
  zuletzt,
  gedaempft,
  onClick,
}: {
  eintrag: Eintrag
  erste?: boolean
  zuletzt?: boolean
  gedaempft?: boolean
  onClick: () => void
}) {
  const profil = getMethod(eintrag.method)
  const eignung = hatEignung(eintrag) ? eintrag.suitability : undefined
  // „Beste Wahl" nur, wenn sie es auch ist: Steht eine Methode oben, weil
  // alle anderen noch schlechter passen, ist das keine Empfehlung.
  const beste = erste && hatEignung(eintrag) && eintrag.viable && eintrag.rank >= 3

  return (
    <Card tone={beste || zuletzt ? 'accent' : 'default'} onClick={onClick}>
      <div className={`flex items-start gap-3 ${gedaempft ? 'opacity-70' : ''}`}>
        <span className={`shrink-0 ${beste || zuletzt ? 'text-crema-ink' : 'text-mute'}`}>
          <MethodIcon icon={profil.icon ?? eintrag.method} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-xl leading-tight font-semibold">{METHOD_LABEL[eintrag.method]}</p>
            {beste && <span className="shrink-0 text-2xs text-crema-ink">beste Wahl</span>}
            {zuletzt && <span className="shrink-0 text-2xs text-crema-ink">zuletzt</span>}
          </div>

          {/* Mit Bohne trägt die Zeile das Urteil, ohne Bohne den Kurztext
              der Methode. Beides gleichzeitig wäre eine Zeile zu viel. */}
          {eignung ? (
            <>
              <p className="mt-0.5 text-sm text-mute">{SUITABILITY_LABEL[eignung.level]}</p>
              <p
                className={`mt-1 text-xs leading-snug ${
                  eignung.isWarning ? 'text-warn' : 'text-faint'
                }`}
              >
                {eignung.reason}
              </p>
            </>
          ) : (
            profil.short && (
              <p className="mt-1 text-sm leading-snug text-mute">{profil.short}</p>
            )
          )}
        </div>
        <span className="mt-0.5 shrink-0 text-faint">›</span>
      </div>
    </Card>
  )
}
