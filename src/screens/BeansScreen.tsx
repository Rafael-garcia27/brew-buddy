/**
 * Coffee — das Regal, und die eine Hälfte der Frage, die die App
 * beantwortet: „Ich habe diese Bohne, wie brühe ich sie am besten?"
 * Die andere Hälfte steht unter Brew.
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
import type { BeanTrash } from '@/domain'
import {
  suitability,
  bestMethodFor,
  rankMethodsFor,
  freshnessFor,
  freshnessMethod,
  SUITABILITY_LABEL,
  GEEIGNET_AB,
} from '@/engine/suitability'
import {
  getOrigin,
  BLEND,
  findCountry,
  originOptions,
  processFamily,
  PROCESS_FAMILIES,
  agtronBand,
  agtronSpan,
  AGTRON_RANGE,
} from '@/kb'

import { METHODS, ROAST_LABEL, PROCESS_LABEL, METHOD_LABEL, METHOD_SHORT } from '@/labels'
import {
  Screen, Header, Section, Card, Button, Field, TextInput, Select, Sheet,
  Empty, FreshnessRing, Stepper, Toggle, Chip, GearButton, LogButton, FilterRow, num,
} from '@/components/ui'
import { BackupBanner, SetupNudge } from '@/components/system'
/**
 * Nachgeladen, nicht mitgeliefert: Die Kartendaten sind das größte
 * Einzelstück der App und werden nur hier gebraucht. Der Platzhalter hat
 * dasselbe Seitenverhältnis, damit die Karte beim Eintreffen nichts
 * verschiebt.
 */
const OriginMap = lazy(() => import('@/components/OriginMap'))
import SwipeReveal from '@/components/SwipeReveal'
import { RoastScale, ProcessMark, FactTable, BeanRing, type Fact } from '@/components/beanviz'

interface Props {
  route: Route
  navigate: (r: Route, replace?: boolean) => void
  back: () => void
  /**
   * Eine Bohne wurde gelöscht — mit dem, was dabei wegfiel.
   *
   * Der Hinweis mit „Rückgängig“ gehört eine Ebene höher: Er soll auch
   * dann noch stehen, wenn dieser Bildschirm neu aufgebaut wird.
   */
  onDeleted?: (papierkorb: BeanTrash) => void
}

/**
 * Ab so vielen Bohnen lohnt eine Filterzeile.
 *
 * Darunter sieht man das Regal auf einen Blick, und ein Filter wäre eine
 * Bedienung, die keine Arbeit erspart. Vier ist der Punkt, ab dem die
 * Liste auf 375 px scrollt.
 */
const FILTER_AB = 4

/** Typische Anbauhöhe eines Ursprungslands, Mitte der bekannten Spanne. */
function typicalAltitude(country: string): number | null {
  const o = getOrigin(country)
  if (!o?.altitudeMasl) return null
  return Math.round((o.altitudeMasl[0] + o.altitudeMasl[1]) / 2 / 50) * 50
}

export default function BeansScreen({ route, navigate, onDeleted }: Props) {
  const beans = useStore((s) => s.beans)
  const bags = useStore((s) => s.bags)
  const brews = useStore((s) => s.brews)
  const lastBeanId = useStore((s) => s.settings.lastBeanId)
  const [showNew, setShowNew] = useState(route.detail === 'new')
  /** Gesetzt: Bearbeiten-Blatt für genau diese Bohne. */
  const [editBean, setEditBean] = useState<Bean | undefined>()
  const deleteBean = useStore((st) => st.deleteBean)
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
    navigate({ tab: 'coffee', id }, true)
  }

  const loeschen = (bean: Bean) => {
    const papierkorb = deleteBean(bean.id)
    // Die gelöschte Bohne darf nicht ausgewählt bleiben — sonst zeigen
    // die Aktionen darunter auf etwas, das es nicht mehr gibt.
    if (bean.id === selected) waehle(undefined)
    if (papierkorb && onDeleted) onDeleted(papierkorb)
  }

  /**
   * Zwei Filter, und beide nur, wenn das Regal groß genug ist.
   *
   * Bei drei Bohnen sieht man alles auf einen Blick; eine Filterzeile
   * wäre dann eine Bedienung, die keine Arbeit erspart, aber Platz
   * kostet. Angeboten wird außerdem nur, was im Regal vorkommt — eine
   * Auswahl „Anaerobic", die zu einer leeren Liste führt, ist keine
   * Auswahl, sondern eine Falle.
   */
  const [filterFamilie, setFilterFamilie] = useState<string | undefined>()
  const [filterMethode, setFilterMethode] = useState<BrewMethod | undefined>()
  const [filterOffen, setFilterOffen] = useState(false)
  const favRoh = useStore((s) => s.settings.favoriteMethods)

  const filterbar = beans.length >= FILTER_AB
  const familien = useMemo(() => {
    const da = new Set(beans.map((b) => processFamily(b.process).id))
    return PROCESS_FAMILIES.filter((f) => da.has(f.id))
  }, [beans])
  /**
   * „Geeignet für", nicht „am besten als".
   *
   * Filtern ist eine Suchhandlung: Man will alle Bohnen sehen, mit denen
   * ein V60 gelingt, nicht nur die eine, für die er die erste Wahl ist.
   * Der strenge Fall bleibt in der Zeile sichtbar („Am besten als …").
   *
   * Angeboten werden nur Methoden aus der Hausauswahl — nach einer
   * Methode zu filtern, die man nicht besitzt, hilft bei keiner Frage.
   */
  const methoden = useMemo(() => {
    const imHaus = (favRoh ?? []).length
      ? METHODS.filter((m) => favRoh!.includes(m))
      : METHODS
    return imHaus.filter((m) => beans.some((b) => suitability(b, m).score >= GEEIGNET_AB))
  }, [beans, favRoh])

  const sichtbar = useMemo(
    () =>
      beans.filter((b) => {
        if (filterFamilie && processFamily(b.process).id !== filterFamilie) return false
        if (filterMethode && suitability(b, filterMethode).score < GEEIGNET_AB) return false
        return true
      }),
    [beans, filterFamilie, filterMethode],
  )
  const gefiltert = !!filterFamilie || !!filterMethode
  /** Gibt es überhaupt etwas zu filtern? Sonst erscheint kein Knopf. */
  const filterOptionen = filterbar && (familien.length > 1 || methoden.length > 1)

  // „Welche Bohne heute?" — nach Frischefenster sortiert (Briefing Teil D)
  const ranked = sichtbar
    .map((b) => {
      const best = bestMethodFor(b)
      const bag = bags.filter((x) => x.beanId === b.id && !x.depleted)[0]
      // Eine Entscheidung, ein Ort: Das Ruhefenster ist methodenabhängig,
      // und welche Methode dafür zählt, sagt die Engine — nicht jeder
      // Bildschirm für sich.
      const f = freshnessFor(b, bag)
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
        title="Coffee"
        large
        right={
          <div className="flex items-center gap-1">
            {beans.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setShowNew(true)}>
                + Bohne
              </Button>
            )}
            {/* Das Logbuch über ALLE Bohnen hat mit zwei Reitern keinen
                eigenen Einstieg mehr. Es sitzt hier, weil „was habe ich
                schon gebrüht?" am Regal am nächsten steht. */}
            {beans.length > 0 && (
              <LogButton onClick={() => navigate({ tab: 'log' })} />
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

          {/* Zwei Achsen, einzeln umschaltbar — und eingeklappt.
              Ausgeklappt brauchten die zehn Chips vier Zeilen und 350 px,
              bevor die erste Bohne zu sehen war. Ein Filter, der die
              Liste verdeckt, die er filtern soll, kostet mehr als er
              bringt. Aktive Filter bleiben trotzdem sichtbar: Ein
              eingeklappter Filter, der still wirkt, ist eine Falle.

              Kein Mehrfachfilter je Achse: „Washed oder Natural" ist im
              Regal von acht Bohnen dasselbe wie „alle". */}
          {filterOptionen && (filterOffen || gefiltert) && (
            <Section>
              {filterOffen ? (
                <div className="space-y-2">
                  {familien.length > 1 && (
                    <FilterRow label="Aufbereitung">
                      {familien.map((f) => (
                        <Chip
                          key={f.id}
                          label={f.label}
                          active={filterFamilie === f.id}
                          onClick={() =>
                            setFilterFamilie(filterFamilie === f.id ? undefined : f.id)
                          }
                        />
                      ))}
                    </FilterRow>
                  )}
                  {methoden.length > 1 && (
                    <FilterRow label="geeignet für">
                      {methoden.map((m) => (
                        <Chip
                          key={m}
                          label={METHOD_SHORT[m]}
                          active={filterMethode === m}
                          onClick={() => setFilterMethode(filterMethode === m ? undefined : m)}
                        />
                      ))}
                    </FilterRow>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="-ml-3"
                    onClick={() => setFilterOffen(false)}
                  >
                    Zuklappen
                  </Button>
                </div>
              ) : (
                // Zugeklappt ohne aktiven Filter braucht es hier gar
                // nichts: Der Knopf sitzt dann in der Kopfzeile der Liste.
                gefiltert && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {filterFamilie && (
                      <Chip
                        label={`${familienName(filterFamilie)} ✕`}
                        active
                        onClick={() => setFilterFamilie(undefined)}
                      />
                    )}
                    {filterMethode && (
                      <Chip
                        label={`${METHOD_SHORT[filterMethode]} ✕`}
                        active
                        onClick={() => setFilterMethode(undefined)}
                      />
                    )}
                  </div>
                )
              )}
            </Section>
          )}

          {/* Der Filterknopf sitzt in der Kopfzeile der Liste, nicht in
              einem eigenen Abschnitt darüber: Dort stand er allein in
              einer Zeile, die sonst nichts trug, und schob die erste
              Bohne 70 px nach unten. Neben der Sortierangabe kostet er
              keine einzige Zeile. */}
          <Section
            action={
              <div className="flex items-baseline gap-3">
                <span className="text-[12px] text-faint">
                  {gefiltert ? `${sichtbar.length} von ${beans.length}` : 'nach Frische'}
                </span>
                {filterOptionen && !filterOffen && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="-mr-3"
                    onClick={() => setFilterOffen(true)}
                  >
                    Filtern
                  </Button>
                )}
              </div>
            }
          >
            <div className="space-y-2">
              {ranked.map(({ bean, fresh, count, best, bag }) => {
                const aktiv = bean.id === selected
                return (
                  <div key={bean.id}>
                    {/* Wischen legt Bearbeiten frei, weiter ziehen deutet
                        Löschen an, ganz hinausschieben löscht. Die
                        Aktionsflächen sind so hoch wie die Zeile —
                        deshalb sitzt die Geste hier und nicht im Profil,
                        wo sie über eine ganze Karte gehen müsste. */}
                    <SwipeReveal
                      actions={[
                        { label: 'Edit', onClick: () => setEditBean(bean) },
                        { label: 'Löschen', tone: 'bad', onClick: () => loeschen(bean) },
                      ]}
                      onSwipeAway={() => loeschen(bean)}
                      swipeAwayLabel="Loslassen zum Löschen"
                    >
                    <Card
                      tone={aktiv ? 'accent' : 'default'}
                      onClick={() => waehle(aktiv ? undefined : bean.id)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Drei Angaben statt einer: Ring = Frische,
                            Füllung = Röstgrad, Zahl = Tage. Die Zeile
                            bleibt eine Zeile — eine Liste aus lauter
                            Bohnenschaltflächen ohne Namen wäre ein
                            Ratespiel (docs/05 §4.5). */}
                        <BeanRing
                          bean={bean}
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
                              {fresh.short} — die Bag gibt nichts mehr her
                            </p>
                          ) : bag?.remainingGrams !== undefined && bag.remainingGrams < 20 ? (
                            <p className="mt-1 truncate text-[12px] text-warn">
                              Nur noch {num(bag.remainingGrams, 0)} g in der Bag
                            </p>
                          ) : (
                            <>
                              {/* `short` statt `label`: Die Tageszahl steht
                                  einen Zentimeter weiter links im Ring, und
                                  zweimal dieselbe Zahl in einer Zeile liest
                                  sich wie zwei verschiedene Angaben. */}
                              <p className="mt-1 truncate text-[12px] text-faint">
                                {fresh.short}
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
                    </SwipeReveal>

                    {/* Die Aktionen erscheinen erst nach der Vorauswahl —
                        sonst stünden sie dreifach je Bohne in der Liste und
                        keine davon wüsste, worauf sie sich bezieht. */}
                    {aktiv && (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {/* Ohne Methode: Der nächste Bildschirm empfiehlt
                            sie für genau diese Bohne. Das ist die
                            Coffee-Richtung — Bohne zuerst, Methode danach. */}
                        <Button
                          className="w-full"
                          onClick={() => navigate({ tab: 'brew', detail: bean.id })}
                        >
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

          {/* Ein Filter, der nichts übrig lässt, sieht ohne diesen Satz
              aus wie ein leeres Regal. */}
          {gefiltert && sichtbar.length === 0 && (
            <Section>
              <Card>
                <p className="text-[15px] leading-snug">Keine Bohne passt zu dieser Auswahl.</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 -ml-3"
                  onClick={() => {
                    setFilterFamilie(undefined)
                    setFilterMethode(undefined)
                  }}
                >
                  Filter zurücksetzen
                </Button>
              </Card>
            </Section>
          )}

          {!selected && sichtbar.length > 0 && (
            <p className="px-4 pt-4 text-[13px] leading-snug text-faint">
              Bohne antippen — dann kannst du sie brühen, ihr Profil ansehen
              oder ihre Protokolle durchgehen.
            </p>
          )}
        </>
      )}

      {editBean && <BeanSheet bean={editBean} onClose={() => setEditBean(undefined)} />}

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

/**
 * Das Profil einer Bohne — von der Grafik zur Tabelle.
 *
 * Die Reihenfolge ist die Aussage: Was man ohne Lesen erfasst, steht
 * oben, was man nachschlägt, unten.
 *
 *   1  Karte      wo sie wächst
 *   2  Legende    welche Herkunft welche Farbe hat
 *   3  Röstung    auf der Agtron-Skala, gemessen oder geschätzt
 *   4  Aufbereitung  mit dem Fruchtkontakt als Achse
 *   5  Fit        welche Methode passt, nach Eignung sortiert
 *   6  Fakten     Name, Röster, Höhe, Varietät — schmucklos
 *
 * Vorher lagen Röstgrad, Aufbereitung, Herkunft, Farm, Höhe, Varietät und
 * Koffein als sieben gleich große Kacheln in einem Raster. Sieben
 * gleichrangige Angaben sind keine Hierarchie, sondern eine Liste — und
 * die drei, die tatsächlich die Empfehlung bestimmen, verschwanden darin.
 * Jetzt bekommen die drei den Platz und die vier die Tabelle.
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
  const [showBag, setShowBag] = useState(false)

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

  const fakten: Fact[] = [
    { label: 'Name', value: bean.name },
    { label: 'Röster', value: bean.roaster ?? '' },
    {
      label: 'Röstung',
      value: bean.agtron
        ? `${ROAST_LABEL[bean.roastLevel]} · Agtron ${bean.agtron}`
        : ROAST_LABEL[bean.roastLevel],
    },
    { label: 'Aufbereitung', value: PROCESS_LABEL[bean.process] },
    {
      label: 'Höhe',
      value: bean.altitudeMasl ? `${bean.altitudeMasl[0]}–${bean.altitudeMasl[1]} m` : '',
    },
    { label: 'Varietät', value: bean.varieties?.join(', ') ?? '' },
    { label: 'Ernte', value: bean.harvestYear ? String(bean.harvestYear) : '' },
    { label: 'Dichte', value: bean.densityGL ? `${bean.densityGL} g/l` : '' },
    { label: 'Koffein', value: bean.isDecaf ? 'entkoffeiniert' : '' },
    { label: 'Preis', value: bean.pricePerKg ? `${num(bean.pricePerKg, 2)} €/kg` : '' },
    // Vorrat aus den Tüten, nicht aus der Bohne: Die Bohne ist die Sorte,
    // die Tüte ist das, was im Schrank steht.
    { label: 'Vorrat', value: vorrat > 0 ? `${num(vorrat, 0)} g` : '' },
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

      {/* 1 + 2 — Karte und Legende. Der einzige Teil dieses Bildschirms,
          den man ohne Lesen erfasst, steht deshalb zuerst. */}
      <Section title="Herkunft">
        <Card>
          <Suspense
            fallback={
              <div>
                <div className="aspect-[360/116] w-full rounded-xl border border-line bg-paper" />
                <div className="mt-2.5 h-[17px]" />
              </div>
            }
          >
            <OriginMap origins={bean.origins} />
          </Suspense>
        </Card>
      </Section>

      {/* 3 + 4 — die zwei Werte mit einer echten Skala. Zusammen in einem
          Abschnitt, weil sie zusammen gelesen werden: Ein helles Natural
          und ein dunkles Washed sind zwei verschiedene Kaffees. */}
      <Section title="Charakter">
        <Card>
          <RoastScale bean={bean} />
        </Card>
        <Card className="mt-2">
          <ProcessMark process={bean.process} />
        </Card>
      </Section>

      {/* 5 — Fit.
          Zwei Achsen, und das ist der ganze Grund für die Legende oben
          in der Karte: Die Reihenfolge sagt, wo die Bohne glänzt
          (Herkunftsprofil), das Wort sagt, wie leicht die Methode zu
          treffen ist (Eignung). Ohne diese Erklärung stand hier eine
          Liste, in der die French Press unter dem Espresso saß und
          trotzdem „gut geeignet" hieß — sichtbar widersprüchlich in
          einem einzigen Blick. */}
      <Section title="Fit" action={<span className="text-[12px] text-faint">nach Empfehlung</span>}>
        <Card>
          <p className="mb-3 text-[11px] leading-snug text-faint">
            Balken: wo die Bohne ihre Stärken ausspielt. Wort: wie leicht die Methode zu treffen
            ist.
          </p>
          <div className="space-y-2.5">
            {fit.map(({ method: m, suitability: f, rank, viable }, i) => (
              <div key={m} className="flex items-center gap-3">
                <span
                  className={`w-24 shrink-0 text-[14px] ${i === 0 ? 'font-semibold' : ''} ${
                    imHaus.includes(m) ? '' : 'text-mute'
                  }`}
                >
                  {METHOD_LABEL[m]}
                  {!imHaus.includes(m) && (
                    <span className="block text-[10px] leading-tight text-faint">nicht im Haus</span>
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
                  className={`min-w-0 flex-1 text-[13px] ${
                    f.isWarning || !viable ? 'text-warn' : i === 0 ? 'text-ink' : 'text-mute'
                  }`}
                >
                  {SUITABILITY_LABEL[f.level]}
                </span>
              </div>
            ))}
          </div>
          {/* Die Begründung gehört zur obersten Zeile — und die ist jetzt
              die empfohlene, nicht mehr die erste in der Anzeigereihenfolge. */}
          <p className="mt-3 border-t border-line pt-3 text-[13px] leading-relaxed text-mute">
            {fit[0]!.suitability.reason}
          </p>
        </Card>
      </Section>

      {/* 6 — die trockenen Fakten. Schmucklos ist hier die Absicht: Sie
          konkurrieren nicht mit den Grafiken darüber. */}
      <Section title="Fakten">
        <Card>
          <FactTable facts={fakten} />
        </Card>
      </Section>

      {/* Welche Methode das Fenster bestimmt, gehört hierhin: Die Fit-Liste
          darüber zeigt fünf Methoden, und das Ruhefenster gilt nur für
          eine davon (kb/05 §4). Ohne diesen Zusatz stünde eine Tageszahl
          über einer Liste, die fünf verschiedene richtig macht. */}
      <Section
        title="Bags"
        action={
          <div className="flex items-baseline gap-2">
            {bags.length > 0 && (
              <span className="text-[12px] text-faint">
                Fenster für {METHOD_SHORT[freshnessMethod(bean)]}
              </span>
            )}
            <Button size="sm" variant="ghost" onClick={() => setShowBag(true)}>
              + Bag
            </Button>
          </div>
        }
      >
        {bags.length === 0 ? (
          <Card>
            <p className="text-[14px] text-mute">
              Noch keine Bag. Ohne Röstdatum kann ich die Frische nicht mitführen.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {bags.map((bag) => {
              // Dieselbe Funktion wie in der Übersicht. Der Kommentar hier
              // behauptete das schon vorher — die Rechnung war trotzdem
              // eine andere, sobald eine Bohne `preferredMethod` gesetzt
              // hätte.
              const f = freshnessFor(bean, bag)
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
    </Screen>
  )
}

// ── Formulare ─────────────────────────────────────────────────────────

/**
 * Dasselbe Formular fürs Anlegen und fürs Ändern.
 *
 * Zwei Formulare für dieselben Felder wären zwei Orte, an denen eine neue
 * Angabe nachgetragen werden muss — und einer davon wird vergessen. Nur
 * die erste Tüte fehlt beim Bearbeiten: Röstdatum und Menge gehören zur
 * Tüte, nicht zur Bohne, und werden unten im Profil eigens verwaltet.
 */
function BeanSheet({
  bean,
  onClose,
  onCreated,
}: {
  /** Gesetzt: bearbeiten. Fehlt: anlegen. */
  bean?: Bean
  onClose: () => void
  onCreated?: (id: string) => void
}) {
  const addBean = useStore((s) => s.addBean)
  const addBag = useStore((s) => s.addBag)
  const updateBean = useStore((s) => s.updateBean)
  const bearbeiten = !!bean

  // Rohwert abonnieren, Vorgabe DANACH setzen: `?? []` im Selektor gibt
  // bei jedem Rendern eine neue Referenz zurück, und der Store vergleicht
  // per Referenz — das ist eine Endlosschleife, keine leere Liste.
  const extraOrigins = useStore((st) => st.settings.extraOrigins)
  const setSettings = useStore((st) => st.setSettings)
  /** Reihenfolge: Exporteure nach Menge, dann eigene Profile, dann Nachgetragenes. */
  const laenderliste = useMemo(() => originOptions(extraOrigins ?? []), [extraOrigins])

  const [name, setName] = useState(bean?.name ?? '')
  const [roaster, setRoaster] = useState(bean?.roaster ?? '')
  const [country, setCountry] = useState(() => {
    if (!bean) return laenderliste[0] ?? BLEND
    if (bean.origins.some((o) => o.country === BLEND)) return BLEND
    return bean.origins[0]?.country ?? (laenderliste[0] ?? BLEND)
  })
  /** Beim Blend: die genannten Bestandteile. Leer heißt „irgendwo im Gürtel". */
  const [blendLaender, setBlendLaender] = useState<string[]>(
    () => bean?.origins.filter((o) => o.country !== BLEND).map((o) => o.country) ?? [],
  )
  const [roast, setRoast] = useState<RoastLevel>(bean?.roastLevel ?? 'medium')
  /**
   * Der gemessene Röstgrad — optional und mit Absicht umständlich.
   *
   * Ohne dieses Feld war die Unterscheidung zwischen „gemessen" und „laut
   * Etikett" im Profil eine Sackgasse: Die App schrieb „ein gemessener
   * Agtron-Wert wäre genauer" und bot keinen Weg, einen einzutragen.
   *
   * `agtronTouched` ist derselbe Schutz wie bei der gelaufenen Zeit im
   * Brühbildschirm: Der Startwert ist die Mitte des Bandes, das die
   * Etikettenangabe meint. Wer ihn stehen lässt, hat nichts gemessen —
   * gespeichert wird er dann auch nicht. Sonst zeichnete die Skala einen
   * präzisen Zeiger auf eine Schätzung.
   */
  const [agtron, setAgtron] = useState<number | null>(bean?.agtron ?? null)
  const [agtronTouched, setAgtronTouched] = useState(false)
  const [process, setProcess] = useState<Process>(bean?.process ?? 'washed')
  // Kein fester Vorgabewert: 1500 m wäre eine erfundene Angabe, die jede
  // Bohne bekäme — und die Herkunftsableitung der Engine käme nie zum Zug.
  // Beim Bearbeiten die Mitte der gespeicherten Spanne, denn genau die
  // hat das Formular beim Anlegen daraus gemacht.
  const [altitude, setAltitude] = useState<number | null>(
    bean?.altitudeMasl ? Math.round((bean.altitudeMasl[0] + bean.altitudeMasl[1]) / 2) : null,
  )
  const [altitudeTouched, setAltitudeTouched] = useState(false)
  const [notes, setNotes] = useState(bean?.flavorNotes?.join(', ') ?? '')
  const [decaf, setDecaf] = useState(!!bean?.isDecaf)
  const [roastDate, setRoastDate] = useState(new Date().toISOString().slice(0, 10))
  const [grams, setGrams] = useState(250)

  const save = () => {
    if (!name.trim()) return
    // Ein Blend führt seine Bestandteile als weitere Herkünfte. Der
    // Sammelwert bleibt an erster Stelle stehen: Er unterscheidet „Blend
    // aus Brasilien und Äthiopien" von „Bohne aus Brasilien".
    const origins =
      country === BLEND
        ? [{ country: BLEND }, ...blendLaender.map((c) => ({ country: c }))]
        : [{ country }]

    const felder = {
      name: name.trim(),
      roaster: roaster.trim() || undefined,
      origins,
      process,
      roastLevel: roast,
      // Nur ein bewegter Wert ist eine Messung (siehe agtronTouched).
      agtron: agtron !== null && (agtronTouched || bean?.agtron !== undefined) ? agtron : undefined,
      altitudeMasl: (altitude !== null ? [altitude - 100, altitude + 100] : undefined) as
        | [number, number]
        | undefined,
      flavorNotes: notes ? notes.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      isDecaf: decaf || undefined,
    }

    if (bean) {
      updateBean(bean.id, felder)
      onClose()
      return
    }

    const id = addBean(felder)
    addBag({ beanId: id, roastDate, purchasedGrams: grams, remainingGrams: grams, storage: 'ambient' })
    if (onCreated) onCreated(id)
    else onClose()
  }

  return (
    <Sheet
      title={bearbeiten ? 'Bohne bearbeiten' : 'Neue Bohne'}
      onClose={onClose}
      footer={
        <Button className="w-full" size="lg" disabled={!name.trim()} onClick={save}>
          {bearbeiten ? 'Änderungen speichern' : 'Bohne anlegen'}
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
          <OriginPicker
            value={country}
            onChange={setCountry}
            options={laenderliste}
            withBlend
            onAdd={(c) => {
              setSettings({ extraOrigins: [...(extraOrigins ?? []), c] })
              setCountry(c)
            }}
          />
        </Field>

        {/* Erst beim Blend, weil die Frage erst dann eine ist. Leer lassen
            ist erlaubt: Bei vielen Supermarktmischungen steht die Herkunft
            nicht auf der Tüte. */}
        {country === BLEND && (
          <Field
            label="Bestandteile"
            hint={
              blendLaender.length
                ? 'Die Karte zeigt genau diese Länder.'
                : 'Optional. Ohne Angabe zeigt die Karte den ganzen Kaffeegürtel.'
            }
          >
            <OriginMulti
              value={blendLaender}
              onChange={setBlendLaender}
              options={laenderliste}
              onAdd={(c) => {
                setSettings({ extraOrigins: [...(extraOrigins ?? []), c] })
                setBlendLaender((x) => [...x, c])
              }}
            />
          </Field>
        )}
        <Field label="Roast" hint="Die wichtigste Angabe für den Startpunkt">
          <Select
            value={roast}
            onChange={setRoast}
            options={(Object.keys(ROAST_LABEL) as RoastLevel[]).map((r) => ({ value: r, label: ROAST_LABEL[r] }))}
          />
        </Field>
        {/* Direkt unter Roast, weil er dieselbe Frage genauer beantwortet.
            Eingeklappt, weil ihn die wenigsten Bags nennen — ein leeres
            Zahlenfeld im Weg wäre für die meisten Bohnen nur Ballast. */}
        <Field
          label="Agtron"
          hint={
            agtron === null
              ? 'Gemessene Röstfarbe, 25–95. Steht nur auf wenigen Bags — hat aber Vorrang vor der Bezeichnung, weil die zwischen Röstern um bis zu zwei Stufen streut.'
              : agtronTouched || bean?.agtron !== undefined
                ? agtronBand(agtron).level === roast
                  // Gleiches Band: „überstimmt" wäre hier falsch, er
                  // bestätigt. Der Gewinn ist trotzdem echt — aus einer
                  // Spanne von zwei Bändern wird ein Punkt.
                  ? `Gemessen: ${agtronBand(agtron).label}. Deckt sich mit „${ROAST_LABEL[roast]}" und macht daraus einen Punkt statt einer Spanne.`
                  : `Gemessen: ${agtronBand(agtron).label} — das überstimmt die Bezeichnung „${ROAST_LABEL[roast]}" (kb/05 §2.1).`
                : 'Das ist noch die Mitte dessen, was die Bezeichnung meint — keine Messung. Verschieb den Wert, sonst speichere ich ihn nicht.'
          }
        >
          {agtron === null ? (
            <Button
              variant="ghost"
              onClick={() => {
                const [lo, hi] = agtronSpan(roast)
                setAgtron(Math.round((lo + hi) / 2))
              }}
              className="w-full"
            >
              Agtron-Wert eintragen
            </Button>
          ) : (
            <Stepper
              value={agtron}
              onChange={(v) => {
                setAgtron(v)
                setAgtronTouched(true)
              }}
              step={1}
              min={AGTRON_RANGE[0]}
              max={AGTRON_RANGE[1]}
              label="Agtron"
            />
          )}
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

        {/* Nur beim Anlegen: Röstdatum und Menge gehören zur Tüte, nicht
            zur Bohne. Beim Bearbeiten stünde hier ein Feld, das eine
            bestehende Tüte still überschreiben würde. */}
        {!bearbeiten && (
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
        )}
      </div>
    </Sheet>
  )
}

/**
 * Nachtragen eines Landes, das nicht in der Liste steht.
 *
 * Geprüft wird gegen die Länderliste aus Natural Earth — dieselbe Quelle
 * wie die Karte. Damit kann es keine gespeicherte Herkunft geben, die
 * sich nicht einzeichnen lässt, und „Kolumbioen" landet nicht in den
 * Daten. Deutsch oder englisch ist beides recht; gespeichert wird die
 * deutsche Schreibweise.
 */
function CountryAdd({ onAdd }: { onAdd: (name: string) => void }) {
  const [offen, setOffen] = useState(false)
  const [eingabe, setEingabe] = useState('')
  const treffer = findCountry(eingabe)
  const leer = !eingabe.trim()

  if (!offen) {
    return (
      <Button variant="ghost" size="sm" className="-ml-3" onClick={() => setOffen(true)}>
        Anderes Land nachtragen →
      </Button>
    )
  }

  return (
    <div className="mt-2 rounded-xl border border-line bg-raised p-3">
      <TextInput value={eingabe} onChange={setEingabe} placeholder="z. B. Bolivien" />
      {!leer && !treffer && (
        <p className="mt-2 text-[13px] leading-snug text-bad">
          „{eingabe.trim()}" ist kein Land, das ich kenne. Schreib es aus — deutsch oder
          englisch, etwa „Elfenbeinküste" oder „Ivory Coast".
        </p>
      )}
      {treffer && treffer.de.toLowerCase() !== eingabe.trim().toLowerCase() && (
        <p className="mt-2 text-[13px] text-mute">Wird gespeichert als „{treffer.de}".</p>
      )}
      {treffer && !treffer.belt && (
        <p className="mt-2 text-[13px] leading-snug text-warn">
          {treffer.de} liegt außerhalb des Kaffeegürtels. Kann sein, dass es stimmt — häufig
          ist es aber das Land des Rösters und nicht das der Bohne.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={!treffer}
          onClick={() => {
            if (!treffer) return
            onAdd(treffer.de)
            setEingabe('')
            setOffen(false)
          }}
        >
          Übernehmen
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setEingabe(''); setOffen(false) }}>
          Abbrechen
        </Button>
      </div>
    </div>
  )
}

/** Einzelauswahl der Herkunft, mit Blend an erster Stelle. */
function OriginPicker({
  value,
  onChange,
  options,
  withBlend,
  onAdd,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  withBlend?: boolean
  onAdd: (name: string) => void
}) {
  return (
    <>
      <Select
        value={value}
        onChange={onChange}
        options={[
          ...(withBlend ? [{ value: BLEND, label: 'Blend (mehrere Herkünfte)' }] : []),
          ...options.map((n) => ({ value: n, label: n })),
        ]}
      />
      <div className="mt-1">
        <CountryAdd onAdd={onAdd} />
      </div>
    </>
  )
}

/**
 * Mehrfachauswahl für die Bestandteile eines Blends.
 *
 * Chips und nicht eine Liste mit Häkchen, weil die App Mehrfachauswahl
 * überall so löst (Fehltöne, Charakter) — und weil man die getroffene
 * Auswahl hier auf einen Blick sehen will.
 */
function OriginMulti({
  value,
  onChange,
  options,
  onAdd,
}: {
  value: string[]
  onChange: (v: string[]) => void
  options: string[]
  onAdd: (name: string) => void
}) {
  const umschalten = (n: string) =>
    onChange(value.includes(n) ? value.filter((x) => x !== n) : [...value, n])

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {options.map((n) => (
          <Chip key={n} label={n} active={value.includes(n)} onClick={() => umschalten(n)} />
        ))}
      </div>
      <div className="mt-1">
        <CountryAdd onAdd={onAdd} />
      </div>
    </>
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

/** Der Anzeigename einer Aufbereitungsfamilie, für den aktiven Filterchip. */
function familienName(id: string): string {
  return PROCESS_FAMILIES.find((f) => f.id === id)?.label ?? id
}
