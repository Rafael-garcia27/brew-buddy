/**
 * Der Kernloop.
 *
 * Briefing G10: Von „Start“ bis „bewertet“ höchstens drei Pflichtinteraktionen.
 * Alles andere ist vorbelegt und optional.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Route } from '@/router'
import { useStore, selectActiveWater, grinderFor } from '@/store'
import type {
  Bean, BrewMethod, Defect, Character, FlowState, PuckState, BloomBehavior, SpeedFeel,
  BrewActual, Observation, Tasting,
} from '@domain'
import type { EngineContext } from '@/domain'
import { startingPoint } from '@/engine/starting'
import { diagnose, type Diagnosis } from '@/engine/diagnose'
import { checkRun, type RunCheck } from '@/engine/runcheck'
import { fmtSpanne } from '@/engine/text'
import { assessFreshness } from '@/engine/freshness'
import GrinderDial from '@/components/GrinderDial'
import SageGrindDial from '@/components/SageGrindDial'
import { consistencyWarning, brewsUntilPersonal } from '@/engine/learn'
import { suitability, SUITABILITY_LABEL, bestMethodFor } from '@/engine/suitability'
import { ratioTone, ratioLabel, RATIO_ANCHOR } from '@/engine/ratio'
import { grindPlausibility, formatSetting, vendorRange } from '@/engine/grinder'
import { MethodIcon, BrewButton } from '@/components/methodicons'
import {
  GRINDER_CATALOG,
  getMethod,
  grindersForMethod,
  targetTimeRange,
  beverageYield,
  isImmersion,
  tempAdjustable,
  tempRange,
} from '@/kb'
import { METHODS, METHOD_LABEL, METHOD_SHORT, DEFECT_LABEL, COMMON_DEFECTS, CHARACTER_LABEL, COMMON_CHARACTERS, FLOW_LABEL, FLOW_CHOICES, PUCK_LABEL, PUCK_CHOICES, BLOOM_LABEL, BLOOM_CHOICES, SPEED_CHOICES, speedLabel, speedQuestion } from '@/labels'
import {
  Screen, Header, Section, Card, Button, Chip, SegmentedControl, Stepper, Field, Sheet,
  InfoDot, Triad, MetaRow, fmtClock, num
} from '@/components/ui'

/**
 * Der Kernloop ist zweistufig geworden.
 *
 * `check` liegt zwischen Erfassen und Verkosten: Was die Uhr sagt, ist ohne
 * jeden Geschmackseindruck auswertbar (kb/15 §3.1 trennt Phase C und D
 * genau so). Erst danach kommt das Tasting — und die Ergebnisseite zeigt
 * beide Stufen getrennt, damit erkennbar bleibt, woher die Empfehlung kommt.
 *
 * Die Bohnenauswahl ist keine Phase mehr: Sie steht in Beans, und dieser
 * Screen wird immer für eine bereits gewählte Bohne geöffnet. Die Methode
 * dagegen bleibt hier — sie ändert den Vorschlag, und diese Wirkung soll
 * man sehen, während man sie umstellt.
 */
type Phase = 'proposal' | 'record' | 'check' | 'taste' | 'result'

interface Props {
  /** Beides steht in der Route und wird von App aufgelöst. */
  method: BrewMethod
  bean: Bean
  route: Route
  navigate: (r: Route, replace?: boolean) => void
  back: () => void
}

export default function BrewScreen({ method, bean, navigate, back }: Props) {
  const s = useStore()
  const [phase, setPhase] = useState<Phase>('proposal')

  /**
   * Methode wechseln heißt navigieren, nicht Zustand setzen.
   *
   * Sie steht in der Adresse (`#/brew/<methode>/<bohne>`); ein stiller
   * Zustandswechsel würde die Adresse belügen und beim Zurückgehen die
   * falsche Methode zeigen. Ersetzen statt anhängen: Ein Wechsel ist kein
   * Schritt, den man mit der Zurück-Geste einzeln rückgängig macht.
   */
  const setMethod = (m: BrewMethod) => navigate({ tab: 'brew', id: m, detail: bean.id }, true)
  // Espresso darf eine eigene Mühle haben — bei einem Siebträger mit
  // verbautem Mahlwerk ist genau das der Normalfall.
  const grinders = useStore((st) => st.grinders)
  const settings = useStore((st) => st.settings)
  const setSettings = useStore((st) => st.setSettings)
  /** Espresso merkt sich seine eigene Mühle, alle anderen die gemeinsame. */
  const setGrinderId = (m: BrewMethod, id: string) =>
    setSettings(m === 'espresso' ? { espressoGrinderId: id } : { activeGrinderId: id })
  const grinder = useMemo(
    () => grinderFor({ grinders, settings }, method),
    [grinders, settings, method],
  )
  const water = useStore(selectActiveWater)

  // Abgeleitete Listen NIE im Selektor bilden — sonst neue Referenz pro
  // Render und damit eine Endlosschleife. Rohdaten abonnieren, hier filtern.
  const bag = useMemo(
    () =>
      bean
        ? s.bags
            .filter((b) => b.beanId === bean.id && !b.depleted)
            .sort((a, b) => (b.roastDate ?? '').localeCompare(a.roastDate ?? ''))[0]
        : undefined,
    [s.bags, bean],
  )
  const beanHistory = useMemo(
    () =>
      bean
        ? s.brews
            .filter((b) => b.beanId === bean.id && b.method === method)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [s.brews, bean, method],
  )
  const methodHistory = useMemo(
    () => s.brews.filter((b) => b.method === method).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [s.brews, method],
  )

  const ctx: EngineContext | null = useMemo(() => {
    if (!bean) return null
    return {
      bean, bag, method, grinder, water,
      settings: s.settings, learned: s.learned,
      beanHistory, methodHistory, allBeans: s.beans, today: new Date(),
    }
  }, [bean, bag, method, grinder, water, s.settings, s.learned, beanHistory, methodHistory, s.beans])

  const sp = useMemo(() => (ctx ? startingPoint(ctx) : null), [ctx])

  // Beide Ableitungen MÜSSEN vor den frühen Returns stehen: React zählt
  // Hooks nach Position, ein bedingt aufgerufener Hook bricht den Wechsel
  // zwischen den Phasen.
  const grinderChoices = useMemo(() => {
    const erlaubt = grindersForMethod(method)
    return grinders.filter((g) => erlaubt.some((e) => e.id === g.catalogId || e.name === g.name))
  }, [grinders, method])


  // Ist-Werte
  const [doseG, setDoseG] = useState(18)
  const [yieldG, setYieldG] = useState(36)
  const [waterG, setWaterG] = useState(300)
  const [tempC, setTempC] = useState(93)
  const [grindVal, setGrindVal] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  /**
   * Wurde die Zeit angefasst?
   *
   * Das Feld ist mit der ZIELzeit vorbelegt, damit man sie mit zwei Tipps
   * hinbiegen kann statt von Null zu tippen. Nur: Wer sie stehen lässt,
   * hat der App gerade erzählt, sein Durchgang sei perfekt gelaufen — und
   * bekommt „Die Zeit sitzt" für eine Zahl, die von ihr selbst kommt.
   * Deshalb wird der Vorgabewert benannt, bevor er in die Auswertung geht.
   */
  const [elapsedTouched, setElapsedTouched] = useState(false)
  const [flow, setFlow] = useState<FlowState | undefined>()
  const [puck, setPuck] = useState<PuckState | undefined>()
  const [bloom, setBloom] = useState<BloomBehavior | undefined>()
  const [drawdown, setDrawdown] = useState(0)
  /** French Press: sofort umgefüllt oder stehen gelassen? */
  const [decanted, setDecanted] = useState<boolean | undefined>()
  /** Der eigene Eindruck vom Durchlauf — zweites Signal neben der Uhr. */
  const [speedFeel, setSpeedFeel] = useState<SpeedFeel | undefined>()
  const [rating, setRating] = useState(0)
  const [defects, setDefects] = useState<Defect[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [result, setResult] = useState<Diagnosis | null>(null)
  const [showTweak, setShowTweak] = useState(false)
  /**
   * Der Weg zum Anpassen — von überall her derselbe.
   *
   * Vorher war es ein Knopf „Werte anpassen" weit unter dem Vorschlag:
   * Man musste an der Mühlengrafik vorbeiscrollen, um überhaupt zu
   * erfahren, dass sich etwas ändern lässt. Jetzt hängt er an den Zahlen
   * selbst, und die Felder kommen als Blatt über den Bildschirm statt als
   * weiterer Abschnitt darunter. Das spart die Höhe, die der Startknopf
   * braucht, um ohne Scrollen erreichbar zu bleiben.
   */
  const anpassen = () => setShowTweak(true)
  /** Ziel für „Grind antippen" — das Rad steht weiter unten. */
  const mahlwerkRef = useRef<HTMLDivElement | null>(null)

  // Vorschlag in die Ist-Felder übernehmen
  useEffect(() => {
    if (!sp) return
    setDoseG(sp.proposal.doseG)
    setYieldG(sp.proposal.yieldG)
    setWaterG(sp.proposal.waterG ?? Math.round(sp.proposal.doseG * sp.proposal.ratio))
    setTempC(sp.proposal.waterTempC)
    setGrindVal(sp.proposal.grindSetting ?? 0)
    // Auch die Zeit: Sonst stünde nach dem Wechsel von der V60 zum Espresso
    // noch die Filterzeit im Feld. 0 heißt „noch nicht vorbelegt" — der
    // Startwert wird beim Übergang ins Erfassen gesetzt.
    setElapsed(0)
    setElapsedTouched(false)
  }, [sp])

  /**
   * Die Methoden, zwischen denen der Kopf umschalten darf.
   *
   * Dieselbe Auswahl wie im Katalog: Was nicht im Haus ist, gehört auch
   * hier nicht angeboten. Die gerade gewählte Methode bleibt in jedem
   * Fall enthalten — sie steht sonst als leerer Zustand im Umschalter.
   *
   * Steht VOR dem Frühausstieg darunter, und das ist keine Kosmetik:
   * Standen die beiden Hooks dahinter, rief die Komponente bei `sp === null`
   * zwei Hooks weniger auf als sonst. React zählt sie pro Durchlauf — beim
   * Wechsel zwischen beiden Fällen bricht es mit „Rendered fewer hooks than
   * expected" ab und entlädt den Baum. Gefunden vom Linter
   * (`react-hooks(rules-of-hooks)`), siehe P7.
   */
  const favRoh = useStore((s) => s.settings.favoriteMethods)
  const umschalter = useMemo(() => {
    const gesetzt = (favRoh ?? []).filter((m) => (METHODS as string[]).includes(m))
    const basis = gesetzt.length ? gesetzt : METHODS
    return METHODS.filter((m) => basis.includes(m) || m === method)
  }, [favRoh, method])

  // Ohne Bohne wird dieser Screen nicht geöffnet (siehe App) — der Rest
  // ist Absicherung gegen eine Route, die auf eine gelöschte Bohne zeigt.
  if (!bean || !ctx || !sp) return null

  const fresh = assessFreshness(bag, method, bean.roastLevel, !!bean.isDecaf, new Date(), bean.process)
  const fit = suitability(bean, method)
  const plaus = grindPlausibility(grindVal, method, grinder)
  const brewCount = beanHistory.length
  const consistency = consistencyWarning(s.learned, method)
  const untilPersonal = brewsUntilPersonal(s.learned, bean.id, method)
  const isEspresso = method === 'espresso'
  /**
   * Die Filterkaffeemaschine hat keine Temperaturwahl (kb/10c §1). Ein
   * Stepper dafür wäre eine Schaltfläche, die nichts bewirkt — und die
   * Zahl daneben eine Vorgabe, die niemand einstellen kann.
   */
  const tempFrei = tempAdjustable(method)

  const tempSpanne = tempRange(method)
  // Am Handfilter und an der AeroPress läuft die Uhr in Minuten:Sekunden,
  // beim Espresso in nackten Sekunden — ein Shot dauert nie eine Minute.
  const alsUhr = !isEspresso
  // Bei Immersion ist die Zeit gewählt, nicht Ergebnis (kb/10b §1). Das
  // ändert die Frage, die im Auswertungsschritt gestellt wird.
  const immersion = isImmersion(method)
  const isPro = s.settings.mode === 'pro'
  const catalogEntry = GRINDER_CATALOG.find(
    (g) => g.id === grinder?.catalogId || g.name === grinder?.name,
  )
  /**
   * Dosis ändern heißt Menge ändern, nicht Verhältnis ändern.
   *
   * Wer von 18 g auf 14,5 g geht, will einen kleineren Espresso — nicht
   * denselben Espresso mit anderem Verhältnis. Ausbringung und Wasser
   * ziehen deshalb mit; wer das Verhältnis wirklich verschieben will,
   * stellt danach die Ausbringung nach.
   */
  const changeDose = (neu: number) => {
    const alt = doseG
    setDoseG(neu)
    if (alt > 0 && neu > 0) {
      setYieldG(Math.round(yieldG * (neu / alt) * 10) / 10)
      setWaterG(Math.round(waterG * (neu / alt)))
    }
  }

  // Die angezeigten Kennzahlen folgen den EINGESTELLTEN Werten, nicht dem
  // ursprünglichen Vorschlag — sonst steht dort 1:2,8, während längst
  // 1:3,5 eingestellt ist, und die Zielzeit gilt für eine Menge, die
  // gar nicht mehr gebrüht wird.
  const ratioLive = isEspresso ? yieldG / Math.max(0.1, doseG) : waterG / Math.max(0.1, doseG)
  const targetT =
    targetTimeRange(method, doseG, bean.roastLevel, isEspresso ? yieldG : undefined, sp.proposal.steepS) ??
    undefined
  const ratioTon = ratioTone(ratioLive)

  /**
   * Zielzeit für die Triade: die Mitte groß, das Band klein darunter.
   *
   * Das Band ist die Wahrheit — aber „2:30–3:00" ist doppelt so lang wie
   * „18,0" und in einem Drittel der Kartenbreite nicht mehr groß
   * darstellbar. Die Mitte ist die Zahl, auf die man zielt; das Band
   * bleibt als Zusatzzeile erhalten und geht nicht verloren.
   */
  const zielZeit = (r: [number, number]) => {
    const mitte = Math.round((r[0] + r[1]) / 2)
    return {
      value: alsUhr ? fmtClock(mitte) : String(mitte),
      unit: alsUhr ? 'min' : 's',
      hint: fmtSpanne(r),
    }
  }

  /**
   * Einen Schritt zurück, ohne Eingaben zu verlieren.
   *
   * Vorher rief der Pfeil im Kopf `reset()` — wer im Auswertungsschritt
   * zurücktippte, um eine Sekunde zu korrigieren, verlor Zeit, Fluss und
   * Bewertung und stand wieder am Startpunkt. Ein Zurück-Pfeil, der
   * Daten löscht, ist keiner.
   */
  const zurueck = () => {
    if (phase === 'proposal') return back()
    if (phase === 'record') return setPhase('proposal')
    if (phase === 'check') return setPhase('record')
    if (phase === 'taste') return setPhase('check')
    // Aus dem Ergebnis führt kein Weg zurück: Der Brew ist protokolliert.
    return reset()
  }

  const reset = () => {
    setPhase('proposal'); setElapsed(0); setElapsedTouched(false); setRating(0); setShowTweak(false)
    setDefects([]); setCharacters([]); setResult(null)
    setFlow(undefined); setPuck(undefined); setBloom(undefined); setDrawdown(0)
    setDecanted(undefined); setSpeedFeel(undefined)
  }

  // Ist-Werte und Beobachtungen genau einmal bilden. Vorher standen sie
  // zweimal wörtlich im Code — einmal für die Diagnose, einmal fürs
  // Protokoll —, und ein neues Feld musste an beiden Stellen nachgezogen
  // werden. Genau so fehlte es dann an einer.
  const actual: BrewActual = {
    doseG, timeS: elapsed, waterTempC: tempC,
    yieldG: isEspresso ? yieldG : undefined,
    waterG: isEspresso ? undefined : waterG,
    grindSetting: grinder ? { equipmentId: grinder.id, value: grindVal, unit: 'clicks' } : undefined,
  }
  const observations: Observation = {
    flowState: flow, puckState: puck, bloomBehavior: bloom,
    drawdownS: drawdown || undefined, decantedImmediately: decanted,
    perceivedSpeed: speedFeel,
  }
  const tasting: Tasting | undefined = rating
    ? { rating: rating as 1 | 2 | 3 | 4 | 5, defects, characters, wouldRepeat: rating >= 4 }
    : undefined

  /**
   * Die Laufkontrolle rechnet live mit.
   *
   * Kein Zustand, sondern eine reine Ableitung aus den Feldern: Wer im
   * Auswertungsschritt „zu langsam" antippt, sieht die Empfehlung sofort
   * mitwandern, statt sie neu anfordern zu müssen.
   */
  const run: RunCheck | null =
    phase === 'check' || phase === 'result'
      ? checkRun({ ctx, actual, observations, targetTimeS: targetT })
      : null

  /**
   * „Übernehmen und nochmal" für jede Empfehlung, die einen Wert nennt.
   *
   * Vorher hing der Knopf allein am Mahlgrad. Bei einer Temperatur- oder
   * Ratio-Empfehlung musste man den Wert von Hand nachstellen — bei einer
   * App, deren ganzer Zweck die Korrektur ist, war das der falsche Ort
   * zum Sparen. Für Technikschritte gibt es weiterhin nichts zu übernehmen.
   */
  const uebernehmen = (sg: { variable: string; newValue?: number }) => {
    if (sg.newValue === undefined) return undefined
    const wert = sg.newValue
    if (sg.variable === 'grindSetting') return () => { setGrindVal(wert); setPhase('proposal') }
    if (sg.variable === 'waterTempC') return () => { setTempC(wert); setPhase('proposal') }
    if (sg.variable === 'ratio')
      return () => {
        // Die Empfehlung nennt das Verhältnis, die Felder führen Mengen.
        if (isEspresso) setYieldG(Math.round(doseG * wert * 10) / 10)
        else setWaterG(Math.round(doseG * wert))
        setPhase('proposal')
      }
    return undefined
  }

  const runDiagnosis = () => {
    setResult(diagnose({ ctx, actual, observations, tasting, targetTimeS: targetT }))
    s.addBrew({ bagId: bag?.id ?? '', beanId: bean.id, method, actual, observations, tasting, isBest: false })
    setPhase('result')
  }

  // ══ TIMER (Vollbild) ══════════════════════════════════════════════
  return (
    <Screen>
      <Header
        title={bean.name}
        subtitle={`${METHOD_LABEL[method]} · ${fresh.label}`}
        onBack={zurueck}
      />

      {/* ══ STARTPUNKT ══ */}
      {phase === 'proposal' && (
        <>
          {/* Die Methode steht über dem Vorschlag, weil sie ihn bestimmt:
              Dose, Ratio, Temperatur und Zielzeit wandern beim Umschalten
              sichtbar mit. Ohne Überschrift — fünf beschriftete Symbole in
              einem Umschalter sagen selbst, was sie sind, und „METHODE"
              darüber wäre eine Zeile, die nichts hinzufügt. */}
          <Section>
            {/* Nur die Methoden aus der Hausauswahl — plus die gerade
                gewählte, auch wenn sie nicht dazugehört.

                Vorher standen hier alle fünf, während der Katalog eine
                Zeile weiter zurück zwei davon als „nicht im Haus" nach
                unten sortiert hatte. Zwei Bildschirme, zwei Meinungen
                über dieselbe Frage. Die gewählte bleibt trotzdem drin,
                sonst könnte man aus einem Direktaufruf nicht mehr
                zurückschalten. */}
            <SegmentedControl
              value={method}
              onChange={setMethod}
              options={umschalter.map((m) => ({
                value: m,
                label: METHOD_SHORT[m],
                icon: <MethodIcon icon={getMethod(m).icon ?? m} className="h-[22px] w-[22px]" />,
              }))}
            />
          </Section>

          <Section>
            <Card tone="accent">
              {/* Woher der Vorschlag kommt, gehört in die Karte und nicht
                  darüber: „Von einer ähnlichen Bohne" ist eine Aussage
                  ÜBER diese Zahlen, keine Abschnittsüberschrift. Außerhalb
                  gelesen wirkte sie wie ein eigener Bereich. */}
              <p className="mb-3 text-[12px] font-medium tracking-wider text-crema uppercase">
                {sp.headline}
              </p>

              {/* In, Time und Out sind das Rezept — sie stehen groß und
                  nebeneinander, in der Reihenfolge, in der sie an der
                  Maschine anfallen. Dieselben drei Begriffe wie im
                  Erfassungsschritt, damit man nicht zweimal umdenkt. */}
              {/* Antippbar, wo es etwas einzustellen gibt. Die Zielzeit
                  nicht: Sie ist ein Ergebnis der übrigen Werte, keine
                  Einstellung — eine gepunktete Linie darunter würde das
                  Gegenteil behaupten. */}
              <Triad
                items={[
                  { label: 'In', value: num(doseG), unit: 'g', term: 'dose', onEdit: anpassen },
                  {
                    label: 'Time',
                    ...(targetT ? zielZeit(targetT) : { value: '—' }),
                    term: 'time-is-result',
                  },
                  isEspresso
                    ? {
                        label: 'Out',
                        value: num(yieldG),
                        unit: 'g',
                        term: 'yield',
                        onEdit: anpassen,
                      }
                    : {
                        label: 'Out',
                        value: String(waterG),
                        unit: 'g',
                        hint: `≈ ${beverageYield(method, doseG, waterG)} g Tasse`,
                        onEdit: anpassen,
                      },
                ]}
              />

              {/* Temperatur, Ratio und Mahlgrad sind eingestellt und ändern
                  sich während eines Durchgangs nicht. Sie müssen stimmen,
                  aber nicht im Blick stehen. */}
              <div className="mt-4 border-t border-line pt-3">
                <MetaRow
                  items={[
                    {
                      label: 'Ratio',
                      value: `1:${num(ratioLive)}`,
                      term: 'ratio',
                      tone: isEspresso ? ratioTon : undefined,
                    },
                    {
                      label: 'Temp',
                      value: tempFrei
                        ? `${tempC} °C`
                        : `${tempSpanne.min}–${tempSpanne.max} °C`,
                      hint: tempFrei ? undefined : 'geräteseitig',
                      // Geräteseitig heißt: nichts zum Antippen.
                      onEdit: tempFrei ? anpassen : undefined,
                    },
                    ...(grinder
                      ? [
                          {
                            label: 'Grind',
                            value: formatSetting(grindVal, grinder),
                            term: 'grind',
                            // Der Mahlgrad hat sein eigenes Rad weiter unten —
                            // ein Tippen bringt einen dorthin, statt ihn in
                            // zwei Bedienelemente zu spalten.
                            onEdit: () => mahlwerkRef.current?.scrollIntoView({ block: 'center' }),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>

              <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                {sp.rationale.map((r, i) => (
                  <p
                    key={i}
                    className={`text-[13px] leading-snug ${
                      r.kind === 'warning' ? 'text-warn' : r.kind === 'learning' ? 'text-crema' : 'text-mute'
                    }`}
                  >
                    {r.kind === 'source' ? '▸ ' : '· '}
                    {r.text}
                  </p>
                ))}
              </div>
            </Card>

            {fit.isWarning && (
              <Card className="mt-3" tone="warn">
                <p className="text-[14px] leading-snug">
                  <strong>
                    Diese Bohne ist für {METHOD_LABEL[method]} {SUITABILITY_LABEL[fit.level]}.
                  </strong>{' '}
                  {fit.reason}
                </p>
                {bestMethodFor(bean).method !== method && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 -ml-3"
                    onClick={() => setMethod(bestMethodFor(bean).method)}
                  >
                    Mit {METHOD_LABEL[bestMethodFor(bean).method]} versuchen →
                  </Button>
                )}
              </Card>
            )}

            {!plaus.ok && plaus.message && (
              <Card className="mt-3" tone="warn">
                <p className="text-[14px] leading-snug">{plaus.message}</p>
                {plaus.suggestion !== undefined && (
                  <Button size="sm" variant="ghost" className="mt-2 -ml-3" onClick={() => setGrindVal(plaus.suggestion!)}>
                    Auf {plaus.suggestion} setzen →
                  </Button>
                )}
              </Card>
            )}

            {!grinder && (
              <Card className="mt-3" tone="warn">
                <p className="text-[14px] leading-snug">
                  <strong>Keine Mühle eingerichtet.</strong> Ohne sie kann ich Korrekturen nur in
                  Prozent angeben statt in Klicks.
                </p>
                <Button size="sm" variant="ghost" className="mt-2 -ml-3" onClick={() => navigate({ tab: 'setup', detail: 'grinder' })}>
                  Mühle einrichten →
                </Button>
              </Card>
            )}

            {/* Wer 18 g abwiegen soll, aber nur 5 g im Regal hat, merkt das
                sonst erst mit der Bag in der Hand. */}
            {bag?.remainingGrams !== undefined && bag.remainingGrams < doseG && (
              <Card className="mt-3" tone="warn">
                <p className="text-[14px] leading-snug">
                  In der Bag sind noch {num(bag.remainingGrams, 0)} g — der Vorschlag
                  braucht {num(doseG)} g.{' '}
                  {bag.remainingGrams >= 5
                    ? 'Entweder aufstocken oder die Dosis anpassen; das Verhältnis zieht mit.'
                    : 'Für einen ganzen Brew reicht das nicht mehr.'}
                </p>
                {bag.remainingGrams >= 5 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 -ml-3"
                    onClick={() => changeDose(Math.floor(bag.remainingGrams! * 10) / 10)}
                  >
                    Auf {num(Math.floor(bag.remainingGrams * 10) / 10)} g herunterrechnen
                  </Button>
                )}
              </Card>
            )}

            {consistency && (
              <Card className="mt-3" tone="warn">
                <p className="text-[14px] leading-snug">{consistency}</p>
              </Card>
            )}

          </Section>

          {/* Der Start steht direkt unter dem Vorschlag und nicht am
              Seitenende: Er muss ohne Scrollen erreichbar sein. Dafür ist
              der Abschnitt „Anpassen" von hier in ein Blatt gewandert und
              die Mühlengrafik unter den Knopf gerückt. */}
          <Section>
            <BrewButton
              icon={getMethod(method).icon ?? method}
              onClick={() => {
                // Zeit mit der Zielmitte vorbelegen — ein Startwert, der in
                // der Größenordnung stimmt und beim Eintragen überschrieben wird.
                if (elapsed === 0 && targetT) {
                  setElapsed(Math.round((targetT[0] + targetT[1]) / 2))
                  setElapsedTouched(false)
                }
                setPhase('record')
              }}
            />
          </Section>

          {/* Ohne Überschrift „Grind": Der Wert steht schon in der
              Kennzeilen-Zeile der Karte, und das Rad darunter ist als
              Mahlwerk unverwechselbar. Eine Überschrift, eine große Zahl,
              ein Empfehlungstext, das Rad und darunter noch eine
              Übersichtsskala waren fünf Elemente für einen einzigen Wert. */}
          {grinder && (
            <Section>
              <div ref={mahlwerkRef} className="scroll-mt-20">
              {/* Der Umschalter erscheint nur, wo es wirklich zwei Mühlen
                  gibt — beim Siebträger mit verbautem Mahlwerk. */}
              {grinderChoices.length > 1 && (
                <div className="mb-3">
                  <SegmentedControl
                    value={grinder.id}
                    onChange={(id) => setGrinderId(method, id)}
                    options={grinderChoices.map((g) => ({
                      value: g.id,
                      label:
                        GRINDER_CATALOG.find((c) => c.id === g.catalogId)?.shortName ?? g.name,
                    }))}
                  />
                </div>
              )}

              {grinder.scaleType === 'stepless' ? (
                <SageGrindDial
                  value={grindVal}
                  onChange={setGrindVal}
                  max={grinder.usableRange?.[1] ?? 18}
                  step={grinder.step ?? 0.5}
                  highlight={(() => {
                    const v = vendorRange(grinder, method)
                    return v
                      ? { range: v.clicks as [number, number], label: METHOD_LABEL[method] }
                      : undefined
                  })()}
                />
              ) : (
                <GrinderDial
                  clicks={grindVal}
                  onChange={setGrindVal}
                  clicksPerNumber={grinder.clicksPerNumber ?? 10}
                  maxNumber={Math.round(
                    (grinder.usableRange?.[1] ?? 100) / (grinder.clicksPerNumber ?? 10),
                  )}
                  ringLabels={catalogEntry?.ringLabels}
                  wordmark={catalogEntry?.wordmark}
                  highlight={(() => {
                    const v = vendorRange(grinder, method)
                    return v
                      ? { range: v.clicks, label: METHOD_LABEL[method], derived: v.isDerived }
                      : undefined
                  })()}
                />
              )}
              </div>
            </Section>
          )}

          {/* Der Lernhinweis stand zwischen Vorschlag und Startknopf und
              hat ihn um zwei Zeilen nach unten gedrückt. Er ist eine
              Auskunft über die Zukunft, keine über diesen Durchgang — und
              gehört deshalb ans Ende. */}
          {untilPersonal > 0 && sp.source !== 'personal' && (
            <p className="px-5 pt-6 text-[13px] leading-snug text-faint">
              {brewCount > 0 && `${brewCount}× gebrüht. `}
              Noch{' '}
              {untilPersonal === 1
                ? 'ein gut bewerteter Brew'
                : `${untilPersonal} gut bewertete Brews`}
              , dann kenne ich deinen Geschmack für diese Bohne.
            </p>
          )}

          {showTweak && (
            <Sheet title="Werte anpassen" onClose={() => setShowTweak(false)}>
              <div className="space-y-4">
                <Field label="Dose" term="dose">
                  <Stepper value={doseG} onChange={changeDose} step={0.1} min={5} max={30} unit="g" decimals={1} label="Dose" />
                </Field>
                {isEspresso ? (
                  <Field label="Ziel-Yield" term="yield">
                    <Stepper value={yieldG} onChange={setYieldG} step={0.1} min={10} max={90} unit="g" decimals={1} label="Ziel-Yield" />
                  </Field>
                ) : (
                  <Field label="Wasser" hint={`Verhältnis 1:${num(waterG / doseG)}`}>
                    <Stepper value={waterG} onChange={setWaterG} step={1} min={80} max={900} unit="g" label="Wasser" />
                  </Field>
                )}
                {tempFrei ? (
                  <Field label="Temp">
                    <Stepper value={tempC} onChange={setTempC} step={1} min={70} max={100} unit="°C" label="Temp" />
                  </Field>
                ) : (
                  <Field label="Temp" hint={`${tempSpanne.min}–${tempSpanne.max} °C, geräteseitig`}>
                    <p className="text-[15px] leading-snug text-mute">
                      Die Maschine brüht mit ihrer eigenen Temperatur. Wenn der Kaffee bitter wird,
                      hilft hier nicht kühler, sondern gröber oder eine weitere Ratio.
                    </p>
                  </Field>
                )}
                <p className="border-t border-line pt-3 text-[13px] leading-snug text-faint">
                  Der Mahlgrad hat sein eigenes Rad auf der Seite darunter — dort sieht man, wo er
                  in der Skala der Mühle liegt.
                </p>
              </div>
            </Sheet>
          )}
        </>
      )}

      {/* ══ ERFASSEN ══ */}
      {phase === 'record' && (
        <>
          {/* Die vier Zahlen, die wirklich zählen — in der Reihenfolge,
              in der sie an der Maschine anfallen. Alles andere steht
              darunter und ist optional. */}
          <Section title="Brew">
            <Card>
              <div className="space-y-4">
                <Field label="In" term="dose" hint="Eingewogene Bohnen">
                  <Stepper
                    value={doseG} onChange={changeDose} step={0.1} min={5} max={60}
                    unit="g" decimals={1} label="In"
                  />
                </Field>

                <Field
                  label="Time"
                  term="time-is-result"
                  hint={targetT ? `Ziel ${fmtSpanne(targetT)}` : undefined}
                >
                  <Stepper
                    value={elapsed} onChange={(v) => { setElapsed(v); setElapsedTouched(true) }}
                    step={alsUhr ? 5 : 1} min={1} max={900}
                    unit={alsUhr ? undefined : 's'} clock={alsUhr}
                    label="Time"
                  />
                </Field>

                <Field
                  label="Out"
                  term="yield"
                  hint={
                    isEspresso
                      ? 'Im Glas'
                      // Die App führt das aufgegossene Wasser, gedacht wird in
                      // Tassengröße. Der Satz behält den Unterschied.
                      : `Aufgegossenes Wasser · ≈ ${beverageYield(method, doseG, waterG)} g in der Tasse`
                  }
                >
                  {isEspresso ? (
                    <Stepper
                      value={yieldG} onChange={setYieldG} step={0.1} min={5} max={120}
                      unit="g" decimals={1} label="Out"
                    />
                  ) : (
                    <Stepper
                      value={waterG} onChange={setWaterG} step={1} min={50} max={1000}
                      unit="g" label="Out"
                    />
                  )}
                </Field>

                                {isEspresso && grinder && (() => {
                  // In der Schreibweise, in der die Zahl auf der Mühle
                  // steht: Die Mylo zeigt „2,4", nicht 24 Klicks. Der
                  // Vorschlagsbildschirm tat das schon, dieses Feld nicht
                  // — dieselbe Einstellung sah an zwei Stellen anders aus.
                  const per = grinder.clicksPerNumber ?? 1
                  const nummeriert = per > 1
                  const schritt = nummeriert
                    ? 0.1
                    : grinder.scaleType === 'stepless'
                      ? (grinder.step ?? 0.5)
                      : 1
                  return (
                    <Field label="Grind Size" term="grind" hint={grinder.name}>
                      <Stepper
                        value={nummeriert ? grindVal / per : grindVal}
                        onChange={(v) => setGrindVal(nummeriert ? Math.round(v * per) : v)}
                        step={schritt}
                        min={0}
                        max={(grinder.usableRange?.[1] ?? 100) / (nummeriert ? per : 1)}
                        decimals={nummeriert || grinder.scaleType === 'stepless' ? 1 : 0}
                        label="Grind Size"
                      />
                    </Field>
                  )
                })()}
              </div>

              {/* Ratio rechnet sich aus In und Out und braucht keine
                  Eingabe — sie sagt im Vorbeigehen, ob das noch ein
                  Espresso ist. */}
              {isEspresso && (
                <div className="mt-4 flex items-baseline gap-3 border-t border-line pt-3">
                  <span className="flex items-center gap-1.5 text-[13px] text-mute">
                    Ratio <InfoDot termId="ratio" />
                  </span>
                  <span
                    className={`tnum text-[26px] leading-none font-semibold ${
                      ratioTon === 'ok' ? 'text-ok' : ratioTon === 'warn' ? 'text-warn' : 'text-bad'
                    }`}
                  >
                    1:{num(ratioLive)}
                  </span>
                  <span
                    className={`text-[13px] ${
                      ratioTon === 'ok' ? 'text-ok' : ratioTon === 'warn' ? 'text-warn' : 'text-bad'
                    }`}
                  >
                    {ratioLabel(ratioLive)}
                  </span>
                </div>
              )}

              {/* Für helle Röstungen empfiehlt die App selbst weiter als
                  1:2. Ohne diesen Hinweis widerspräche die Ampel dem
                  eigenen Vorschlag. */}
              {isEspresso && Math.abs(sp.proposal.ratio - RATIO_ANCHOR) > 0.15 && (
                <p className="mt-2 text-[13px] text-faint">
                  Die Ampel misst gegen 1:2. Für diese Bohne empfiehlt die App
                  1:{num(sp.proposal.ratio)}.
                </p>
              )}
            </Card>
          </Section>

          {/* Die einzige Beobachtung, die bei der French Press zählt: Der
              Fehler passiert nach dem Brühen, nicht währenddessen. */}
          {method === 'frenchpress' && (
            <Section title="Nach dem Pressen" action={<InfoDot termId="decant" />}>
              <div className="flex flex-wrap gap-2">
                <Chip
                  label="Sofort umgefüllt"
                  active={decanted === true}
                  tone="good"
                  onClick={() => setDecanted(decanted === true ? undefined : true)}
                />
                <Chip
                  label="Stand in der Kanne"
                  active={decanted === false}
                  tone="bad"
                  onClick={() => setDecanted(decanted === false ? undefined : false)}
                />
              </div>
            </Section>
          )}

          {isEspresso && (
            <>
              <Section title="Flow" action={<InfoDot termId="flow-state" />}>
                <div className="flex flex-wrap gap-2">
                  {FLOW_CHOICES.map((f) => (
                    <Chip
                      key={f}
                      label={FLOW_LABEL[f]}
                      active={flow === f}
                      tone={f === 'normal' ? 'good' : 'bad'}
                      onClick={() => setFlow(flow === f ? undefined : f)}
                    />
                  ))}
                </div>
              </Section>
              {isPro && (
              <Section title="Puck" action={<InfoDot termId="puck" />}>
                <div className="flex flex-wrap gap-2">
                  {PUCK_CHOICES.map((p) => (
                    <Chip
                      key={p}
                      label={PUCK_LABEL[p]}
                      active={puck === p}
                      tone={p === 'even' ? 'good' : 'bad'}
                      onClick={() => setPuck(puck === p ? undefined : p)}
                    />
                  ))}
                </div>
              </Section>
              )}
            </>
          )}

          {method === 'v60' && (
            <>
              <Section title="Bloom" action={<InfoDot termId="bloom" />}>
                <div className="flex flex-wrap gap-2">
                  {BLOOM_CHOICES.map((b) => (
                    <Chip
                      key={b}
                      label={BLOOM_LABEL[b]}
                      active={bloom === b}
                      tone={b === 'moderate' ? 'good' : 'bad'}
                      onClick={() => setBloom(bloom === b ? undefined : b)}
                    />
                  ))}
                </div>
              </Section>
              {isPro && (
                <Section title="Drawdown" action={<InfoDot termId="drawdown" />}>
                  <Stepper value={drawdown} onChange={setDrawdown} step={5} min={0} max={180} unit="s" />
                </Section>
              )}
            </>
          )}

          <Section>
            {!elapsedTouched && (
              <p className="mb-2 text-[13px] leading-snug text-warn">
                Die Zeit ist mit der <strong>Zielzeit</strong> vorbelegt, nicht gemessen. Lief dein
                Durchgang anders, trag ihn ein — sonst wertet die App ihre eigene Vorgabe aus.
              </p>
            )}
            <Button size="lg" className="w-full" onClick={() => setPhase('check')}>
              {elapsedTouched ? 'Durchlauf auswerten' : 'Zeit stimmt so — auswerten'}
            </Button>
          </Section>
        </>
      )}

      {/* ══ LAUFKONTROLLE ══
          Stufe eins von zwei: Was die Uhr sagt, braucht keinen
          Geschmackseindruck. Erst danach das Tasting. */}
      {phase === 'check' && run && (
        <>
          <Section title="Der Durchlauf">
            <Card>
              <Triad
                items={[
                  {
                    label: 'Zeit',
                    value: alsUhr ? fmtClock(elapsed) : String(elapsed),
                    unit: alsUhr ? 'min' : 's',
                    tone:
                      run.band === 'onTarget'
                        ? 'ok'
                        : run.band === 'fast' || run.band === 'slow'
                          ? 'warn'
                          : run.band === 'unknown'
                            ? undefined
                            : 'bad',
                  },
                  { label: 'Ziel', ...(run.targetS ? zielZeit(run.targetS) : { value: '—' }) },
                  {
                    label: 'Delta',
                    // Dieselbe Einheit wie in den Spalten daneben: „+265 s"
                    // neben „9:00 min" müsste man im Kopf umrechnen.
                    // Echtes Minuszeichen, weil der Bindestrich in einer
                    // Ziffernkolonne zu kurz ist und zu tief sitzt.
                    value:
                      run.deltaS === null
                        ? '—'
                        : `${run.deltaS > 0 ? '+' : run.deltaS < 0 ? '−' : ''}${
                            alsUhr ? fmtClock(Math.abs(run.deltaS)) : Math.abs(run.deltaS)
                          }`,
                    unit: run.deltaS === null ? undefined : alsUhr ? 'min' : 's',
                    tone: run.band === 'onTarget' ? 'ok' : run.deltaS === null ? undefined : 'warn',
                  },
                ]}
              />

              {/* Beim Espresso ist der Fluss die aussagekräftigere Größe:
                  Er trennt „lange gelaufen" von „viel ausgebracht". */}
              {isEspresso && run.flowRateGs !== null && run.targetFlowGs !== null && (
                <div className="mt-4 border-t border-line pt-3">
                  <MetaRow
                    items={[
                      { label: 'Fluss', value: `${num(run.flowRateGs, 2)} g/s`, term: 'flow-rate' },
                      { label: 'Ziel', value: `${num(run.targetFlowGs, 2)} g/s` },
                      { label: 'Ratio', value: `1:${num(ratioLive)}`, tone: ratioTon, term: 'ratio' },
                    ]}
                  />
                </div>
              )}
            </Card>
          </Section>

          {/* Der eigene Eindruck ist das zweite, unabhängige Signal. Bei
              Immersion fließt nichts durch ein Bett — dort ist die Frage
              der Widerstand am Kolben, nicht die Geschwindigkeit. */}
          <Section
            title={speedQuestion(immersion)}
            action={<span className="text-[12px] text-faint">optional</span>}
          >
            <div className="flex flex-wrap gap-2">
              {SPEED_CHOICES.map((f) => (
                <Chip
                  key={f}
                  label={speedLabel(f, immersion)}
                  tone={f === 'onPoint' ? 'good' : 'bad'}
                  active={speedFeel === f}
                  onClick={() => setSpeedFeel(speedFeel === f ? undefined : f)}
                />
              ))}
            </div>
            <p className="mt-2 text-[13px] leading-snug text-faint">
              Deckt sich dein Eindruck mit der Uhr, steigt die Konfidenz der Empfehlung.
              Widerspricht er ihr, ist genau das der Befund.
            </p>
          </Section>

          {/* Befund und Empfehlung in einer Karte: Getrennt stünde über
              der Empfehlung eine Karte, die nur eine Überschrift enthält —
              der Befund selbst steckt schon in der Begründung. */}
          <Section title="Einschätzung">
            {run.suggestion ? (
              <SuggestionCard
                s={run.suggestion}
                kicker={run.headline}
                notes={run.notes}
                onApply={uebernehmen(run.suggestion)}
              />
            ) : (
              <RunCard run={run} />
            )}
          </Section>

          <Section>
            <Button size="lg" className="w-full" onClick={() => setPhase('taste')}>
              Weiter zum Tasting
            </Button>
            {/* Wer nur eingemessen hat, muss nicht verkosten, um die
                Zeitkorrektur zu bekommen — Phase C vor Phase D. */}
            <Button variant="secondary" className="mt-2 w-full" onClick={runDiagnosis}>
              Ohne Tasting abschließen
            </Button>
          </Section>
        </>
      )}

      {/* ══ VERKOSTEN ══ */}
      {phase === 'taste' && (
        <>
          <Section title="Rating">
            <div className="flex justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  aria-label={`${n} von 5`}
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl text-[28px] transition-colors ${
                    n <= rating ? 'text-crema' : 'text-line'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </Section>

          <Section title="Defects" action={<span className="text-[12px] text-faint">löst Korrekturen aus</span>}>
            <div className="flex flex-wrap gap-2">
              {COMMON_DEFECTS.map((d) => (
                <Chip
                  key={d}
                  label={DEFECT_LABEL[d]}
                  tone="bad"
                  active={defects.includes(d)}
                  onClick={() =>
                    setDefects((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))
                  }
                />
              ))}
            </div>
            <p className="mt-2 text-[12px] text-faint">
              Nichts angetippt ist der Normalfall bei einem guten Kaffee.
            </p>
          </Section>

          <Section title="Notes" action={<span className="text-[12px] text-faint">nur beschreibend</span>}>
            <div className="flex flex-wrap gap-2">
              {COMMON_CHARACTERS.map((c) => (
                <Chip
                  key={c}
                  label={CHARACTER_LABEL[c] ?? c}
                  active={characters.includes(c)}
                  onClick={() =>
                    setCharacters((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))
                  }
                />
              ))}
            </div>
          </Section>

          <Section>
            <Button size="lg" className="w-full" disabled={rating === 0} onClick={runDiagnosis}>
              Auswerten
            </Button>
            {/* Ein Knopf, der nichts tut und nicht sagt warum, ist der
                häufigste Grund, eine App wegzulegen. */}
            {rating === 0 && (
              <p className="mt-2 text-center text-[13px] text-faint">
                Erst die Sterne — ohne Bewertung weiß die App nicht, ob eine Korrektur geholfen hat.
              </p>
            )}
          </Section>
        </>
      )}

      {/* ══ ERGEBNIS ══ */}
      {phase === 'result' && result && (
        <>
          {/* Stufe eins bleibt sichtbar. Ohne sie stünde auf der
              Ergebnisseite eine Empfehlung ohne die Zahl, aus der sie
              entstanden ist — und der Nutzer müsste glauben statt prüfen. */}
          {result.run && (
            <Section title="Laufkontrolle">
              {/* Gleiche Regel wie im Auswertungsschritt: Der Befund steht
                  dort, wo er nicht doppelt steht — in der Karte, solange
                  keine Empfehlung ihn ohnehin begründet. */}
              <RunCard run={result.run} compact withSummary={!result.suggestions.length} />
            </Section>
          )}

          {/* Mündet die Sensorik in eine Empfehlung, sagt diese Karte
              nichts, was nicht unten in der Empfehlung steht — dann bleibt
              sie weg. Eine Stufe, eine Karte. */}
          {result.suggestions.length === 0 && (
          <Section title={result.run ? 'Mit dem Geschmack' : undefined}>
            <Card tone={result.blocked ? 'warn' : 'default'}>
              <p className="text-[19px] leading-tight font-semibold">{result.headline}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-mute">{result.summary}</p>

              {result.techniqueSteps && (
                <ol className="mt-3 space-y-1.5 border-t border-line pt-3">
                  {result.techniqueSteps.map((t, i) => (
                    <li key={i} className="flex gap-2 text-[14px] leading-snug">
                      <span className="text-crema">{i + 1}.</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ol>
              )}
              {result.checklist && (
                <ul className="mt-3 space-y-1 border-t border-line pt-3">
                  {result.checklist.map((t, i) => (
                    <li key={i} className="text-[14px] text-mute">· {t}</li>
                  ))}
                </ul>
              )}
              {result.escalation && (
                <ul className="mt-3 space-y-1 border-t border-line pt-3">
                  {result.escalation.map((t, i) => (
                    <li key={i} className="text-[14px] text-mute">→ {t}</li>
                  ))}
                </ul>
              )}
            </Card>
          </Section>
          )}

          {result.suggestions.map((sg) => (
            // „Empfehlung", nicht „Mit dem Geschmack": Bei einer gut
            // bewerteten Tasse ohne Fehlertag stammt sie allein aus der
            // Zeit — die Überschrift hätte dann das Falsche behauptet.
            <Section key={sg.ruleId} title="Empfehlung">
              <SuggestionCard s={sg} kicker={result.headline} onApply={uebernehmen(sg)} />
            </Section>
          ))}

          {result.saveAsReference && (
            <Section>
              <Card tone="accent">
                <p className="text-[15px]">Das war gut. Als Referenz für diese Bohne merken?</p>
                <Button
                  className="mt-3 w-full"
                  onClick={() => {
                    const latest = useStore.getState().brews[0]
                    if (latest) useStore.getState().setBestBrew(latest.id)
                    back()
                  }}
                >
                  Als Referenz speichern
                </Button>
              </Card>
            </Section>
          )}

          <Section>
            {/* „Fertig" heißt fertig — zurück zu den Bohnen. Den nächsten
                Durchgang startet „Übernehmen und nochmal" in der Empfehlung;
                ein zweiter Wiederholen-Knopf hier wäre dieselbe Absicht an
                zwei Orten. */}
            <Button variant="secondary" size="lg" className="w-full" onClick={back}>
              Fertig
            </Button>
          </Section>
        </>
      )}
    </Screen>
  )
}

/**
 * Die Laufkontrolle als Karte.
 *
 * Zwei Auftritte, ein Bauteil: ausführlich im Auswertungsschritt, knapp
 * auf der Ergebnisseite. Zweimal dasselbe zu formulieren hieße, dass die
 * beiden Ansichten irgendwann auseinanderlaufen.
 */
function RunCard({
  run,
  compact,
  withSummary = true,
}: {
  run: RunCheck
  compact?: boolean
  /** Aus, wenn darunter eine Empfehlung denselben Befund begründet. */
  withSummary?: boolean
}) {
  return (
    <Card tone={run.timeUsable ? (run.suggestion ? 'accent' : 'default') : 'warn'}>
      <p className={`${compact ? 'text-[16px]' : 'text-[19px]'} leading-tight font-semibold`}>
        {run.headline}
      </p>
      {withSummary && (
        <p className={`mt-2 ${compact ? 'text-[13px]' : 'text-[15px]'} leading-relaxed text-mute`}>
          {run.summary}
        </p>
      )}

      {run.techniqueSteps && (
        <ol className="mt-3 space-y-1.5 border-t border-line pt-3">
          {run.techniqueSteps.map((t, i) => (
            <li key={i} className="flex gap-2 text-[14px] leading-snug">
              <span className="text-crema">{i + 1}.</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      )}

      <RunNotes notes={run.notes} />
    </Card>
  )
}

/**
 * Die Nebenbefunde ändern die Empfehlung nicht, sie erklären sie — oder
 * warnen davor, die Ursache am falschen Ort zu suchen.
 */
function RunNotes({ notes }: { notes: RunCheck['notes'] }) {
  if (!notes.length) return null
  return (
    <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
      {notes.map((n, i) => (
        <li
          key={i}
          className={`text-[13px] leading-snug ${
            n.tone === 'warn' ? 'text-warn' : n.tone === 'good' ? 'text-ok' : 'text-mute'
          }`}
        >
          {n.tone === 'good' ? '✓ ' : n.tone === 'warn' ? '! ' : '· '}
          {n.text}
        </li>
      ))}
    </ul>
  )
}

/**
 * Eine Empfehlung, fünf Elemente (kb/14 §8): was, warum, Erwartung,
 * Konfidenz, Alternative. Die Erwartung ist der wichtigste Teil — sie
 * macht die App überprüfbar.
 */
function SuggestionCard({
  s,
  kicker,
  notes,
  onApply,
}: {
  s: Diagnosis['suggestions'][number]
  /** Der Befund über der Maßnahme — „Zu schnell durchgelaufen". */
  kicker?: string
  notes?: RunCheck['notes']
  onApply?: () => void
}) {
  return (
    <Card tone="accent">
      {kicker && (
        <p className="mb-1 text-[13px] font-medium tracking-wide text-mute uppercase">{kicker}</p>
      )}
      <p className="text-[22px] leading-tight font-semibold text-crema">{s.what}</p>
      <p className="mt-2 text-[15px] leading-relaxed">{s.why}</p>
      <div className="mt-3 rounded-xl border border-line bg-raised p-3">
        <p className="text-[12px] font-medium tracking-wide text-mute uppercase">Erwartung</p>
        <p className="mt-1 text-[14px] leading-snug">{s.expectation}</p>
      </div>
      <p className="mt-2 text-[12px] text-faint">Konfidenz: {s.confidence}</p>
      {s.alternative && <p className="mt-2 text-[13px] text-mute">{s.alternative}</p>}
      {notes && <RunNotes notes={notes} />}
      {onApply && (
        <Button className="mt-4 w-full" onClick={onApply}>
          Übernehmen und nochmal
        </Button>
      )}
    </Card>
  )
}
