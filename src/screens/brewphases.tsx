/**
 * Die drei hinteren Phasen des Kernloops, plus die Karten, die sie zeigen.
 *
 * Herausgelöst aus `BrewScreen.tsx` (P9, Befund F-09). Die Datei hatte
 * 1304 Zeilen; ausschlaggebend für den Schnitt war nicht die Zahl, sondern
 * wie viel jede Phase vom Rest braucht:
 *
 *     proposal   332 Zeilen   40 Namen aus der Komponente
 *     record     211 Zeilen   34
 *     check      104 Zeilen   14
 *     taste       65 Zeilen    7
 *     result      87 Zeilen    2
 *
 * Die drei unteren hängen an wenigem und stehen deshalb hier. Startpunkt
 * und Erfassen teilen sich die Eingabefelder mit allem anderen — die
 * herauszuziehen hieße, vierzig Werte durchzureichen, und das wäre
 * schlechter als eine lange Datei. Sie bleiben, wo sie sind.
 *
 * Reines Verschieben, kein Verhalten geändert.
 */
import { useState } from 'react'
import type { BrewMethod, Defect, Character, SpeedFeel } from '@domain'
import { useStore } from '@/store'
import type { Diagnosis } from '@/engine/diagnose'
import type { Trefferbilanz, Kreisbefund } from '@/engine/wette'
import type { Empfehlung } from '@/domain'
import { Vorhersagebalken, Trefferzeile, Kreiswarnung } from '@/components/vorhersage'
import { Getraenkekarte } from '@/components/getraenke'
import type { Grundlage } from '@/engine/getraenke'
import type { RunCheck } from '@/engine/runcheck'
import { ratioTone } from '@/engine/ratio'
import { isImmersion } from '@/kb'
import {
  DEFECT_LABEL, COMMON_DEFECTS, CHARACTER_LABEL, COMMON_CHARACTERS,
  SPEED_CHOICES, speedLabel, speedQuestion,
} from '@/labels'
import {
  Section, Card, Button, Chip, Triad, MetaRow, fmtClock, num,
} from '@/components/ui'
import Geschmackspad, { type Achsen, MITTE, SCHWELLE, tagsAus } from '@/components/geschmackspad'

/** Die Fehler, die das Pad besitzt — alle anderen gehören den Chips. */
const ACHSEN_TAGS = new Set<Defect>(['sour', 'bitter', 'thin'])

/**
 * Was eine Empfehlung anzubieten hat, wenn man sie annimmt — oder nichts,
 * wenn sie keinen Wert zum Übernehmen nennt. Die Entscheidung darüber
 * bleibt im Brühbildschirm: Sie schreibt in dessen Eingabefelder.
 */
type Uebernehmen = (sg: { variable: string; newValue?: number }) => (() => void) | undefined

/** Die Zielzeit, fertig formatiert — kommt aus dem Brühbildschirm. */
type Zielzeit = (r: [number, number]) => { value: string; unit?: string; hint?: string }

/**
 * Laufkontrolle: was die Uhr sagt, noch ohne jeden Geschmackseindruck.
 *
 * kb/15 §3.1 trennt Phase C und D genau so — und die Trennung ist der
 * Grund, warum die Ergebnisseite später zeigen kann, woher eine
 * Empfehlung stammt.
 */
export function PhaseLaufkontrolle({
  method,
  run,
  elapsed,
  ratioLive,
  zielZeit,
  speedFeel,
  setSpeedFeel,
  uebernehmen,
  weiter,
  auswerten,
  vorbehalt,
}: {
  method: BrewMethod
  run: RunCheck
  /** Gilt schon hier, nicht erst im Ergebnis: siehe `zuFrischVorbehalt`. */
  vorbehalt?: string
  elapsed: number
  ratioLive: number
  zielZeit: Zielzeit
  speedFeel: SpeedFeel | undefined
  setSpeedFeel: (v: SpeedFeel | undefined) => void
  uebernehmen: Uebernehmen
  weiter: () => void
  auswerten: () => void
}) {
  // Aus der Methode abgeleitet statt durchgereicht: drei Wahrheiten, die
  // sich aus einer ergeben, sollen nicht als drei Angaben wandern.
  const isEspresso = method === 'espresso'
  const alsUhr = !isEspresso
  const immersion = isImmersion(method)
  const ratioTon = ratioTone(ratioLive)

  return (
    <>
      {/* Ganz oben, aus demselben Grund wie im Ergebnis: Er sagt, wie
          weit die Zahlen darunter tragen. */}
      {vorbehalt && (
        <Section>
          <Card tone="warn">
            <p className="text-base leading-snug">{vorbehalt}</p>
          </Card>
        </Section>
      )}

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
        action={<span className="text-xs text-faint">optional</span>}
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
        <Button size="lg" className="w-full" onClick={weiter}>
          Weiter zum Tasting
        </Button>
        {/* Wer nur eingemessen hat, muss nicht verkosten, um die
            Zeitkorrektur zu bekommen — Phase C vor Phase D. */}
        <Button variant="secondary" className="mt-2 w-full" onClick={auswerten}>
          Ohne Tasting abschließen
        </Button>
      </Section>
    </>
  )
}

/**
 * Verkosten — eine Frage, nicht acht Felder.
 *
 * Nach dem Shot sind die Hände nass und der Kaffee wird kalt. Vorher
 * standen hier fünf Sterne, acht Fehlerchips und sieben Charakterchips:
 * zwanzig Ziele, von denen keines größer als ein Daumennagel war.
 *
 * Jetzt beantwortet ein Tipp die Frage, um die es beim Einmessen geht —
 * zu sauer, sitzt, zu bitter. Das ist die Extraktionsachse, und mehr
 * braucht die Engine für eine Korrektur nicht. Alles Weitere steht unter
 * „Genauer" und ist da, wenn man es will.
 */
export function PhaseVerkosten({
  rating,
  setRating,
  defects,
  setDefects,
  characters,
  setCharacters,
  achsen,
  setAchsen,
  auswerten,
}: {
  rating: number
  setRating: (n: number) => void
  defects: Defect[]
  setDefects: (d: Defect[]) => void
  characters: Character[]
  setCharacters: (f: (x: Character[]) => Character[]) => void
  achsen: Achsen
  setAchsen: (a: Achsen) => void
  auswerten: () => void
}) {
  const [genauer, setGenauer] = useState(false)

  /**
   * Das Pad besitzt die Extraktionsachse, die Chips besitzen den Rest.
   *
   * Ohne diese Trennung würden sich beide gegenseitig überschreiben:
   * Ein Zug am Pad hätte „salzig" gelöscht, ein Tipp auf „flach" die
   * Position verworfen.
   */
  const sonstige = defects.filter((d) => !ACHSEN_TAGS.has(d))
  const setzeAchsen = (a: Achsen) => {
    setAchsen(a)
    setDefects([...tagsAus(a), ...sonstige])
  }

  const gewaehlt: 'sauer' | 'sitzt' | 'bitter' | null =
    achsen.saeure <= -SCHWELLE
      ? 'sauer'
      : achsen.saeure >= SCHWELLE
        ? 'bitter'
        : rating >= 4
          ? 'sitzt'
          : null

  const karte = (
    id: 'sauer' | 'sitzt' | 'bitter',
    titel: string,
    unter: string,
    a: Achsen,
    bewertung: number,
  ) => (
    <button
      type="button"
      onClick={() => {
        setzeAchsen(a)
        setRating(bewertung)
      }}
      aria-pressed={gewaehlt === id}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
        gewaehlt === id ? 'border-crema bg-crema/10' : 'border-line bg-card'
      }`}
    >
      <div className="text-xl font-semibold">{titel}</div>
      <div className="mt-0.5 text-sm text-mute">{unter}</div>
    </button>
  )

  return (
    <>
      <Section>
        <h2 className="text-2xl font-semibold tracking-tight">Wie war er?</h2>
      </Section>

      <Section>
        <div className="flex flex-col gap-2.5">
          {karte('sauer', 'Zu sauer', 'dünn, scharf, kurzer Abgang', { saeure: -0.6, koerper: 0 }, 2)}
          {karte('sitzt', 'Sitzt', 'süß, rund, trägt', MITTE, 4)}
          {karte('bitter', 'Zu bitter', 'trocken, kratzig, schwer', { saeure: 0.6, koerper: 0 }, 2)}
        </div>
      </Section>

      <Section>
        <button
          type="button"
          onClick={() => setGenauer((g) => !g)}
          aria-expanded={genauer}
          className="text-base font-medium text-crema"
        >
          {genauer ? 'Weniger' : 'Genauer'}
        </button>
      </Section>

      {genauer && (
        <>
          <Section title="Wo genau">
            <Geschmackspad wert={achsen} onChange={setzeAchsen} />
          </Section>

          <Section title="Bewertung">
            <div className="flex justify-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  aria-label={`${n} von 5`}
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl transition-colors ${
                    n <= rating ? 'text-crema' : 'text-line'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </Section>

          <Section
            title="Sonst noch"
            action={<span className="text-2xs text-faint">löst Korrekturen aus</span>}
          >
            <div className="flex flex-wrap gap-2">
              {COMMON_DEFECTS.filter((d) => !ACHSEN_TAGS.has(d)).map((d) => (
                <Chip
                  key={d}
                  label={DEFECT_LABEL[d]}
                  tone="bad"
                  active={defects.includes(d)}
                  onClick={() =>
                    setDefects(
                      defects.includes(d)
                        ? defects.filter((x) => x !== d)
                        : [...tagsAus(achsen), ...sonstige, d],
                    )
                  }
                />
              ))}
            </div>
          </Section>

          <Section title="Notizen" action={<span className="text-2xs text-faint">nur beschreibend</span>}>
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
        </>
      )}

      <Section>
        <Button size="lg" className="w-full" disabled={gewaehlt === null} onClick={auswerten}>
          Auswerten
        </Button>
        {/* Ein Knopf, der nichts tut und nicht sagt warum, ist der
            häufigste Grund, eine App wegzulegen. */}
        {gewaehlt === null && (
          <p className="mt-2 text-center text-sm text-faint">
            Erst die eine Frage oben — ohne sie weiß die App nicht, in welche Richtung sie
            korrigieren soll.
          </p>
        )}
      </Section>
    </>
  )
}

/** Die Ergebnisseite — beide Stufen getrennt, damit die Herkunft sichtbar bleibt. */
export function PhaseErgebnis({
  result,
  uebernehmen,
  back,
  empfehlung,
  jetzt,
  band,
  alsUhr,
  bilanz,
  kreis,
  basis,
}: {
  result: Diagnosis
  uebernehmen: Uebernehmen
  /** „Fertig" führt zurück zu den Bohnen — dieselbe Stelle wie der Kopfpfeil. */
  back: () => void
  /** Die gerade gestellte Wette, wenn die Diagnose eine hergab. */
  empfehlung?: Empfehlung
  /** Die gemessene Zeit dieses Durchgangs. */
  jetzt: number
  band?: [number, number]
  alsUhr: boolean
  bilanz: Trefferbilanz
  /** Gesetzt, wenn dreimal vergeblich an derselben Größe gedreht wurde. */
  kreis: Kreisbefund | null
  /**
   * Der Durchgang als Ausgangspunkt für die Getränkekarte.
   *
   * Fehlt er, gibt es keine Karte — wer die Zusatzfunktion abgeschaltet
   * hat, bekommt nichts, und dasselbe gilt für Methoden, für die die
   * Wissensbasis keine Rezepturen führt.
   */
  basis?: Grundlage
}) {
  return (
    <>
      {/* Steht ÜBER der Empfehlung: Wer dreimal vergeblich gedreht hat,
          soll den vierten Vorschlag gar nicht erst als naheliegend lesen. */}
      {kreis && (
        <Section>
          <Kreiswarnung befund={kreis} />
        </Section>
      )}

      {/* Aus demselben Grund darüber: Der Vorbehalt sagt, wie weit die
          Empfehlung trägt. Darunter gelesen käme er zu spät — dann steht
          die Zahl schon als Einstellung im Kopf. */}
      {result.vorbehalt && (
        <Section>
          <Card tone="warn">
            <p className="text-base leading-snug">{result.vorbehalt}</p>
          </Card>
        </Section>
      )}
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
          <p className="text-2xl leading-tight font-semibold">{result.headline}</p>
          <p className="mt-2 text-lg leading-relaxed text-mute">{result.summary}</p>

          {result.techniqueSteps && (
            <ol className="mt-3 space-y-1.5 border-t border-line pt-3">
              {result.techniqueSteps.map((t, i) => (
                <li key={i} className="flex gap-2 text-base leading-snug">
                  <span className="text-crema">{i + 1}.</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          )}
          {result.checklist && (
            <ul className="mt-3 space-y-1 border-t border-line pt-3">
              {result.checklist.map((t, i) => (
                <li key={i} className="text-base text-mute">· {t}</li>
              ))}
            </ul>
          )}
          {result.escalation && (
            <ul className="mt-3 space-y-1 border-t border-line pt-3">
              {result.escalation.map((t, i) => (
                <li key={i} className="text-base text-mute">→ {t}</li>
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

          {/* Die Prognose neben der gemessenen Zeit, auf derselben Skala.
              Als Satz allein bleibt sie eine Behauptung; hier kann man sie
              prüfen, ohne zu rechnen. */}
          {empfehlung?.vorhersage && (
            <Card className="mt-2">
              <Vorhersagebalken
                jetzt={jetzt}
                {...(band ? { band } : {})}
                vorhersage={empfehlung.vorhersage}
                alsUhr={alsUhr}
              />
              <div className="mt-2 border-t border-line pt-2">
                <Trefferzeile bilanz={bilanz} />
              </div>
            </Card>
          )}
        </Section>
      ))}

      {result.saveAsReference && (
        <Section>
          <Card tone="accent">
            <p className="text-lg">Das war gut. Als Referenz für diese Bohne merken?</p>
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

      {/* Steht zwischen Empfehlung und „Fertig": Die Empfehlung gilt dem
          nächsten Durchgang, die Karte diesem Glas. Wer nichts mehr
          korrigieren will, geht hier weiter statt zurück.

          Nicht bei `blocked`: Dort sagt die App gerade, dass sie aus
          diesem Durchgang nichts ableiten kann — ein abgebrochener Shot
          nach einer Sekunde. Darunter „Was wird daraus?" zu fragen,
          widerspricht dem Satz darüber. */}
      {basis && !result.blocked && <Getraenkekarte basis={basis} />}

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
      <p className={`${compact ? 'text-xl' : 'text-2xl'} leading-tight font-semibold`}>
        {run.headline}
      </p>
      {withSummary && (
        <p className={`mt-2 ${compact ? 'text-sm' : 'text-lg'} leading-relaxed text-mute`}>
          {run.summary}
        </p>
      )}

      {run.techniqueSteps && (
        <ol className="mt-3 space-y-1.5 border-t border-line pt-3">
          {run.techniqueSteps.map((t, i) => (
            <li key={i} className="flex gap-2 text-base leading-snug">
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
          className={`text-sm leading-snug ${
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
        <p className="mb-1 text-sm font-medium tracking-wide text-mute uppercase">{kicker}</p>
      )}
      <p className="text-2xl leading-tight font-semibold text-crema">{s.what}</p>
      <p className="mt-2 text-lg leading-relaxed">{s.why}</p>
      <div className="mt-3 rounded-xl border border-line bg-raised p-3">
        <p className="text-xs font-medium tracking-wide text-mute uppercase">Erwartung</p>
        <p className="mt-1 text-base leading-snug">{s.expectation}</p>
      </div>
      <p className="mt-2 text-xs text-faint">Konfidenz: {s.confidence}</p>
      {s.alternative && <p className="mt-2 text-sm text-mute">{s.alternative}</p>}
      {notes && <RunNotes notes={notes} />}
      {onApply && (
        <Button className="mt-4 w-full" onClick={onApply}>
          Übernehmen und nochmal
        </Button>
      )}
    </Card>
  )
}
