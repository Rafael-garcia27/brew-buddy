/**
 * Die zwei Bohnenwerte, die eine Grafik verdienen.
 *
 * Röstgrad und Aufbereitung stehen in dieser App seit dem ersten Tag als
 * Wort in einer Kachel — „Medium", „Washed". Das ist korrekt und sagt
 * nichts: Ein Wort ohne Skala hat keine Nachbarn, man sieht nicht, ob
 * „Medium" nah an hell oder nah an dunkel liegt.
 *
 * Beide bekommen hier eine Skala, und zwar nur, weil es sie fachlich
 * wirklich gibt:
 *
 *   Röstgrad     → Agtron, Infrarot-Reflexion des Mahlguts, 25–95
 *                  (kb/05 §2.1). Eine Messgröße, keine Meinung.
 *   Aufbereitung → verbleibende Mucilage beim Trocknen, 0–100 %
 *                  (kb/04 §4.3). Die Achse hinter Washed → Honey → Natural.
 *
 * Wo die Achse nicht greift, wird auch keine gezeichnet: Anaerob und Wet
 * Hulled liegen nicht auf der Mucilage-Achse, sondern auf der
 * Fermentations- bzw. Schälachse. Für die eine Zahl, die dort fehlt,
 * einen Mittelwert zu erfinden, wäre der bequemere und falsche Weg.
 *
 * Und die Röstskala unterscheidet gemessen von geschätzt. kb/05 §2.1
 * sagt ausdrücklich, warum: Etikettenbezeichnungen sind nicht
 * standardisiert und streuen zwischen Röstern um bis zu zwei Stufen. Ein
 * aufgedrucktes „Medium" ist also ein Bereich, kein Punkt — und wird als
 * Bereich gezeichnet.
 */
import type { Bean, Process, RoastLevel } from '@domain'
import {
  AGTRON_BANDS,
  AGTRON_RANGE,
  agtronBand,
  agtronBandIndex,
  agtronSpan,
  displayBandFor,
  mucilagePct,
  processFamily,
} from '@/kb'
import { ROAST_LABEL, PROCESS_LABEL } from '@/labels'

// ── Röstskala ─────────────────────────────────────────────────────────

/** Agtron → Position auf der Skala, 0 = hell (links), 1 = dunkel. */
function lage(agtron: number): number {
  const [lo, hi] = AGTRON_RANGE
  const geklemmt = Math.min(hi, Math.max(lo, agtron))
  return (hi - geklemmt) / (hi - lo)
}

export type RoastReading =
  | { kind: 'measured'; agtron: number; band: (typeof AGTRON_BANDS)[number]; from: number; to: number }
  | { kind: 'estimated'; level: RoastLevel; from: number; to: number }

/**
 * Was die App über den Röstgrad dieser Bohne wirklich weiß.
 *
 * Ausgelagert und exportiert, weil es der prüfbare Teil ist: Ob der
 * Zeiger richtig sitzt, entscheidet diese Funktion, nicht das SVG.
 */
export function roastReading(bean: Pick<Bean, 'roastLevel' | 'agtron'>): RoastReading {
  if (typeof bean.agtron === 'number' && Number.isFinite(bean.agtron)) {
    const x = lage(bean.agtron)
    return { kind: 'measured', agtron: bean.agtron, band: agtronBand(bean.agtron), from: x, to: x }
  }
  const [lo, hi] = agtronSpan(bean.roastLevel)
  // hi ist der hellere Wert und liegt damit LINKS.
  return { kind: 'estimated', level: bean.roastLevel, from: lage(hi), to: lage(lo) }
}

/**
 * Maße des Skalenkörpers, in SVG-Einheiten.
 *
 * Die Bohnen stehen um 20° gedreht — eine gedrehte Ellipse braucht
 * senkrecht mehr Platz als ihre halbe Höhe: rx·sin20 + ry·cos20. Für die
 * größte Form, die vorkommt (die hervorgehobene Bohne samt Ring), sind
 * das 55 Einheiten, und BOHNE_Y, ZEIGER_Y und BOX_H sind daraus
 * gerechnet, nicht geschätzt. Zuerst war die obere Bohnenspitze
 * abgeschnitten, dann schnitt der Ring in den Zeiger.
 */
const BOX_B = 700
const BOX_H = 146
const SLOT = BOX_B / AGTRON_BANDS.length
const RX = SLOT * 0.25
const RY = SLOT * 0.34
/** Abstand des Auswahlrings zur Bohne, in denselben Einheiten. */
const RING_LUFT = 5
const BOHNE_Y = 58
const ZEIGER_Y = 128

export function RoastScale({ bean }: { bean: Pick<Bean, 'roastLevel' | 'agtron'> }) {
  const lesung = roastReading(bean)
  const gemessen = lesung.kind === 'measured'
  // Der Zeiger darf nicht am Rand halb aus dem Bild laufen.
  const grenze = (x: number) => Math.min(BOX_B - 9, Math.max(9, x))
  const x0 = grenze(lesung.from * BOX_B)
  const x1 = grenze(lesung.to * BOX_B)

  const begriff = gemessen ? lesung.band.label : ROAST_LABEL[lesung.level]
  const spanne = gemessen ? null : agtronSpan(lesung.level)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] text-mute">Röstung</p>
          <p className="text-[20px] leading-tight font-semibold">{begriff}</p>
        </div>
        <p className="shrink-0 text-right text-[12px] leading-snug">
          {gemessen ? (
            <>
              <span className="tnum font-semibold text-crema">Agtron {lesung.agtron}</span>
              <br />
              <span className="text-faint">gemessen</span>
            </>
          ) : (
            <>
              <span className="tnum text-mute">
                Agtron {spanne![0]}–{spanne![1]}
              </span>
              <br />
              <span className="text-faint">laut Etikett</span>
            </>
          )}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${BOX_B} ${BOX_H}`}
        className="mt-2 block w-full"
        role="img"
        aria-label={
          gemessen
            ? `Röstskala von hell nach dunkel, Agtron ${lesung.agtron} gemessen — ${begriff}`
            : `Röstskala von hell nach dunkel, Bereich ${begriff} laut Etikett`
        }
      >
        {/* Die sieben Bänder als Bohnen, hell nach dunkel — immer alle
            sieben in ihrer echten Farbe. Jede mit Kontur: Die äußeren
            Töne haben zum Kartenhintergrund nur rund 2:1 Kontrast und
            wären ohne Linie keine Form mehr. */}
        {AGTRON_BANDS.map((b, i) => {
          const cx = SLOT * (i + 0.5)
          /**
           * Getroffen oder nicht — über die Bandkennung, nicht über
           * Koordinaten. Ein Agtron von genau 65 liegt geometrisch
           * exakt auf der Kante zweier Bänder und hätte beide
           * hervorgehoben; fachlich gehört er nur zu Medium-Light.
           */
          const innen = gemessen ? b === lesung.band : b.level === lesung.level
          /**
           * Die Auswahl wird größer, die anderen werden nicht blasser.
           *
           * Zuerst standen die nicht getroffenen Bohnen auf opacity 0.4.
           * Damit mischt sich der helle Kartenhintergrund in sie hinein —
           * das dunkelste Band sah heller aus als das getroffene in der
           * Mitte. Eine Skala von hell nach dunkel, die in der Mitte am
           * dunkelsten ist, sagt das Gegenteil von dem, was sie
           * behauptet. Die sieben Töne SIND die Skala und müssen immer
           * stimmen; hervorgehoben wird über Größe und Kontur.
           */
          const f = innen ? 1.16 : 1
          return (
            <g key={b.label} transform={`rotate(-20 ${cx} ${BOHNE_Y})`}>
              {/* Der Ring der Auswahl, mit Abstand zur Bohne.
                  Direkt auf der Bohne war er unsichtbar: Crema (#8c5a2b)
                  und das Medium-Band (#935f32) sind fast derselbe Ton —
                  mitten auf der Skala verschwand die Markierung genau
                  dort, wo sie am häufigsten steht. Die breite Linie in
                  Kartenfarbe schneidet erst eine Lücke, in der die
                  schmale Akzentlinie dann auf jedem Untergrund liegt. */}
              {innen && (
                <>
                  <ellipse
                    cx={cx}
                    cy={BOHNE_Y}
                    rx={RX * f + RING_LUFT}
                    ry={RY * f + RING_LUFT}
                    fill="none"
                    stroke="var(--c-card)"
                    strokeWidth="6"
                  />
                  <ellipse
                    cx={cx}
                    cy={BOHNE_Y}
                    rx={RX * f + RING_LUFT}
                    ry={RY * f + RING_LUFT}
                    fill="none"
                    stroke="var(--c-crema)"
                    strokeWidth="2.5"
                  />
                </>
              )}
              <ellipse
                cx={cx}
                cy={BOHNE_Y}
                rx={RX * f}
                ry={RY * f}
                fill={`var(--c-roast-${i + 1})`}
                stroke="var(--c-line)"
                strokeWidth="1.5"
              />
              {/* Die Naht — ohne sie ist es ein Oval, keine Bohne.
                  Ihre Farbe wird aus der Bohne selbst gemischt, nicht
                  nach ihrer Position gewählt. Zuerst stand hier „die
                  ersten vier dunkel, die letzten drei hell": In der
                  hellen Palette stimmte das, in der dunklen ist
                  --c-ink creme und --c-paper fast schwarz — die Regel
                  kippte, und die Naht verschwand auf genau den Bohnen,
                  auf denen sie eben noch zu sehen war. Ein Anteil Ink
                  im eigenen Ton dagegen läuft in beiden Paletten in die
                  richtige Richtung: dort dunkler, hier heller. */}
              <path
                d={`M${cx} ${BOHNE_Y - RY * f * 0.94}c${-RX * f * 0.47} ${RY * f * 0.5}${-RX * f * 0.47} ${RY * f * 1.4} 0 ${RY * f * 1.88}`}
                fill="none"
                stroke={`color-mix(in oklab, var(--c-roast-${i + 1}) 55%, var(--c-ink))`}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          )
        })}

        {gemessen ? (
          // Ein Messwert ist ein Punkt: Zeiger auf die Stelle.
          <g fill="var(--c-crema)">
            <path d={`M${x0} ${ZEIGER_Y - 13}l7.5 13h-15z`} />
            <rect x={x0 - 1.5} y={ZEIGER_Y} width="3" height="14" rx="1.5" />
          </g>
        ) : (
          // Eine Etikettenangabe ist ein Bereich: Balken über die Spanne.
          <g>
            <rect
              x={Math.min(x0, x1) + 4}
              y={ZEIGER_Y - 4}
              width={Math.max(Math.abs(x1 - x0) - 8, 12)}
              height="8"
              rx="4"
              fill="var(--c-crema)"
              fillOpacity="0.5"
            />
            {[Math.min(x0, x1) + 4, Math.max(x0, x1) - 4].map((x) => (
              <rect
                key={x}
                x={x - 1.5}
                y={ZEIGER_Y - 12}
                width="3"
                height="24"
                rx="1.5"
                fill="var(--c-crema)"
              />
            ))}
          </g>
        )}
      </svg>

      <div className="flex items-baseline justify-between text-[11px] text-faint">
        <span>hell</span>
        <span>dunkel</span>
      </div>

      <p className="mt-2 text-[12px] leading-snug text-mute">
        {gemessen
          ? lesung.band.context
          : 'Etikettenbezeichnungen sind nicht standardisiert und streuen zwischen Röstern um bis zu zwei Stufen — deshalb ein Bereich und kein Punkt. Ein gemessener Agtron-Wert wäre genauer.'}
      </p>
    </div>
  )
}

// ── Aufbereitung ──────────────────────────────────────────────────────

/**
 * Die Familiensymbole, im Strichstil der App.
 *
 * Eines pro Familie, nicht eines pro Verfahren: Ein eigenes Zeichen für
 * Yellow und Red Honey wäre eine Unterscheidung, die man auf 24 px nicht
 * sieht — und die fürs Brühen auch keine ist.
 */
function ProcessSymbol({ symbol, className = '' }: { symbol: string; className?: string }) {
  const gemein = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {symbol === 'drop' && (
        // Wassertropfen: das Fruchtfleisch ist weggewaschen.
        <path d="M12 3.5c0 0-6.5 7.2-6.5 11a6.5 6.5 0 0013 0c0-3.8-6.5-11-6.5-11z" {...gemein} />
      )}
      {symbol === 'half' && (
        // Bohne, halb von Fruchtfleisch bedeckt.
        <g {...gemein}>
          <ellipse cx="12" cy="12" rx="6" ry="8.5" />
          <path d="M12 3.5c-2.7 4-2.7 13 0 17" />
          <path
            d="M12 3.5a6 8.5 0 000 17z"
            fill="currentColor"
            fillOpacity="0.32"
            stroke="none"
          />
        </g>
      )}
      {symbol === 'cherry' && (
        // Ganze Kirsche mit Stiel: nichts entfernt.
        <g {...gemein}>
          <circle cx="12" cy="14.5" r="6.5" />
          <path d="M12 8V5.2c0-1 .7-1.9 1.7-2.1L16 2.6" />
        </g>
      )}
      {symbol === 'flask' && (
        // Gärgefäß: gesteuerte Fermentation.
        <g {...gemein}>
          <path d="M9.5 3h5v4.4l4.2 9.6a2.4 2.4 0 01-2.2 3.4H7.5a2.4 2.4 0 01-2.2-3.4L9.5 7.4z" />
          <path d="M7.2 14h9.6" />
          <circle cx="11" cy="17" r="1.1" />
          <circle cx="14.3" cy="16.2" r=".8" />
        </g>
      )}
      {symbol === 'husk' && (
        // Bohne mit abgehobener Pergaminhaut: früh geschält.
        <g {...gemein}>
          <ellipse cx="13" cy="13" rx="5.2" ry="7.4" />
          <path d="M13 5.6c-2.3 3.5-2.3 11.3 0 14.8" />
          <path d="M8.4 6.6C6.2 8 4.8 10.4 4.8 13c0 2.3 1 4.4 2.8 5.8" strokeOpacity="0.55" />
        </g>
      )}
    </svg>
  )
}

export function ProcessMark({ process }: { process: Process }) {
  const familie = processFamily(process)
  const pct = mucilagePct(process)
  const spanne = familie.mucilagePct

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="shrink-0 text-crema">
          <ProcessSymbol symbol={familie.symbol} className="h-9 w-9" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-mute">Aufbereitung</p>
          <p className="text-[20px] leading-tight font-semibold">{PROCESS_LABEL[process]}</p>
          {/* Der Familienname nur, wenn er nicht schon dasteht: Bei
              „Washed" wäre „Washed · Washed" reine Wiederholung. */}
          <p className="mt-0.5 text-[13px] leading-snug text-mute">
            {familie.label !== PROCESS_LABEL[process] && (
              <span className="text-faint">{familie.label} · </span>
            )}
            {familie.short}
          </p>
        </div>
      </div>

      {pct !== null && spanne ? (
        <div className="mt-3">
          <p className="text-[11px] text-faint">Fruchtkontakt beim Trocknen</p>
          {/* Der Punkt sitzt auf dem Wert, nicht daneben: Das Gleis wird
              um seinen Radius eingerückt, sonst hängt er bei 0 % und
              100 % zur Hälfte außerhalb. */}
          <div className="relative mt-1.5 h-2 rounded-full bg-line">
            <div className="absolute inset-y-0 left-[7px] right-[7px]">
              {/* Die Spanne der Familie als Fläche, der Wert dieses
                  Verfahrens als Punkt darin. Bei Washed und Natural sind
                  beide identisch — das ist keine Ungenauigkeit, dort IST
                  die Familie ein Punkt. */}
              <div
                className="absolute inset-y-0 rounded-full bg-crema/25"
                style={{
                  left: `${spanne[0]}%`,
                  width: `${Math.max(spanne[1] - spanne[0], 2)}%`,
                }}
              />
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-crema"
                style={{ left: `${pct}%` }}
              />
            </div>
          </div>
          <div className="mt-1 flex justify-between text-[11px]">
            <span className={pct === 0 ? 'font-medium text-mute' : 'text-faint'}>gewaschen</span>
            {pct > 0 && pct < 100 && <span className="tnum text-mute">{pct} %</span>}
            <span className={pct === 100 ? 'font-medium text-mute' : 'text-faint'}>
              ganze Kirsche
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-3 border-t border-line pt-2.5 text-[12px] leading-snug text-faint">
          Liegt nicht auf der Fruchtkontakt-Achse von Washed bis Natural — hier entscheidet
          {familie.id === 'wet-hulled' ? ' der Zeitpunkt des Schälens' : ' die Fermentation'}.
        </p>
      )}

      <p className="mt-2.5 text-[13px] leading-snug text-mute">{familie.brewNote}</p>
    </div>
  )
}

// ── Trockene Fakten ───────────────────────────────────────────────────

export interface Fact {
  label: string
  value: string
}

/**
 * Die Tabelle für alles, was nur nachzuschlagen ist.
 *
 * Bewusst schmucklos. Name, Röster, Höhe und Varietät sind Angaben, die
 * man sucht, wenn man sie braucht — sie tragen keine Empfehlung und
 * keine Skala. Als Kacheln standen sie vorher gleichrangig neben dem
 * Röstgrad und haben ihm den Platz genommen.
 */
export function FactTable({ facts }: { facts: Fact[] }) {
  if (!facts.length) return null
  return (
    <dl className="divide-y divide-line">
      {facts.map((f) => (
        <div key={f.label} className="flex items-baseline gap-4 py-2 first:pt-0 last:pb-0">
          <dt className="w-28 shrink-0 text-[13px] text-mute">{f.label}</dt>
          <dd className="min-w-0 flex-1 text-[14px] leading-snug">{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// ── Bohne im Ring ─────────────────────────────────────────────────────

/**
 * Drei Angaben in einem Element, an der Stelle, an der bisher eine stand.
 *
 * Der Wunsch war „Kaffeebohnen als Buttons". Die Falle daran ist bekannt:
 * Eine bohnenförmige Schaltfläche ist beim ersten Mal charmant und beim
 * zwanzigsten unbrauchbar — in eine Bohnenform passt kein Name, und ein
 * Regal ohne Namen ist ein Ratespiel. Zwölf gleich aussehende Bohnen sind
 * schlechter als zwölf Zeilen.
 *
 * Deshalb bleibt die Zeile eine Zeile, und die Bohne ersetzt nur den
 * Frischering an ihrem Anfang. Dort trägt sie drei Dinge statt einem:
 *
 *   Ring     = Frische, 0–100, wie bisher
 *   Füllung  = Röstgrad, in der Farbe seines Agtron-Bandes
 *   Zahl     = Tage nach Röstung
 *
 * Die Zahl liegt auf der Füllung, und das war der schwierige Teil. Erster
 * Versuch: Füllung auf 40 % Deckkraft, damit die normale Textfarbe in
 * beiden Paletten reicht. Damit war der Kontrast in Ordnung und der
 * Röstgrad weg — „Light" und „Dark" sahen beide beige aus, und die
 * Information, um die es ging, war die einzige, die fehlte.
 *
 * Jetzt füllt der Ton voll, und die Zahl bekommt einen Rand in
 * Kartenfarbe (`paintOrder: stroke`). Ein Halo hängt nicht davon ab, wie
 * dunkel der Untergrund ist — es funktioniert auf jedem Ton und in beiden
 * Paletten. Eine Regel nach Bandnummer hätte das nicht geschafft: In der
 * hellen Palette ist das dunkelste Band das kritische, in der dunklen das
 * hellste, und welches das ist, weiß das Stylesheet, nicht dieser Code.
 */
export function BeanRing({
  bean,
  score,
  label,
  size = 40,
}: {
  bean: Pick<Bean, 'roastLevel' | 'agtron'>
  /** Frische 0–100 */
  score: number
  /** Was in der Bohne steht, meist die Tage nach Röstung. */
  label?: string
  size?: number
}) {
  const lesung = roastReading(bean)
  const band = lesung.kind === 'measured' ? lesung.band : displayBandFor(lesung.level)
  const ton = `var(--c-roast-${agtronBandIndex(band) + 1})`

  const r = (size - 5) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score))
  const ringFarbe = pct > 65 ? 'var(--c-ok)' : pct > 35 ? 'var(--c-warn)' : 'var(--c-bad)'

  // Die Bohne füllt den Innenraum des Rings, nicht das ganze Feld.
  const rx = r * 0.66
  const ry = r * 0.9
  const m = size / 2

  return (
    <div className="shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`${band.label}, Frische ${Math.round(pct)} von 100${
          label ? `, ${label} Tage` : ''
        }`}
      >
        <g transform={`rotate(-24 ${m} ${m})`}>
          <ellipse cx={m} cy={m} rx={rx} ry={ry} fill={ton} />
          {/* Die Naht aus dem eigenen Ton gemischt — dieselbe Lösung wie
              in der Röstskala, aus demselben Grund. */}
          <path
            d={`M${m} ${m - ry * 0.9}c${-rx * 0.5} ${ry * 0.5}${-rx * 0.5} ${ry * 1.3} 0 ${ry * 1.8}`}
            fill="none"
            stroke={`color-mix(in oklab, ${ton} 55%, var(--c-ink))`}
            strokeWidth="1.4"
          />
        </g>

        {/* Der Ring um 90° gedreht, damit er wie bisher oben beginnt: Er
            ist ein bekanntes Element und soll sich nicht anders verhalten,
            nur weil jetzt etwas darin liegt. */}
        <g transform={`rotate(-90 ${m} ${m})`}>
          <circle cx={m} cy={m} r={r} fill="none" stroke="var(--c-line)" strokeWidth="3" />
          <circle
            cx={m}
            cy={m}
            r={r}
            fill="none"
            stroke={ringFarbe}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`}
          />
        </g>

        {label && (
          <text
            x={m}
            y={m}
            textAnchor="middle"
            dominantBaseline="central"
            className="tnum"
            fontSize={size * 0.28}
            fontWeight="600"
            fill="var(--c-ink)"
            stroke="var(--c-card)"
            // 2,4 statt 3: Ein breiterer Rand liest sich zwar noch besser,
            // frisst aber die Bohnenfläche auf, die er lesbar machen soll.
            strokeWidth="2.4"
            strokeLinejoin="round"
            style={{ paintOrder: 'stroke' }}
          >
            {label}
          </text>
        )}
      </svg>
    </div>
  )
}
