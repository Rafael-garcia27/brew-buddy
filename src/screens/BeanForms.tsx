/**
 * Die beiden Formulare: eine Bohne anlegen oder ändern, eine Tüte
 * anlegen oder ändern — samt Herkunftsauswahl.
 *
 * Herausgelöst aus `BeansScreen.tsx` (P8, Befund F-09). Sie werden von
 * zwei Seiten benutzt, vom Regal und vom Profil, und gehörten schon
 * deshalb keiner von beiden.
 *
 * Reines Verschieben, kein Verhalten geändert.
 */
import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import type { Bean, Bag, RoastLevel, Process } from '@domain'
import {
  getOrigin,
  BLEND,
  findCountry,
  originOptions,
  agtronBand,
  agtronSpan,
  AGTRON_RANGE,
} from '@/kb'

import { ROAST_LABEL, PROCESS_LABEL } from '@/labels'
import {
  Button, Field, TextInput, Select, Sheet,
  Stepper, Toggle, Chip, } from '@/components/ui'



/** Typische Anbauhöhe eines Ursprungslands, Mitte der bekannten Spanne. */
function typicalAltitude(country: string): number | null {
  const o = getOrigin(country)
  if (!o?.altitudeMasl) return null
  return Math.round((o.altitudeMasl[0] + o.altitudeMasl[1]) / 2 / 50) * 50
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
/**
 * Die Vorgabe für ein Röstdatum: vor einer Woche, nicht heute.
 *
 * „Heute" war die bequemste Vorgabe und die teuerste. Wer sie stehen
 * lässt — und das passiert, weil das Feld unten im Formular steht —, hat
 * eine Bohne im Bestand, die laut App am Kauftag geröstet wurde. Dann
 * ist die Frische falsch, das Ruhefenster ist falsch, und die App hält
 * einen ganz normalen Durchgang für einen an Tag 0.
 *
 * Eine Woche ist der ehrlichere Standardfall: Zwischen Röstung und
 * Kauftheke liegen bei Spezialitätenkaffee typischerweise fünf bis zehn
 * Tage (kb/05 §3). Wer es genau weiß, trägt es ein; wer es vergisst,
 * liegt damit näher an der Wahrheit als mit „heute".
 */
function standardRoestdatum(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

export function BeanSheet({
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
  const updateBag = useStore((s) => s.updateBag)
  const bags = useStore((s) => s.bags)
  const bearbeiten = !!bean

  /**
   * Die Tüte, auf die sich das Röstdatum beim Bearbeiten bezieht.
   *
   * Das Datum gehört zur Tüte, nicht zur Bohne — deshalb stand es beim
   * Bearbeiten bisher gar nicht da. Das war formal richtig und praktisch
   * eine Sackgasse: Wer sich beim Anlegen vertippt hat (oder die Vorgabe
   * stehen ließ), kam an die Zahl nur noch heran, indem er die Tüte
   * löschte und neu anlegte — mitsamt ihren Protokollen.
   *
   * Angeboten wird deshalb genau EINE: die neueste offene. Bei mehreren
   * gleichzeitig ist nicht entscheidbar, welche gemeint ist; wer die
   * anderen ändern will, findet sie im Profil. Steht keine offen, bleibt
   * das Feld weg — sonst schriebe es in eine leere Tüte.
   */
  const offeneTuete = useMemo(() => {
    if (!bean) return undefined
    return bags
      .filter((b) => b.beanId === bean.id && !b.depleted)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  }, [bags, bean])

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
  const [roastDate, setRoastDate] = useState(() => offeneTuete?.roastDate ?? standardRoestdatum())
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
      // Nur schreiben, wenn sich wirklich etwas geändert hat: Ein
      // Ereignis „Tüte geändert" ohne Änderung bläht den Strom auf.
      if (offeneTuete && roastDate && roastDate !== offeneTuete.roastDate) {
        updateBag(offeneTuete.id, { roastDate })
      }
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

        {/* Röstdatum und Menge gehören zur Tüte, nicht zur Bohne — beim
            Anlegen zur ersten, beim Bearbeiten zur offenen. Die Menge
            bleibt dem Anlegen vorbehalten: Sie zählt sich beim Brühen
            herunter, und ein Formularfeld, das sie zurücksetzt, wäre
            keine Korrektur, sondern ein Datenverlust. */}
        {(!bearbeiten || offeneTuete) && (
          <div className="border-t border-line pt-4">
            <p className="mb-3 text-sm font-semibold tracking-wide text-mute uppercase">
              {bearbeiten ? 'Offene Bag' : 'Erste Bag'}
            </p>
            <Field label="Roast Date" hint="Ohne dieses Datum kann ich die Frische nicht mitführen">
              <TextInput value={roastDate} onChange={setRoastDate} type="date" />
            </Field>
            {!bearbeiten && (
              <div className="mt-4">
                <Field label="Menge">
                  <Stepper value={grams} onChange={setGrams} step={50} min={50} max={2000} unit="g" />
                </Field>
              </div>
            )}
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
    <div className="mt-2 rounded-input border border-line bg-raised p-3">
      <TextInput value={eingabe} onChange={setEingabe} placeholder="z. B. Bolivien" />
      {!leer && !treffer && (
        <p className="mt-2 text-sm leading-snug text-bad">
          „{eingabe.trim()}" ist kein Land, das ich kenne. Schreib es aus — deutsch oder
          englisch, etwa „Elfenbeinküste" oder „Ivory Coast".
        </p>
      )}
      {treffer && treffer.de.toLowerCase() !== eingabe.trim().toLowerCase() && (
        <p className="mt-2 text-sm text-mute">Wird gespeichert als „{treffer.de}".</p>
      )}
      {treffer && !treffer.belt && (
        <p className="mt-2 text-sm leading-snug text-warn">
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

export function BagSheet({
  bag,
  onClose,
  onSave,
}: {
  /** Gesetzt: bearbeiten. Fehlt: anlegen. */
  bag?: Bag
  onClose: () => void
  onSave: (b: { roastDate?: string; purchasedGrams?: number; remainingGrams?: number; storage?: 'ambient' | 'frozen'; frozenAt?: string }) => void
}) {
  const bearbeiten = !!bag
  const [roastDate, setRoastDate] = useState(bag?.roastDate ?? standardRoestdatum())
  const [grams, setGrams] = useState(bag?.remainingGrams ?? bag?.purchasedGrams ?? 250)
  const [frozen, setFrozen] = useState(bag?.storage === 'frozen')

  return (
    <Sheet
      title={bearbeiten ? 'Bag bearbeiten' : 'Neuer Bag'}
      onClose={onClose}
      footer={
        <Button
          className="w-full"
          size="lg"
          onClick={() =>
            onSave(
              bearbeiten
                ? {
                    roastDate,
                    // Beim Bearbeiten wandert nur der Rest: Was
                    // ursprünglich in der Tüte war, ist Vergangenheit und
                    // hat sich nicht geändert.
                    remainingGrams: grams,
                    storage: frozen ? 'frozen' : 'ambient',
                    ...(frozen && bag?.storage !== 'frozen'
                      ? { frozenAt: new Date().toISOString() }
                      : {}),
                  }
                : {
                    roastDate,
                    purchasedGrams: grams,
                    remainingGrams: grams,
                    storage: frozen ? 'frozen' : 'ambient',
                    frozenAt: frozen ? new Date().toISOString() : undefined,
                  },
            )
          }
        >
          {bearbeiten ? 'Änderungen speichern' : 'Hinzufügen'}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Roast Date">
          <TextInput value={roastDate} onChange={setRoastDate} type="date" />
        </Field>
        <Field label={bearbeiten ? 'Rest' : 'Menge'}>
          <Stepper value={grams} onChange={setGrams} step={50} min={0} max={2000} unit="g" />
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
