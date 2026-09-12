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

import { METHODS, ROAST_LABEL, PROCESS_LABEL, METHOD_LABEL, METHOD_SHORT } from '@/labels'
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
import SwipeReveal from '@/components/SwipeReveal'
import { RoastScale, ProcessMark, FactTable, type Fact } from '@/components/beanviz'


import { BeanSheet, BagSheet } from './BeanForms'

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
                /**
                 * Leeren und Löschen sind zwei verschiedene Dinge.
                 *
                 * „Leer" ist eine Tatsache über eine Tüte, die es gab —
                 * ihre Protokolle bleiben und zählen weiter fürs Lernen.
                 * „Löschen" ist für die Tüte, die es nie gab: falsch
                 * angelegt, Datum vertippt. Sie nimmt ihre Protokolle mit,
                 * und deshalb fragt sie nach, sobald welche daran hängen.
                 */
                <SwipeReveal
                  key={bag.id}
                  actions={[{ label: 'Löschen', tone: 'bad', onClick: () => bagLoeschen(bag) }]}
                  onSwipeAway={() => bagLoeschen(bag)}
                  swipeAwayLabel="Loslassen zum Löschen"
                >
                  <Card>
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
                </SwipeReveal>
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
