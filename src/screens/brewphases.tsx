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
import type { BrewMethod, Defect, Character, SpeedFeel } from '@domain'
import { useStore } from '@/store'
import type { Diagnosis } from '@/engine/diagnose'
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
}: {
  method: BrewMethod
  run: RunCheck
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

/** Verkosten: Sterne, Fehlerbilder, beschreibende Notizen. */
export function PhaseVerkosten({
  rating,
  setRating,
  defects,
  setDefects,
  characters,
  setCharacters,
  auswerten,
}: {
  rating: number
  setRating: (n: number) => void
  defects: Defect[]
  setDefects: (f: (x: Defect[]) => Defect[]) => void
  characters: Character[]
  setCharacters: (f: (x: Character[]) => Character[]) => void
  auswerten: () => void
}) {
  return (
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
        <Button size="lg" className="w-full" disabled={rating === 0} onClick={auswerten}>
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
  )
}

/** Die Ergebnisseite — beide Stufen getrennt, damit die Herkunft sichtbar bleibt. */
export function PhaseErgebnis({
  result,
  uebernehmen,
  back,
}: {
  result: Diagnosis
  uebernehmen: Uebernehmen
  /** „Fertig" führt zurück zu den Bohnen — dieselbe Stelle wie der Kopfpfeil. */
  back: () => void
}) {
  return (
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
