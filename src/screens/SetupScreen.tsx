/**
 * Setup — Mühle, Wasser, Datensicherung, Glossar.
 *
 * Briefing C1: Ohne kalibrierte Mühle gibt es keine Empfehlung in Klicks.
 * Briefing C5: Ohne Sicherung ist die Historie ein Safari-Aufräumlauf entfernt.
 */
import { useEffect, useState } from 'react'
import type { Route } from '@/router'
import { useStore, selectActiveGrinder, selectSnapshot, uid } from '@/store'
import type { BrewMethod } from '@domain'
import type { AppMode } from '@/domain'
import { levelForMode, PRO_FEATURES } from '@/domain'
import { GRINDER_CATALOG, GLOSSARY, termsForLevel } from '@/kb'
import { grinderFromCatalog, calibrate, suggestedSetting, formatSetting } from '@/engine/grinder'
import { METHODS, METHOD_LABEL } from '@/labels'
import { shareBackup, parseBackup, storageEstimate, requestPersistence } from '@/store/persist'
import { APP_NAME, BACKUP_REMINDER_DAYS } from '@/config'
import {
  Screen, Header, Section, Card, Button, Field, Select, Sheet, Stepper,
  Toggle, SegmentedControl, Stat, TextInput, num,
} from '@/components/ui'
import { InstallGuide } from '@/components/system'

interface Props {
  route: Route
  navigate: (r: Route) => void
  back: () => void
}

export default function SetupScreen({ route, back }: Props) {
  const s = useStore()
  const grinder = useStore(selectActiveGrinder)
  const [sheet, setSheet] = useState<null | 'grinder' | 'calibrate' | 'water' | 'glossary' | 'import'>(
    route.detail === 'grinder' ? 'grinder' : null,
  )
  const [storage, setStorage] = useState<{ usedKb: number; quotaMb: number } | null>(null)
  const [persisted, setPersisted] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const isPro = s.settings.mode === 'pro'

  useEffect(() => {
    void storageEstimate().then(setStorage)
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  const daysSinceBackup = s.settings.lastBackupAt
    ? Math.floor((Date.now() - new Date(s.settings.lastBackupAt).getTime()) / 86_400_000)
    : null
  // Eine Warnung ohne Daten wäre nur Lärm.
  const hasData = s.brews.length > 0
  const backupOverdue = hasData && (daysSinceBackup === null || daysSinceBackup > BACKUP_REMINDER_DAYS)

  const doBackup = async () => {
    const how = await shareBackup(selectSnapshot(s))
    s.setSettings({ lastBackupAt: new Date().toISOString() })
    setToast(
      how === 'shared' ? 'Sicherung geteilt.' : how === 'copied' ? 'In die Zwischenablage kopiert.' : 'Datei gespeichert.',
    )
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <Screen>
      {/* Immer ein Weg zurück: Ohne Navigationsleiste ist der Pfeil im
          Kopf der einzige. */}
      <Header title="Setup" onBack={back} />

      {/* ── Modus: der eine Schalter, ganz oben ── */}
      <Section title="Modus">
        <Card tone={isPro ? 'accent' : 'default'}>
          <SegmentedControl<AppMode>
            value={s.settings.mode}
            onChange={s.setMode}
            options={[
              { value: 'basic', label: 'Basis' },
              { value: 'pro', label: 'Pro' },
            ]}
          />
          <p className="mt-3 text-[14px] leading-snug text-mute">
            {isPro
              ? 'Alles sichtbar. Zurück auf Basis blendet die Zusätze wieder aus — deine Daten bleiben erhalten.'
              : 'Alles Nötige, nichts weiter. Pro schaltet zusätzlich frei:'}
          </p>
          {!isPro && (
            <ul className="mt-2 space-y-1.5">
              {PRO_FEATURES.map((f) => (
                <li key={f.id} className="text-[14px] leading-snug">
                  <span className="text-crema">{f.label}</span>
                  <span className="text-mute"> — {f.hint}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Section>

      {/* ── Mühle ── */}
      <Section title={s.grinders.length > 1 ? 'Mühlen' : 'Mühle'}>
        {grinder ? (
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{grinder.name}</p>
                <p className="mt-0.5 text-[13px] text-mute">
                  {num(grinder.micronPerStep)} µm pro Schritt ·{' '}
                  {grinder.confidence === 'measured'
                    ? 'selbst eingemessen'
                    : grinder.confidence === 'vendor'
                      ? 'Herstellerangabe'
                      : 'geschätzt'}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSheet('grinder')}>
                ändern
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3">
              {METHODS.map((m) => (
                <Stat
                  key={m}
                  label={METHOD_LABEL[m]}
                  value={(() => {
                    const v = suggestedSetting(grinder, m)
                    return v === null ? '—' : formatSetting(v, grinder)
                  })()}
                />
              ))}
            </div>

            {/* Zweite Mühle: Wer im Brühen-Menü umschaltet, muss hier sehen,
                dass es sie gibt und wofür sie gilt. */}
            {s.grinders
              .filter((g) => g.id !== grinder.id)
              .map((g) => (
                <div key={g.id} className="mt-4 border-t border-line pt-3">
                  <p className="text-[15px] font-medium">{g.name}</p>
                  <p className="mt-0.5 text-[13px] text-mute">
                    {g.methods?.length === 1
                      ? `Nur für ${METHOD_LABEL[g.methods[0]!]} — im Brühen-Menü umschaltbar.`
                      : 'Im Brühen-Menü umschaltbar.'}
                    {s.settings.espressoGrinderId === g.id ? ' Aktuell für Espresso gewählt.' : ''}
                  </p>
                </div>
              ))}

            {grinder.confidence !== 'measured' && (
              <div className="mt-4 rounded-xl border border-crema/30 bg-crema/5 p-3">
                <p className="text-[14px] leading-snug">
                  Diese Schrittweite ist ein Startwert. Zwei Shots reichen, um sie für{' '}
                  <em>deine</em> Mühle exakt zu bestimmen — danach kommen alle Empfehlungen in
                  echten Klicks.
                </p>
                <Button size="sm" className="mt-3" onClick={() => setSheet('calibrate')}>
                  Jetzt einmessen
                </Button>
              </div>
            )}
          </Card>
        ) : (
          <Card tone="warn">
            <p className="text-[15px] leading-snug">
              Noch keine Mühle eingerichtet. Ohne sie kann ich nur sagen „12 % gröber“ statt
              „3 Klicks gröber“.
            </p>
            <Button className="mt-3" onClick={() => setSheet('grinder')}>
              Mühle wählen
            </Button>
          </Card>
        )}
      </Section>

      {/* ── Wasser: Pro ── */}
      {isPro && (
      <Section title="Wasser">
        <Card onClick={() => setSheet('water')}>
          {s.waters[0] ? (
            <>
              <p className="font-medium">{s.waters[0].label}</p>
              <p className="mt-0.5 text-[13px] text-mute">
                GH {s.waters[0].ghMgL ?? '?'} · KH {s.waters[0].khMgL ?? '?'} mg/L
              </p>
              {(s.waters[0].khMgL ?? 0) > 80 && (
                <p className="mt-2 text-[13px] text-warn">
                  Hohe Karbonathärte — Kaffee schmeckt flach, auch wenn alles andere stimmt.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="font-medium">Wasser eintragen</p>
              <p className="mt-0.5 text-[13px] text-mute">
                Zwei Zahlen genügen. Sie erklären Fehler, die kein Mahlgrad behebt.
              </p>
            </>
          )}
        </Card>
      </Section>
      )}

      {/* ── Datensicherung ── */}
      <Section title="Datensicherung">
        <Card tone={backupOverdue ? 'warn' : 'default'}>
          <p className="text-[15px] leading-snug">
            {backupOverdue
              ? 'Deine Historie ist ungesichert. iOS löscht die Daten einer PWA nach längerer Nichtnutzung — dann ist alles Gelernte weg.'
              : !hasData
                ? 'Noch nichts zu sichern. Sobald du Brews protokollierst, erinnere ich dich hier.'
                : `Zuletzt gesichert vor ${daysSinceBackup} Tag${daysSinceBackup === 1 ? '' : 'en'}.`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={doBackup}>Sichern</Button>
            <Button variant="secondary" onClick={() => setSheet('import')}>
              Wiederherstellen
            </Button>
          </div>
          <p className="mt-3 text-[12px] text-faint">
            {s.brews.length === 1 ? '1 Brew' : `${s.brews.length} Brews`} ·{' '}
            {s.beans.length === 1 ? '1 Bohne' : `${s.beans.length} Bohnen`}
            {storage && ` · ${storage.usedKb} KB belegt`}
            {persisted ? ' · Speicher als dauerhaft markiert' : ''}
          </p>
          {!persisted && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-1 -ml-3"
              onClick={() => void requestPersistence().then(setPersisted)}
            >
              Speicher schützen →
            </Button>
          )}
        </Card>
      </Section>

      {/* ── Darstellung ── */}
      <Section title="Darstellung">
        <Card>
          <Toggle
            checked={s.settings.theme === 'dark'}
            onChange={(v) => s.setTheme(v ? 'dark' : 'light')}
            label="Dunkler Modus"
          />
          {isPro && (
            <div className="mt-2 border-t border-line pt-2">
              <Toggle
                checked={s.settings.showMeasurements}
                onChange={(v) => s.setSettings({ showMeasurements: v })}
                label="Refraktometer-Werte erfassen"
              />
              <p className="mt-1 text-[12px] text-faint">
                Blendet TDS- und Extraktionsfelder beim Tasting ein.
              </p>
            </div>
          )}
        </Card>
      </Section>

      {/* ── Gelernt ── */}
      {Object.keys(s.learned.preference).length > 0 && (
        <Section title="Was ich über dich gelernt habe">
          <div className="space-y-2">
            {(Object.entries(s.learned.preference) as [BrewMethod, { statement?: string; sampleSize: number }][]).map(
              ([m, p]) => (
                <Card key={m}>
                  <p className="text-[13px] text-mute">{METHOD_LABEL[m]}</p>
                  <p className="mt-1 text-[15px]">
                    {p.statement ??
                      `${p.sampleSize} gute ${p.sampleSize === 1 ? 'Tasse' : 'Tassen'} — noch zu wenig für ein Muster.`}
                  </p>
                </Card>
              ),
            )}
          </div>
        </Section>
      )}

      {/* ── Installation ── */}
      <Section title="App">
        <InstallGuide />
      </Section>

      {/* ── Nachschlagen: Pro ── */}
      {isPro && (
      <Section title="Nachschlagen">
        <Card onClick={() => setSheet('glossary')}>
          <p className="font-medium">Glossar</p>
          <p className="mt-0.5 text-[13px] text-mute">
            {GLOSSARY.length} Begriffe, ohne Vorwissen erklärt
          </p>
        </Card>
      </Section>
      )}

      <Section>
        <p className="px-1 text-[12px] text-faint">
          {APP_NAME} · Alle Daten bleiben auf diesem Gerät. Keine Cloud, kein Konto, kein Tracking.
        </p>
      </Section>

      {toast && (
        <div className="pb-safe fixed inset-x-4 bottom-24 z-40 rounded-2xl bg-raised px-4 py-3 text-center text-[15px] shadow-lg">
          {toast}
        </div>
      )}

      {sheet === 'grinder' && <GrinderSheet onClose={() => setSheet(null)} />}
      {sheet === 'calibrate' && <CalibrateSheet onClose={() => setSheet(null)} />}
      {sheet === 'water' && isPro && <WaterSheet onClose={() => setSheet(null)} />}
      {sheet === 'glossary' && isPro && <GlossarySheet onClose={() => setSheet(null)} />}
      {sheet === 'import' && <ImportSheet onClose={() => setSheet(null)} />}
    </Screen>
  )
}

// ── Mühlenauswahl ─────────────────────────────────────────────────────

function GrinderSheet({ onClose }: { onClose: () => void }) {
  const addGrinder = useStore((s) => s.addGrinder)
  const setSettings = useStore((s) => s.setSettings)
  const [pick, setPick] = useState(GRINDER_CATALOG[0]!.id)

  return (
    <Sheet
      title="Mühle wählen"
      onClose={onClose}
      footer={
        <Button
          className="w-full"
          size="lg"
          onClick={() => {
            const g = grinderFromCatalog(pick, uid())
            if (g) {
              const id = addGrinder(g)
              setSettings({ activeGrinderId: id })
            }
            onClose()
          }}
        >
          Übernehmen
        </Button>
      }
    >
      <Field label="Modell" hint="Nicht dabei? Nimm „Andere“ und miss danach selbst ein.">
        <Select
          value={pick}
          onChange={setPick}
          // Eine auf Espresso beschränkte Mühle als Hauptmühle zu wählen
          // ist ein naheliegender Fehlgriff — deshalb steht es dran.
          options={GRINDER_CATALOG.map((g) => ({
            value: g.id,
            label: g.methods?.length === 1 ? `${g.name} (nur Espresso)` : g.name,
          }))}
        />
      </Field>
      <p className="mt-4 text-[14px] leading-relaxed text-mute">
        Die Schrittweiten im Katalog sind Startwerte. Fertigungstoleranzen und Verschleiß
        streuen erheblich — nach dem Einmessen rechnet die App mit deinen echten Werten.
      </p>
    </Sheet>
  )
}

// ── Kalibrierung ──────────────────────────────────────────────────────

function CalibrateSheet({ onClose }: { onClose: () => void }) {
  const grinder = useStore(selectActiveGrinder)
  const update = useStore((s) => s.updateGrinder)
  const [t1, setT1] = useState(34)
  const [s1, setS1] = useState(20)
  const [t2, setT2] = useState(24)
  const [s2, setS2] = useState(24)
  const [res, setRes] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  if (!grinder) return null

  const run = () => {
    const r = calibrate({ time1S: t1, setting1: s1, time2S: t2, setting2: s2, method: 'espresso' })
    if ('error' in r) { setErr(r.error); setRes(null); return }
    update(grinder.id, { micronPerStep: r.micronPerStep, confidence: 'measured' })
    setErr(null)
    setRes(r.explanation)
  }

  return (
    <Sheet
      title="Mühle einmessen"
      onClose={onClose}
      footer={
        res ? (
          <Button className="w-full" size="lg" onClick={onClose}>Fertig</Button>
        ) : (
          <Button className="w-full" size="lg" onClick={run}>Berechnen</Button>
        )
      }
    >
      <p className="text-[15px] leading-relaxed text-mute">
        Zieh zwei Espressi mit derselben Bohne und derselben Dosis — einmal feiner, einmal
        gröber. Aus dem Zeitunterschied ergibt sich die tatsächliche Schrittweite deiner Mühle.
      </p>
      <p className="mt-2 text-[13px] text-faint">
        Wichtig: beide Shots ohne Channeling, Altersunterschied der Bohne unter drei Tagen.
      </p>

      <div className="mt-5 space-y-4">
        <div className="rounded-2xl border border-line p-3">
          <p className="mb-3 text-[13px] font-semibold text-mute">Shot 1 — feiner</p>
          <Field label="Grind-Einstellung"><Stepper value={s1} onChange={setS1} min={0} max={200} /></Field>
          <div className="mt-3"><Field label="Laufzeit"><Stepper value={t1} onChange={setT1} min={5} max={90} unit="s" /></Field></div>
        </div>
        <div className="rounded-2xl border border-line p-3">
          <p className="mb-3 text-[13px] font-semibold text-mute">Shot 2 — gröber</p>
          <Field label="Grind-Einstellung"><Stepper value={s2} onChange={setS2} min={0} max={200} /></Field>
          <div className="mt-3"><Field label="Laufzeit"><Stepper value={t2} onChange={setT2} min={5} max={90} unit="s" /></Field></div>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-bad/40 bg-bad/10 p-3 text-[14px] text-bad">{err}</div>
      )}
      {res && (
        <div className="mt-4 rounded-xl border border-ok/40 bg-ok/10 p-3">
          <p className="text-[14px] leading-snug">{res}</p>
          <p className="mt-2 text-[13px] text-mute">
            Ab jetzt kommen alle Empfehlungen in echten Klicks deiner Mühle.
          </p>
        </div>
      )}
    </Sheet>
  )
}

// ── Wasser ────────────────────────────────────────────────────────────

function WaterSheet({ onClose }: { onClose: () => void }) {
  const waters = useStore((s) => s.waters)
  const upsert = useStore((s) => s.upsertWater)
  const existing = waters[0]
  const [label, setLabel] = useState(existing?.label ?? 'Leitungswasser')
  const [gh, setGh] = useState(existing?.ghMgL ?? 68)
  const [kh, setKh] = useState(existing?.khMgL ?? 40)

  return (
    <Sheet
      title="Wasser"
      onClose={onClose}
      footer={
        <Button
          className="w-full"
          size="lg"
          onClick={() => {
            upsert({ id: existing?.id ?? uid(), label, source: 'tap', ghMgL: gh, khMgL: kh })
            onClose()
          }}
        >
          Speichern
        </Button>
      }
    >
      <p className="text-[15px] leading-relaxed text-mute">
        Zwei Werte genügen. Ein Tropfentest aus der Aquaristik kostet ein paar Euro und liefert
        beide in fünf Minuten. Ein TDS-Messgerät reicht dafür <em>nicht</em> — es misst
        Leitfähigkeit, keine Härte.
      </p>
      <div className="mt-5 space-y-4">
        <Field label="Bezeichnung"><TextInput value={label} onChange={setLabel} /></Field>
        <Field label="Gesamthärte (GH)" term="gh" hint="Zielbereich 50–80 mg/L · zieht den Geschmack aus dem Kaffee">
          <Stepper value={gh} onChange={setGh} step={5} min={0} max={400} unit="mg/L" />
        </Field>
        <Field label="Karbonathärte (KH)" term="kh" hint="Zielbereich 20–60 mg/L · über 80 schmeckt Kaffee flach">
          <Stepper value={kh} onChange={setKh} step={5} min={0} max={300} unit="mg/L" />
        </Field>
      </div>
      {kh > 80 && (
        <div className="mt-4 rounded-xl border border-warn/40 bg-warn/10 p-3 text-[14px] text-warn">
          Bei dieser Karbonathärte schmeckt Kaffee flach, auch wenn Mahlgrad und Zeit stimmen.
          Das ist die häufigste unerkannte Fehlerursache überhaupt.
        </div>
      )}
    </Sheet>
  )
}

// ── Glossar ───────────────────────────────────────────────────────────

function GlossarySheet({ onClose }: { onClose: () => void }) {
  const level = levelForMode(useStore((s) => s.settings.mode))
  const [q, setQ] = useState('')
  const terms = termsForLevel(level).filter(
    (t) => !q || t.term.toLowerCase().includes(q.toLowerCase()) || t.short.toLowerCase().includes(q.toLowerCase()),
  )
  return (
    <Sheet title="Glossar" onClose={onClose}>
      <TextInput value={q} onChange={setQ} placeholder="Suchen…" />
      <div className="mt-4 space-y-4">
        {terms.map((t) => (
          <div key={t.id} className="border-b border-line pb-4 last:border-0">
            <p className="font-semibold">
              {t.term}
              {t.unit && <span className="ml-1 text-[13px] font-normal text-mute">({t.unit})</span>}
            </p>
            <p className="mt-1 text-[15px] leading-snug">{t.short}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-mute">{t.long}</p>
          </div>
        ))}
        {terms.length === 0 && <p className="text-[15px] text-mute">Nichts gefunden.</p>}
      </div>
    </Sheet>
  )
}

// ── Wiederherstellen ──────────────────────────────────────────────────

function ImportSheet({ onClose }: { onClose: () => void }) {
  const replace = useStore((s) => s.replaceState)
  const [err, setErr] = useState<string | null>(null)

  const onFile = async (file: File) => {
    const parsed = parseBackup(await file.text())
    if ('error' in parsed) { setErr(parsed.error); return }
    if (confirm('Alle aktuellen Daten werden durch die Sicherung ersetzt. Fortfahren?')) {
      replace(parsed.state)
      onClose()
    }
  }

  return (
    <Sheet title="Wiederherstellen" onClose={onClose}>
      <p className="text-[15px] leading-relaxed text-mute">
        Wähle eine zuvor gesicherte Datei. Der aktuelle Bestand wird dabei vollständig ersetzt.
      </p>
      <label className="mt-5 flex h-32 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-line text-[15px] text-mute">
        Datei wählen
        <input
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f) }}
        />
      </label>
      {err && <p className="mt-3 text-[14px] text-bad">{err}</p>}
    </Sheet>
  )
}
