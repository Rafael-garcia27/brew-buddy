/**
 * Das Profil einer Bohne — die Seite hinter dem Antippen einer Karte.
 *
 * Herausgelöst aus `BeansScreen.tsx` (P8, Befund F-09): Die Datei hatte
 * 1429 Zeilen und war zugleich der Änderungs-Hotspot der Historie. Regal,
 * Profil und die beiden Formulare haben nichts miteinander zu tun außer
 * der Bohne, um die es geht.
 *
 * Reines Verschieben, kein Verhalten geändert.
 */
import { lazy, Suspense, useMemo, useState } from 'react'
import { useStore } from '@/store'
import type { Bag, Bean, BrewMethod } from '@domain'
import type { BeanTrash } from '@/domain'
import {
  rankMethodsFor,
  freshnessFor,
  freshnessMethod,
  SUITABILITY_LABEL,
  } from '@/engine/suitability'

import { METHODS, METHOD_LABEL, METHOD_SHORT } from '@/labels'
import {
  Screen, Header, Section, Card, Button, FreshnessRing, num,
} from '@/components/ui'
/**
 * Nachgeladen, nicht mitgeliefert: Die Kartendaten sind das größte
 * Einzelstück der App und werden nur hier gebraucht. Der Platzhalter hat
 * dasselbe Seitenverhältnis, damit die Karte beim Eintreffen nichts
 * verschiebt.
 */
const OriginMap = lazy(() => import('@/components/OriginMap'))
import { Liste, ListenZeile } from '@/components/Bohnenliste'
import { Bereichsgrenze } from '@/components/ErrorBoundary'
import { RoastScale, ProcessMark, FactTable, type Fact } from '@/components/beanviz'


import { BeanSheet, BagSheet } from './BeanForms'

// ── Detailansicht ─────────────────────────────────────────────────────

/**
 * Das Profil einer Bohne — von der Grafik zur Tabelle.
 *
 * Die Reihenfolge ist die Aussage: Was man ohne Lesen erfasst, steht
 * oben, was man nachschlägt, unten. Vier Gruppen, je eine Frage:
 *
 *   Steckbrief  Karte · Röstung · Aufbereitung · Fakten
 *   Methoden    welche passt, nach Eignung sortiert
 *   Bags        was im Schrank steht, mit Vorrat und Frischefenster
 *   Bestwerte   was schon geklappt hat
 *
 * Früher lagen Röstgrad, Aufbereitung, Herkunft, Farm, Höhe, Varietät und
 * Koffein als sieben gleich große Kacheln in einem Raster; danach als
 * sieben einzelne Karten. Beides ist keine Hierarchie, sondern eine
 * Liste. Die drei Werte, die die Empfehlung bestimmen, bekommen eine
 * Grafik, der Rest die Tabelle — und alles, was die Bohne beschreibt,
 * steht in einer Fläche.
 */
export function BeanDetail({
  bean,
  onBack,
  onDeleted,
}: {
  bean: Bean
  onBack: () => void
  /**
   * Gelöscht — mit dem, was dabei wegfiel.
   *
   * Der Hinweis mit „Rückgängig“ kann nicht hier stehen: Dieser
   * Bildschirm ist im selben Moment weg. Er gehört eine Ebene höher.
   */
  onDeleted?: (papierkorb: BeanTrash) => void
}) {
  const [showEdit, setShowEdit] = useState(false)
  const allBags = useStore((s) => s.bags)
  const allBrews = useStore((s) => s.brews)
  const bags = useMemo(() => allBags.filter((b) => b.beanId === bean.id), [allBags, bean.id])
  const brews = useMemo(() => allBrews.filter((b) => b.beanId === bean.id), [allBrews, bean.id])
  const deleteBean = useStore((s) => s.deleteBean)
  const loeschen = () => {
    const papierkorb = deleteBean(bean.id)
    if (papierkorb && onDeleted) onDeleted(papierkorb)
    onBack()
  }
  const addBag = useStore((s) => s.addBag)
  const updateBag = useStore((s) => s.updateBag)
  const deleteBag = useStore((s) => s.deleteBag)
  /**
   * Eine Tüte entfernen — mit Rückfrage, sobald sie Protokolle mitnimmt.
   *
   * `deleteBag` löscht auch die Brews, die auf diese Tüte gebucht sind;
   * das ist richtig, weil ein Protokoll ohne seine Tüte keine Frische
   * mehr kennt. Ohne Rückfrage wäre es aber ein stiller Datenverlust.
   * Eine versehentlich angelegte Tüte hat noch keine Protokolle und geht
   * deshalb ohne Nachfrage.
   */
  const bagLoeschen = (b: Bag) => {
    const daran = brews.filter((x) => x.bagId === b.id).length
    if (daran > 0) {
      const frage =
        daran === 1
          ? 'Diese Bag und das eine Protokoll dazu löschen?'
          : `Diese Bag und die ${daran} Protokolle dazu löschen?`
      if (!confirm(frage)) return
    }
    deleteBag(b.id)
  }
  const [showBag, setShowBag] = useState(false)
  /** Gesetzt: diese Tüte wird bearbeitet. */
  const [editBag, setEditBag] = useState<Bag | undefined>()

  /**
   * Der Fit, nach Eignung sortiert.
   *
   * Vorher stand er in Anzeigereihenfolge — Espresso, V60, AeroPress,
   * French Press —, also immer gleich, egal welche Bohne. Eine Liste, die
   * sich nicht ändert, beantwortet keine Frage.
   *
   * Sortiert wird mit derselben Funktion, aus der die Empfehlung unter
   * Brew kommt. Eine eigene Sortierung nach `suitability` wäre einfacher
   * gewesen und hätte hier eine andere Methode obenauf gesetzt als dort —
   * bei derselben Bohne, zwei Bildschirme voneinander entfernt.
   */
  const fit = useMemo(() => rankMethodsFor(bean), [bean])
  /**
   * Der Fit zeigt ALLE eingemessenen Methoden, auch die nicht im Haus.
   *
   * Anders als der Katalog und der Umschalter, und mit Absicht: Das
   * Profil ist ein Informationsbildschirm. „Diese Bohne wäre im V60
   * hervorragend" ist eine nützliche Auskunft, auch wenn gerade kein V60
   * dasteht — sie ist ein Grund, einen zu kaufen. Verschwiegen würde sie
   * zu einer Lücke, die man nicht sieht.
   *
   * Angemerkt wird es trotzdem, sonst widerspricht die Reihenfolge hier
   * der Empfehlung zwei Bildschirme weiter, ohne dass erkennbar wäre,
   * warum.
   */
  const favRoh = useStore((s) => s.settings.favoriteMethods)
  const imHaus = useMemo(() => {
    const gesetzt = (favRoh ?? []).filter((m) => (METHODS as string[]).includes(m))
    return gesetzt.length ? gesetzt : METHODS
  }, [favRoh])

  /** Was noch da ist — über alle offenen Tüten. */
  const vorrat = bags
    .filter((b) => !b.depleted && typeof b.remainingGrams === 'number')
    .reduce((sum, b) => sum + (b.remainingGrams ?? 0), 0)

  /**
   * Nur, was nirgends sonst auf dieser Seite steht.
   *
   * Name und Röster stehen im Kopf, Röstung und Aufbereitung als Skala
   * direkt darüber (die Skala trägt auch den Agtron-Wert), der Vorrat bei
   * den Bags. Vorher standen sie hier ein zweites Mal — eine Tabelle, die
   * zur Hälfte wiederholt, bringt einem bei, sie zu überspringen, und dann
   * überliest man auch die Höhe.
   */
  const fakten: Fact[] = [
    {
      label: 'Höhe',
      value: bean.altitudeMasl ? `${bean.altitudeMasl[0]}–${bean.altitudeMasl[1]} m` : '',
    },
    { label: 'Varietät', value: bean.varieties?.join(', ') ?? '' },
    { label: 'Ernte', value: bean.harvestYear ? String(bean.harvestYear) : '' },
    { label: 'Dichte', value: bean.densityGL ? `${bean.densityGL} g/l` : '' },
    { label: 'Koffein', value: bean.isDecaf ? 'entkoffeiniert' : '' },
    { label: 'Preis', value: bean.pricePerKg ? `${num(bean.pricePerKg, 2)} €/kg` : '' },
    { label: 'Notizen', value: bean.flavorNotes?.join(', ') ?? '' },
  ].filter((f) => f.value)

  const bestByMethod = METHODS
    .map((m) => {
      const list = brews.filter((b) => b.method === m && (b.tasting?.rating ?? 0) >= 4)
      const best = list.sort((a, b) => (b.tasting!.rating - a.tasting!.rating))[0]
      return best ? { method: m, brew: best } : null
    })
    .filter(Boolean) as { method: BrewMethod; brew: (typeof brews)[number] }[]

  return (
    <Screen>
      <Header
        title={bean.name}
        subtitle={bean.roaster}
        onBack={onBack}
        right={
          <Button size="sm" variant="ghost" className="-mr-2" onClick={() => setShowEdit(true)}>
            Bearbeiten
          </Button>
        }
      />

      {/*
        Vier Gruppen statt sieben Kästen.

        Vorher stand jeder Baustein in einer eigenen Karte: Karte, Röstung,
        Aufbereitung, Fit, Fakten, jede Bag, jede beste Einstellung. Sieben
        gleich gerahmte Flächen ohne Überschrift sagen nicht, was
        zusammengehört — dieselbe Lektion wie im Regal (090d2f0). Jetzt
        ordnet die Seite nach Fragen:

          Steckbrief   was ist das für eine Bohne?   Karte, Röstung, Aufbereitung, Fakten
          Methoden     womit brühe ich sie?
          Bags         was steht im Schrank?
          Bestwerte    was hat schon geklappt?

        Innerhalb einer Gruppe trennt eine Haarlinie, nicht ein Rahmen.
        Nichts ist weggefallen außer Wiederholungen; alle Bedienelemente
        stehen, wo sie standen, nur in weniger Behältern.
      */}
      <Section title="Steckbrief">
        <Card>
          {/* Beiwerk mit eigenem Netz: Der Kartenbrocken wird nachgeladen
              und kann nach einer Aktualisierung fehlen. Ohne diese Grenze
              nähme er das ganze Profil mit. */}
          <Bereichsgrenze was="Die Karte" neustartBei={bean.id}>
          <Suspense
            fallback={
              <div>
                <div className="aspect-[360/116] w-full rounded-input border border-line bg-paper" />
                <div className="mt-2.5 h-[17px]" />
              </div>
            }
          >
            <OriginMap origins={bean.origins} />
          </Suspense>
          </Bereichsgrenze>

          {/* Röstung und Aufbereitung zusammen, weil sie zusammen gelesen
              werden: Ein helles Natural und ein dunkles Washed sind zwei
              verschiedene Kaffees. */}
          <Fach>
            <RoastScale bean={bean} />
          </Fach>
          <Fach>
            <ProcessMark process={bean.process} />
          </Fach>
          {fakten.length > 0 && (
            <Fach>
              <FactTable facts={fakten} />
            </Fach>
          )}
        </Card>
      </Section>

      {/* Zwei Achsen: Die Reihenfolge sagt, wo die Bohne glänzt
          (Herkunftsprofil), das Wort, wie leicht die Methode zu treffen
          ist (Eignung). */}
      <Section title="Methoden">
        <Card>
          <p className="mb-3 text-2xs leading-snug text-faint">
            Balken: wo die Bohne ihre Stärken ausspielt. Wort: wie leicht die Methode zu treffen
            ist.
          </p>
          <div className="space-y-2.5">
            {fit.map(({ method: m, suitability: f, rank, viable }, i) => (
              <div key={m} className="flex items-center gap-3">
                {/* Silbentrennung statt Überlauf: „Filterkaffeemaschine" ist
                    breiter als die Spalte und lief in die Balken hinein. */}
                <span
                  className={`w-24 shrink-0 text-base leading-tight hyphens-auto ${i === 0 ? 'font-semibold' : ''} ${
                    imHaus.includes(m) ? '' : 'text-mute'
                  }`}
                >
                  {METHOD_LABEL[m]}
                  {!imHaus.includes(m) && (
                    <span className="block text-2xs leading-tight text-faint">nicht im Haus</span>
                  )}
                </span>
                <span
                  className="flex gap-0.5"
                  aria-label={`Empfehlung ${Math.max(1, Math.round(rank))} von 5`}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={`h-1.5 w-5 rounded-full ${
                        n <= Math.max(1, Math.round(rank))
                          ? viable
                            ? 'bg-crema'
                            : 'bg-warn'
                          : 'bg-line'
                      }`}
                    />
                  ))}
                </span>
                <span
                  className={`min-w-0 flex-1 text-sm ${
                    f.isWarning || !viable ? 'text-warn' : i === 0 ? 'text-ink' : 'text-mute'
                  }`}
                >
                  {SUITABILITY_LABEL[f.level]}
                </span>
              </div>
            ))}
          </div>
          {/* Die Begründung gehört zur obersten, der empfohlenen Zeile. */}
          <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-mute">
            {fit[0]!.suitability.reason}
          </p>
        </Card>
      </Section>

      {/* Welche Methode das Fenster bestimmt, gehört hierhin: Die Liste
          darüber zeigt fünf Methoden, und das Ruhefenster gilt nur für
          eine davon (kb/05 §4). Der Vorrat über alle Bags steht daneben —
          er stand vorher in der Faktentabelle, weit weg von den Bags,
          aus denen er sich zusammensetzt. */}
      <Section
        title="Bags"
        action={
          <div className="flex items-baseline gap-2">
            {bags.length > 0 && (
              <span className="text-xs text-faint">
                {vorrat > 0 ? `${num(vorrat, 0)} g · ` : ''}Fenster für{' '}
                {METHOD_SHORT[freshnessMethod(bean)]}
              </span>
            )}
            <Button size="sm" variant="ghost" className="-mr-3" onClick={() => setShowBag(true)}>
              + Bag
            </Button>
          </div>
        }
      >
        {bags.length === 0 ? (
          <Card>
            <p className="text-base text-mute">
              Noch keine Bag. Ohne Röstdatum kann ich die Frische nicht mitführen.
            </p>
          </Card>
        ) : (
          <Liste>
            {bags.map((bag) => {
              // Dieselbe Funktion wie in der Übersicht.
              const f = freshnessFor(bean, bag)
              return (
                /**
                 * Leeren und Löschen sind zwei verschiedene Dinge.
                 *
                 * „Leer" ist eine Tatsache über eine Tüte, die es gab —
                 * ihre Protokolle bleiben und zählen weiter fürs Lernen.
                 * „Löschen" ist für die Tüte, die es nie gab: Sie nimmt
                 * ihre Protokolle mit und fragt deshalb nach.
                 */
                <ListenZeile
                  key={bag.id}
                  wischen={{
                    actions: [
                      { label: 'Edit', onClick: () => setEditBag(bag) },
                      { label: 'Löschen', tone: 'bad', onClick: () => bagLoeschen(bag) },
                    ],
                    onSwipeAway: () => bagLoeschen(bag),
                  }}
                >
                  <div className="flex items-center gap-3 bg-card px-4 py-3">
                    <FreshnessRing
                      score={bag.depleted ? 0 : f.score}
                      size={40}
                      label={f.days !== null ? String(f.days) : '?'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg leading-tight">
                        {bag.roastDate
                          ? `Geröstet ${new Date(bag.roastDate).toLocaleDateString('de-DE')}`
                          : 'Röstdatum fehlt'}
                      </p>
                      <p className="mt-0.5 text-sm text-mute">
                        {bag.remainingGrams !== undefined ? `${bag.remainingGrams} g übrig` : ''}
                        {bag.storage === 'frozen' ? ' · eingefroren' : ''}
                        {bag.depleted ? ' · leer' : ''}
                      </p>
                    </div>
                    {!bag.depleted && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="-mr-3"
                        onClick={() => updateBag(bag.id, { depleted: true })}
                      >
                        leer
                      </Button>
                    )}
                  </div>
                </ListenZeile>
              )
            })}
          </Liste>
        )}
      </Section>

      {bestByMethod.length > 0 && (
        <Section title="Deine besten Einstellungen">
          <Liste>
            {bestByMethod.map(({ method, brew }) => (
              <ListenZeile key={method} einzug={16}>
                <div className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm text-mute">{METHOD_LABEL[method]}</p>
                    <p className="text-sm text-crema-ink">{'★'.repeat(brew.tasting?.rating ?? 0)}</p>
                  </div>
                  <p className="tnum mt-0.5 text-xl">
                    {brew.actual.doseG} g →{' '}
                    {brew.actual.yieldG ? `${brew.actual.yieldG} g` : `${brew.actual.waterG} g Wasser`} ·{' '}
                    {brew.actual.timeS} s
                    {brew.actual.grindSetting ? ` · Mahlgrad ${brew.actual.grindSetting.value}` : ''}
                  </p>
                </div>
              </ListenZeile>
            ))}
          </Liste>
        </Section>
      )}

      <Section>
        {/* Bleibt neben der Wischgeste: Sie ist der schnelle Weg, dieser
            hier der auffindbare — und der einzige ohne Zeigergerät. */}
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            if (confirm(`„${bean.name}“ mit allen Bags und Protokollen löschen?`)) loeschen()
          }}
        >
          Bohne löschen
        </Button>
      </Section>

      {showEdit && <BeanSheet bean={bean} onClose={() => setShowEdit(false)} />}

      {showBag && (
        <BagSheet
          onClose={() => setShowBag(false)}
          onSave={(b) => {
            addBag({ beanId: bean.id, ...b })
            setShowBag(false)
          }}
        />
      )}

      {/* Dasselbe Blatt, andere Richtung. Ein vertipptes Röstdatum war
          bisher nur durch Löschen und Neuanlegen zu korrigieren — und
          die Tüte nimmt ihre Protokolle mit. */}
      {editBag && (
        <BagSheet
          bag={editBag}
          onClose={() => setEditBag(undefined)}
          onSave={(b) => {
            updateBag(editBag.id, b)
            setEditBag(undefined)
          }}
        />
      )}
    </Screen>
  )
}

/**
 * Ein Fach in einer Karte: Haarlinie darüber, Luft darum.
 *
 * Der Steckbrief ist eine Fläche mit vier Teilen. Ein eigener Rahmen je
 * Teil machte daraus wieder vier Karten.
 */
function Fach({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 border-t border-line pt-4">{children}</div>
}
