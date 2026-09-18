/**
 * Der Kernloop.
 *
 * Briefing G10: Von „Start“ bis „bewertet“ höchstens drei Pflichtinteraktionen.
 * Alles andere ist vorbelegt und optional.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Route } from '@/router'
import { useStore, selectActiveWater, grinderFor, uid } from '@/store'
import type {
  Bean, BrewMethod, Defect, Character, FlowState, PuckState, BloomBehavior, SpeedFeel,
  BrewActual, Observation, Tasting,
} from '@domain'
import type { EngineContext } from '@/domain'
import { startingPoint } from '@/engine/starting'
import { diagnose, type Diagnosis } from '@/engine/diagnose'
import { alsEmpfehlung, trefferquote, imKreis } from '@/engine/wette'
import { checkRun, type RunCheck } from '@/engine/runcheck'
import { fmtSpanne } from '@/engine/text'
import { assessFreshness } from '@/engine/freshness'
import { consistencyWarning, brewsUntilPersonal } from '@/engine/learn'
import { suitability, SUITABILITY_LABEL, bestMethodFor } from '@/engine/suitability'
import { ratioTone, ratioLabel, RATIO_ANCHOR } from '@/engine/ratio'
import { grindPlausibility, formatSetting } from '@/engine/grinder'
import { MethodIcon, BrewButton } from '@/components/methodicons'
import SessionLauf from '@/components/SessionLauf'
import { type Achsen, MITTE } from '@/components/geschmackspad'
import {
  GRINDER_CATALOG,
  getMethod,
  grindersForMethod,
  targetTimeRange,
  beverageYield,
  tempAdjustable,
  tempRange,
} from '@/kb'
import { METHODS, METHOD_LABEL, METHOD_SHORT } from '@/labels'
import {
  Screen, Header, Section, Card, Button, SegmentedControl, Stepper, Field, InfoDot, Triad, MetaRow, fmtClock, num
} from '@/components/ui'
import { PhaseLaufkontrolle, PhaseVerkosten, PhaseErgebnis } from './brewphases'
import { Mahlwerk, WerteAnpassen, Beobachtungen } from './brewinputs'

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
type Phase = 'proposal' | 'laeuft' | 'record' | 'check' | 'taste' | 'result'

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
  /** Die Position im Geschmackspad — Extraktionsachse und Körper. */
  const [achsen, setAchsen] = useState<Achsen>(MITTE)
  const [characters, setCharacters] = useState<Character[]>([])
  const [result, setResult] = useState<Diagnosis | null>(null)
  const [showTweak, setShowTweak] = useState(false)
  /**
   * Die Kennung der Wette, die gerade auf dem Ergebnisbildschirm steht.
   *
   * Sie wird beim Auswerten festgehalten und beim Übernehmen gebraucht —
   * ohne sie wüsste die App nicht, welche Vorhersage der Nutzer
   * tatsächlich ausprobiert.
   */
  const [empfehlungId, setEmpfehlungId] = useState<string | null>(null)

  /**
   * Die Zeit, mit der ausgewertet wurde.
   *
   * Nicht `elapsed` nehmen: Das Protokollieren ändert den Bestand, der
   * Startpunkt wird neu gerechnet, und der Effekt weiter unten belegt die
   * Ist-Felder wieder mit dem Vorschlag — bis die Ergebnisseite erscheint,
   * steht dort längst wieder 0. Auf dem Bildschirm stand dann „jetzt 0 s"
   * neben einer Diagnose über 28 Sekunden.
   */
  const [gemesseneZeit, setGemesseneZeit] = useState(0)
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

  /** Die Wette, die zu dem Ergebnis gehört, das gerade auf dem Schirm steht. */
  const aktuelleEmpfehlung = empfehlungId
    ? s.empfehlungen.find((e) => e.id === empfehlungId)
    : undefined

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
   * Der laufende Durchgang füllt den ganzen Bildschirm.
   *
   * Kein Kopf, keine Reiterleiste, kein Scrollen: In diesen Sekunden hat
   * man beide Hände am Siebträger. Alles, was nicht Zeit und Zielband
   * ist, wäre im Weg.
   */
  if (phase === 'laeuft') {
    return (
      <SessionLauf
        method={method}
        beanName={bean.name}
        {...(targetT ? { ziel: targetT } : {})}
        tonhinweise={s.settings.tonhinweise !== false}
        onTon={(an) => s.setSettings({ tonhinweise: an })}
        onStopp={(sekunden) => {
          // Gemessen, nicht geraten — deshalb gilt die Zeit ab hier als
          // angefasst und der Hinweis „nur vorbelegt" entfällt.
          setElapsed(sekunden)
          setElapsedTouched(true)
          setPhase('record')
        }}
        onAbbruch={() => setPhase('proposal')}
      />
    )
  }

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
    setAchsen(MITTE); setDefects([]); setCharacters([])
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
    // Übernehmen heißt: Der Nutzer probiert die Vorhersage aus. Erst
    // damit wird sie abrechenbar — eine nur gelesene Empfehlung gehört
    // nicht in die Trefferquote.
    const angenommen = () => {
      if (empfehlungId) s.uebernehmeEmpfehlung(empfehlungId)
      setPhase('proposal')
    }
    if (sg.variable === 'grindSetting') return () => { setGrindVal(wert); angenommen() }
    if (sg.variable === 'waterTempC') return () => { setTempC(wert); angenommen() }
    if (sg.variable === 'ratio')
      return () => {
        // Die Empfehlung nennt das Verhältnis, die Felder führen Mengen.
        if (isEspresso) setYieldG(Math.round(doseG * wert * 10) / 10)
        else setWaterG(Math.round(doseG * wert))
        angenommen()
      }
    return undefined
  }

  const runDiagnosis = () => {
    const d = diagnose({ ctx, actual, observations, tasting, targetTimeS: targetT })
    setResult(d)
    setGemesseneZeit(elapsed)

    /**
     * Reihenfolge mit Absicht: erst protokollieren, dann wetten.
     *
     * Der neue Durchgang rechnet die VORIGE Wette ab — er ist ihre
     * Messung. Erst danach kommt die neue dazu, sonst löste sie sich
     * selbst ein.
     */
    const brewId = s.addBrew({
      bagId: bag?.id ?? '', beanId: bean.id, method, actual, observations, tasting, isBest: false,
    })
    const emp = alsEmpfehlung({
      diagnose: d,
      brewId,
      beanId: bean.id,
      method,
      istWert: actual.grindSetting?.value,
      id: uid(),
      at: new Date().toISOString(),
    })
    setEmpfehlungId(emp?.id ?? null)
    if (emp) s.merkeEmpfehlung(emp)

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
              <p className="mb-3 text-xs font-medium tracking-wider text-crema uppercase">
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
                    className={`text-sm leading-snug ${
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
                <p className="text-base leading-snug">
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
                <p className="text-base leading-snug">{plaus.message}</p>
                {plaus.suggestion !== undefined && (
                  <Button size="sm" variant="ghost" className="mt-2 -ml-3" onClick={() => setGrindVal(plaus.suggestion!)}>
                    Auf {plaus.suggestion} setzen →
                  </Button>
                )}
              </Card>
            )}

            {!grinder && (
              <Card className="mt-3" tone="warn">
                <p className="text-base leading-snug">
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
                <p className="text-base leading-snug">
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
                <p className="text-base leading-snug">{consistency}</p>
              </Card>
            )}

          </Section>

          {/* Der Start steht direkt unter dem Vorschlag und nicht am
              Seitenende: Er muss ohne Scrollen erreichbar sein. Dafür ist
              der Abschnitt „Anpassen" von hier in ein Blatt gewandert und
              die Mühlengrafik unter den Knopf gerückt. */}
          <Section>
            {/* Der Knopf startet jetzt die Uhr, statt ins Formular zu
                springen. Vorher wurde die Zeit mit der Zielmitte vorbelegt
                und hinterher eingetippt — die App wertete damit im Zweifel
                ihre eigene Vorgabe aus. */}
            <BrewButton
              icon={getMethod(method).icon ?? method}
              onClick={() => setPhase('laeuft')}
            />
          </Section>

          {/* Ohne Überschrift „Grind": Der Wert steht schon in der
              Kennzeilen-Zeile der Karte, und das Rad darunter ist als
              Mahlwerk unverwechselbar. Eine Überschrift, eine große Zahl,
              ein Empfehlungstext, das Rad und darunter noch eine
              Übersichtsskala waren fünf Elemente für einen einzigen Wert. */}
          {grinder && (
            <Mahlwerk
              method={method}
              grinder={grinder}
              grinderChoices={grinderChoices}
              setGrinderId={setGrinderId}
              grindVal={grindVal}
              setGrindVal={setGrindVal}
              catalogEntry={catalogEntry}
              mahlwerkRef={mahlwerkRef}
            />
          )}

          {/* Der Lernhinweis stand zwischen Vorschlag und Startknopf und
              hat ihn um zwei Zeilen nach unten gedrückt. Er ist eine
              Auskunft über die Zukunft, keine über diesen Durchgang — und
              gehört deshalb ans Ende. */}
          {untilPersonal > 0 && sp.source !== 'personal' && (
            <p className="px-5 pt-6 text-sm leading-snug text-faint">
              {brewCount > 0 && `${brewCount}× gebrüht. `}
              Noch{' '}
              {untilPersonal === 1
                ? 'ein gut bewerteter Brew'
                : `${untilPersonal} gut bewertete Brews`}
              , dann kenne ich deinen Geschmack für diese Bohne.
            </p>
          )}

          {showTweak && (
            <WerteAnpassen
              isEspresso={isEspresso}
              doseG={doseG}
              changeDose={changeDose}
              yieldG={yieldG}
              setYieldG={setYieldG}
              waterG={waterG}
              setWaterG={setWaterG}
              tempC={tempC}
              setTempC={setTempC}
              tempFrei={tempFrei}
              tempSpanne={tempSpanne}
              setShowTweak={setShowTweak}
            />
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
                  <span className="flex items-center gap-1.5 text-sm text-mute">
                    Ratio <InfoDot termId="ratio" />
                  </span>
                  <span
                    className={`tnum text-3xl leading-none font-semibold ${
                      ratioTon === 'ok' ? 'text-ok' : ratioTon === 'warn' ? 'text-warn' : 'text-bad'
                    }`}
                  >
                    1:{num(ratioLive)}
                  </span>
                  <span
                    className={`text-sm ${
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
                <p className="mt-2 text-sm text-faint">
                  Die Ampel misst gegen 1:2. Für diese Bohne empfiehlt die App
                  1:{num(sp.proposal.ratio)}.
                </p>
              )}
            </Card>
          </Section>

          <Beobachtungen
            method={method}
            isEspresso={isEspresso}
            isPro={isPro}
            decanted={decanted}
            setDecanted={setDecanted}
            flow={flow}
            setFlow={setFlow}
            puck={puck}
            setPuck={setPuck}
            bloom={bloom}
            setBloom={setBloom}
            drawdown={drawdown}
            setDrawdown={setDrawdown}
          />

          <Section>
            {!elapsedTouched && (
              <p className="mb-2 text-sm leading-snug text-warn">
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
        <PhaseLaufkontrolle
          method={method}
          run={run}
          elapsed={elapsed}
          ratioLive={ratioLive}
          zielZeit={zielZeit}
          speedFeel={speedFeel}
          setSpeedFeel={setSpeedFeel}
          uebernehmen={uebernehmen}
          weiter={() => setPhase('taste')}
          auswerten={runDiagnosis}
        />
      )}

      {/* ══ VERKOSTEN ══ */}
      {phase === 'taste' && (
        <PhaseVerkosten
          rating={rating}
          setRating={setRating}
          defects={defects}
          setDefects={setDefects}
          characters={characters}
          setCharacters={setCharacters}
          achsen={achsen}
          setAchsen={setAchsen}
          auswerten={runDiagnosis}
        />
      )}

      {/* ══ ERGEBNIS ══ */}
      {phase === 'result' && result && (
        <PhaseErgebnis
          result={result}
          uebernehmen={uebernehmen}
          back={back}
          {...(aktuelleEmpfehlung ? { empfehlung: aktuelleEmpfehlung } : {})}
          jetzt={gemesseneZeit}
          {...(targetT ? { band: targetT } : {})}
          alsUhr={alsUhr}
          bilanz={trefferquote(s.empfehlungen)}
          kreis={imKreis(s.empfehlungen, bean.id, method)}
        />
      )}
    </Screen>
  )
}
