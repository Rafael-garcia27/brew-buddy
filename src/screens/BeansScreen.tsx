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
import { useMemo, useState } from 'react'
import type { Route } from '@/router'
import { useStore } from '@/store'
import type { Bag, Bean, BrewMethod } from '@domain'
import type { BeanTrash } from '@/domain'
import type { Freshness } from '@/engine/freshness'
import { restWindowFor } from '@/engine/freshness'
import {
  suitability,
  bestMethodFor,
  freshnessFor,
  GEEIGNET_AB,
} from '@/engine/suitability'
import {
  BLEND,
  processFamily,
  PROCESS_FAMILIES,
  } from '@/kb'

import { METHODS, ROAST_LABEL, PROCESS_LABEL, METHOD_LABEL, METHOD_SHORT } from '@/labels'
import {
  Screen, Header, Section, Card, Button, Empty, Chip, GearButton, LogButton, FilterRow, num,
} from '@/components/ui'
import { BackupBanner, SetupNudge } from '@/components/system'
import SwipeReveal from '@/components/SwipeReveal'
import { FactTable, BeanRing, type Fact } from '@/components/beanviz'

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
import { BeanSheet } from './BeanForms'

export default function BeansScreen({ route, navigate, onDeleted }: Props) {
  const beans = useStore((s) => s.beans)
  const bags = useStore((s) => s.bags)
  const brews = useStore((s) => s.brews)
  const [showNew, setShowNew] = useState(route.detail === 'new')
  /** Gesetzt: Bearbeiten-Blatt für genau diese Bohne. */
  const [editBean, setEditBean] = useState<Bean | undefined>()
  const deleteBean = useStore((st) => st.deleteBean)
  /**
   * Die aufgeklappte Bohne — gesetzt durch Tippen, nie im Voraus.
   *
   * Vorher stand hier `route.id ?? lastBeanId`: Das Regal öffnete sich
   * mit der zuletzt gebrühten Bohne aufgeklappt, und alle anderen lagen
   * bei 38 % Deckkraft dahinter. Ein Regal, das beim Aufmachen schon
   * entschieden hat, ist kein Regal — man kommt hierher, um zu schauen.
   *
   * `route.id` bleibt: Wer aus dem Brühen zurückkommt, soll seine
   * Auswahl wiederfinden statt bei null anzufangen. Der Unterschied ist,
   * dass sie dann aus einer Handlung stammt und nicht aus einer Vermutung.
   */
  const [selected, setSelected] = useState<string | undefined>(route.id)
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
        title="Regal"
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
                <span className="text-xs text-faint">
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
            {/*
              Ein Regal, nicht neun Kisten.

              Vorher war jede Bohne eine eigene Karte mit eigenem Rahmen.
              Das entsteht, wenn man jeden Block für sich löst: `Card` ist
              die Standardantwort der App auf „das gehört zusammen" — und
              in einer Liste ist das die falsche Antwort. Ein Rahmen sagt
              „das hier ist abgetrennt von seinen Nachbarn". Neun gleiche
              Rahmen sagen das neunmal und damit gar nichts; sie werden
              Textur, und das Auge zählt Kapseln, statt Namen zu lesen.

              Jetzt trägt die Liste eine Fläche und einen Rahmen. Getrennt
              wird durch Rhythmus und eine Haarlinie, die dort beginnt, wo
              der Text beginnt — sie trennt Inhalt, nicht Behälter. Der
              Rahmen bleibt der gewählten Bohne vorbehalten, und weil er
              dann das Einzige ist, bedeutet er wieder etwas.
            */}
            <div className="overflow-hidden rounded-card border border-line bg-card">
              {ranked.map(({ bean, fresh, count, best, bag }) => {
                const aktiv = bean.id === selected
                /**
                 * Die gewählte Karte tritt vor, die übrigen zurück.
                 *
                 * Vorher hingen die drei Aktionen als eigene Knopfreihe
                 * UNTER der Karte — sie gehörten sichtbar zu nichts, und
                 * bei vier Bohnen stand die Reihe irgendwo mitten in der
                 * Liste. Jetzt sitzen sie in der Karte, die Karte wächst,
                 * und alles andere verblasst: Damit ist ohne ein einziges
                 * Wort klar, worauf sich „Brühen" bezieht.
                 */
                const zurueckgesetzt = !!selected && !aktiv
                return (
                  <div
                    key={bean.id}
                    /*
                      Die Haarlinie sitzt als Pseudoelement auf der Zeile,
                      eingerückt bis zum Textanfang: Eine durchgezogene
                      Linie schnitte den Frischering mittendurch und machte
                      aus der Trennung wieder eine Kiste. Die erste Zeile
                      bekommt keine — dort trennt schon der Rahmen.

                      Kein `scale` mehr: In einer gemeinsamen Fläche sähe
                      eine schrumpfende Zeile aus wie ein Fehler. Das
                      Zurücktreten macht die Deckkraft allein.
                    */
                    className="relative transition-opacity duration-200 before:absolute before:top-0 before:right-4 before:left-[68px] before:h-px before:bg-line first:before:hidden"
                    style={{ opacity: zurueckgesetzt ? 0.38 : 1 }}
                  >
                    {/* Wischen legt Bearbeiten frei, weiter ziehen deutet
                        Löschen an, ganz hinausschieben löscht. Die
                        Aktionsflächen sind so hoch wie die Zeile —
                        deshalb sitzt die Geste hier und nicht im Profil,
                        wo sie über eine ganze Karte gehen müsste. */}
                    <SwipeReveal
                      /* Die Ecken rundet das Regal, nicht die Zeile. */
                      className=""
                      actions={[
                        { label: 'Edit', onClick: () => setEditBean(bean) },
                        { label: 'Löschen', tone: 'bad', onClick: () => loeschen(bean) },
                      ]}
                      onSwipeAway={() => loeschen(bean)}
                      swipeAwayLabel="Loslassen zum Löschen"
                    >
                      <BohnenKarte
                        bean={bean}
                        fresh={fresh}
                        bag={bag}
                        count={count}
                        best={best.method}
                        aktiv={aktiv}
                        onToggle={() => waehle(aktiv ? undefined : bean.id)}
                        onBruehen={() => navigate({ tab: 'brew', detail: bean.id })}
                        onProfil={() => navigate({ tab: 'profile', id: bean.id })}
                        onLog={() => navigate({ tab: 'log', id: bean.id })}
                      />
                    </SwipeReveal>
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
                <p className="text-lg leading-snug">Keine Bohne passt zu dieser Auswahl.</p>
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

/**
 * Eine Bohne im Regal — geschlossen eine Zeile, gewählt eine Karte.
 *
 * Der Unterschied ist nicht nur Größe. Geschlossen beantwortet sie „ist
 * das die richtige Bohne?" (Name, Röstung, Frische, beste Methode).
 * Gewählt beantwortet sie „und was mache ich jetzt damit?" — dafür
 * kommen ein paar Angaben aus dem Profil dazu und die drei Wege, die von
 * hier wegführen.
 *
 * Warum die Aktionen IN der Karte liegen: Als eigene Knopfreihe darunter
 * gehörten sie sichtbar zu nichts. „Brühen" mitten in einer Liste aus
 * vier Bohnen sagt nicht, welche gemeint ist; in der Karte sagt es sich
 * von selbst.
 *
 * Die Karte ist deshalb im gewählten Zustand kein Knopf mehr, sondern
 * ein Behälter: Knöpfe in Knöpfen sind ungültiges HTML, und der Browser
 * baut die Verschachtelung stillschweigend auseinander. Das Aufklappen
 * übernimmt dann die Kopfzeile.
 */
function BohnenKarte({
  bean,
  fresh,
  bag,
  count,
  best,
  aktiv,
  onToggle,
  onBruehen,
  onProfil,
  onLog,
}: {
  bean: Bean
  fresh: Freshness
  bag?: Bag
  count: number
  best: BrewMethod
  aktiv: boolean
  onToggle: () => void
  onBruehen: () => void
  onProfil: () => void
  onLog: () => void
}) {
  /**
   * Ab welchem Tag die Bohne brühbereit ist.
   *
   * `restWindowFor` kennt das Ruhefenster je Methode; gezeigt wird es
   * nur, solange es noch nicht offen ist — danach wäre es eine Zahl über
   * die Vergangenheit.
   */
  const abTag = fresh.state === 'too-fresh' ? restWindowFor(bean, best).min : null

  const kopf = (
    <div className="flex items-center gap-3">
      {/* Drei Angaben statt einer: Ring = Frische, Füllung = Röstgrad,
          Zahl = Tage. Die Zeile bleibt eine Zeile — eine Liste aus lauter
          Bohnenschaltflächen ohne Namen wäre ein Ratespiel
          (docs/05 §4.5). */}
      <BeanRing
        bean={bean}
        score={fresh.score}
        label={fresh.days !== null ? String(fresh.days) : '?'}
        size={aktiv ? 48 : 40}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`truncate leading-tight font-semibold ${
            aktiv ? 'text-2xl' : 'text-xl'
          }`}
        >
          {bean.name}
        </p>
        <p className="mt-0.5 truncate text-sm text-mute">
          {bean.roaster ? `${bean.roaster} · ` : ''}
          {ROAST_LABEL[bean.roastLevel]} · {PROCESS_LABEL[bean.process]}
        </p>
        {/* Geschlossen steht hier nur die Empfehlung.
            Die Liste beantwortet eine Frage — „welche Bohne?" —, und dafür
            reichen Name, Röster, Röstung, Aufbereitung und wofür sie
            taugt. Frische und Zähler beantworten schon die nächste Frage
            und stehen deshalb erst in der aufgeklappten Karte; als
            Reserve trägt der Ring die Frische ohnehin sichtbar mit. */}
        <p className="mt-1 truncate text-xs text-crema-ink">
          Am besten als {METHOD_LABEL[best]}
        </p>
        {/* Aufgeklappt kommt die Lage dazu, und zwar die dringendere
            Aussage zuerst: „überaltert" neben einem Zähler würde sich
            für den Leser widersprechen. */}
        {aktiv &&
          (fresh.state === 'stale' ? (
            <p className="mt-1 truncate text-xs text-bad">
              {fresh.short} — die Bag gibt nichts mehr her
            </p>
          ) : bag?.remainingGrams !== undefined && bag.remainingGrams < 20 ? (
            <p className="mt-1 truncate text-xs text-warn">
              Nur noch {num(bag.remainingGrams, 0)} g in der Bag
            </p>
          ) : (
            /* `short` statt `label`: Die Tageszahl steht einen Zentimeter
               weiter links im Ring, und zweimal dieselbe Zahl in einer
               Zeile liest sich wie zwei verschiedene Angaben. Bei „noch zu
               frisch" gehört der Tag dazu, ab dem es losgeht — sonst steht
               dort eine Absage ohne Termin. */
            <p className="mt-1 truncate text-xs text-faint">
              {fresh.short}
              {fresh.state === 'too-fresh' && abTag !== null && ` · ab Tag ${abTag}`}
              {count > 0 && ` · ${count}× gebrüht`}
            </p>
          ))}
      </div>
      <span className={aktiv ? 'text-crema-ink' : 'text-faint'}>{aktiv ? '✕' : '›'}</span>
    </div>
  )

  if (!aktiv) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="w-full bg-card px-4 py-3 text-left active:bg-raised"
      >
        {kopf}
      </button>
    )
  }

  /**
   * Die Vorschau aus dem Profil.
   *
   * Vier Angaben, keine zwanzig: Was beim Auswählen hilft, ist Herkunft,
   * Höhe, Varietät und was der Röster geschmeckt hat. Röstgrad und
   * Aufbereitung stehen schon in der Kopfzeile, Frische im Ring. Für
   * alles Weitere gibt es das Profil, und dorthin führt ein Knopf
   * darunter.
   */
  const vorschau: Fact[] = [
    {
      label: 'Herkunft',
      value: bean.origins.some((o) => o.country === BLEND)
        ? bean.origins.filter((o) => o.country !== BLEND).length
          ? `Blend aus ${bean.origins.filter((o) => o.country !== BLEND).map((o) => o.country).join(', ')}`
          : 'Blend'
        : bean.origins.map((o) => [o.country, o.region].filter(Boolean).join(' · ')).join(', ') ||
          '—',
    },
    {
      label: 'Höhe',
      value: bean.altitudeMasl ? `${bean.altitudeMasl[0]}–${bean.altitudeMasl[1]} m` : '',
    },
    { label: 'Varietät', value: bean.varieties?.join(', ') ?? '' },
    { label: 'Notizen', value: bean.flavorNotes?.join(', ') ?? '' },
    {
      label: 'Vorrat',
      value:
        bag?.remainingGrams !== undefined && !bag.depleted ? `${num(bag.remainingGrams, 0)} g` : '',
    },
  ].filter((f) => f.value)

  return (
    /*
      Die gewählte Bohne ist die einzige Fläche im Regal, die sich vom
      Rest abhebt — deshalb reicht ein Flächenwechsel, und es braucht
      keinen zweiten Rahmen in einem Rahmen. `raised` gibt es in allen
      drei Themen und hebt sich in jedem sichtbar von `card` ab.
    */
    <div className="bg-raised px-4 py-4">
      {/* Die Kopfzeile klappt wieder zu — dieselbe Fläche, die sie
          aufgeklappt hat. */}
      <button type="button" onClick={onToggle} className="w-full text-left">
        {kopf}
      </button>

      {vorschau.length > 0 && (
        <div className="mt-3">
          <FactTable facts={vorschau} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        {/* Ohne Methode: Der nächste Bildschirm empfiehlt sie für genau
            diese Bohne. Das ist die Coffee-Richtung — Bohne zuerst,
            Methode danach. */}
        <Button className="w-full" onClick={onBruehen}>
          Brühen
        </Button>
        <Button variant="secondary" className="w-full" onClick={onProfil}>
          Profil
        </Button>
        <Button variant="secondary" className="w-full" onClick={onLog}>
          Log
        </Button>
      </div>
    </div>
  )
}

/** Der Anzeigename einer Aufbereitungsfamilie, für den aktiven Filterchip. */
function familienName(id: string): string {
  return PROCESS_FAMILIES.find((f) => f.id === id)?.label ?? id
}
