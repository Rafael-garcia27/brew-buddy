/**
 * UI-Grundbausteine.
 *
 * Keine Fremdbibliothek (Leitentscheidung E7). Natives iOS-Gefühl entsteht
 * durch Systemschrift, Safe Areas und großzügige Touchziele — nicht durch
 * ein importiertes Designsystem.
 */
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { getTerm } from '@/kb'

/**
 * Zahl in deutscher Schreibweise.
 *
 * Die App ist durchgehend deutsch; „1:2.8" neben „4,5" auf demselben
 * Bildschirm liest sich wie ein Übersetzungsfehler.
 */
export function num(v: number, decimals = 1): string {
  return v.toFixed(decimals).replace('.', ',')
}
import { useStore } from '@/store'
import { levelForMode } from '@/domain'

// ── Layout ────────────────────────────────────────────────────────────

export function Screen({ children }: { children: ReactNode }) {
  // Kein `pb-safe` hier: Die Navigationsleiste trägt es und liegt
  // darunter. Zweimal gesetzt ergäbe doppelten Rand am iPhone. Die
  // 40 px sind Luft unter dem letzten Element, keine Sicherheitszone.
  return (
    <div className="min-h-full">
      {children}
      <div className="h-10" />
    </div>
  )
}

export function Header({
  title,
  subtitle,
  right,
  onBack,
  large,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  onBack?: () => void
  /**
   * Für die Hauptoberfläche. Seit die Navigationsleiste weg ist, ist der
   * Kopf das einzige Element, das sagt, wo man ist — auf dem Startbild­
   * schirm darf er das deutlich sagen.
   */
  large?: boolean
}) {
  return (
    <header className="pt-safe sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-xl">
      {/* Feste Höhe: Der Kopf darf nicht springen, wenn ein Untertitel
          fehlt oder eine Schaltfläche dazukommt. */}
      <div className={`flex items-center gap-3 px-4 ${large ? 'h-[70px]' : 'h-[58px]'}`}>
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Zurück"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-crema active:bg-raised"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 19l-7-7 7-7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1
            className={`truncate leading-tight font-semibold tracking-tight ${
              large ? 'text-3xl' : 'text-2xl'
            }`}
          >
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-mute">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}

/**
 * Setup-Zugang im Kopf.
 *
 * Bewusst nur ein Symbol und in gedeckter Farbe: Mühle, Wasser und
 * Sicherung werden einmal eingerichtet und danach selten angefasst. Ein
 * beschrifteter Knopf würde täglich um Aufmerksamkeit bitten, die er
 * nicht braucht.
 */
export function GearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Setup"
      className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-faint active:bg-raised"
    >
      {/* Sechs kurze Strahlen um einen Kreis lesen sich als Sonne. Ein
          Zahnrad braucht die Kontur mit den Zähnen. */}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
        <circle cx="12" cy="12" r="3.2" strokeWidth="1.6" />
        <path
          d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 008.9 19a1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 8.9a1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

/**
 * Logbuch-Zugang im Kopf.
 *
 * Wie das Zahnrad ein Symbol ohne Beschriftung, aber eine Stufe
 * präsenter: Das Logbuch wird häufiger geöffnet als das Setup.
 */
export function LogButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Logbuch"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-mute active:bg-raised"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
        <path
          d="M5 4h11l3 3v13H5V4zm3 5h8M8 13h8M8 17h5"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

export function Section({
  title,
  action,
  children,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="px-4 pt-6">
      {/* Auch ohne Überschrift: Ein `action` ohne `title` verschwand
          vorher stillschweigend — in Beans war der Hinweis „nach Frische"
          deshalb nie zu sehen. Ohne Titel steht die Zusatzangabe rechts,
          wo sie auch neben einer Überschrift stünde. */}
      {(title || action) && (
        <div
          className={`mb-2 flex items-baseline gap-2 ${
            title ? 'justify-between' : 'justify-end'
          }`}
        >
          {title && (
            <h2 className="text-sm font-semibold tracking-wide text-mute uppercase">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Card({
  children,
  onClick,
  className = '',
  tone = 'default',
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
  tone?: 'default' | 'accent' | 'warn' | 'bad'
}) {
  const tones = {
    default: 'bg-card border-line',
    accent: 'bg-card border-crema/40',
    warn: 'bg-card border-warn/40',
    bad: 'bg-card border-bad/40',
  }
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={`w-full rounded-2xl border ${tones[tone]} p-4 text-left ${onClick ? 'active:scale-[0.99] transition-transform' : ''} ${className}`}
    >
      {children}
    </Comp>
  )
}

// ── Aktionen ──────────────────────────────────────────────────────────

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  type = 'button',
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  const variants = {
    primary: 'bg-crema text-on-crema font-semibold active:bg-crema/85',
    secondary: 'bg-raised text-ink border border-line active:bg-line',
    ghost: 'text-crema active:bg-raised',
    danger: 'bg-bad/15 text-bad border border-bad/30 active:bg-bad/25',
  }
  const sizes = {
    sm: 'h-11 px-3 text-base rounded-xl',
    md: 'h-12 px-5 text-xl rounded-2xl',
    lg: 'h-14 px-6 text-xl rounded-2xl',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Chip({
  label,
  active,
  onClick,
  tone = 'neutral',
}: {
  label: string
  active?: boolean
  onClick?: () => void
  tone?: 'neutral' | 'bad' | 'good'
}) {
  const base = 'min-h-11 rounded-full px-3.5 text-lg transition-colors border'
  const off = 'bg-raised border-line text-mute active:bg-line'
  const on =
    tone === 'bad'
      ? 'bg-bad/20 border-bad/50 text-bad font-medium'
      : tone === 'good'
        ? 'bg-ok/20 border-ok/50 text-ok font-medium'
        : 'bg-crema/20 border-crema/50 text-crema font-medium'
  return (
    <button type="button" onClick={onClick} className={`${base} ${active ? on : off}`}>
      {label}
    </button>
  )
}

/**
 * Eine Filterachse als waagerecht scrollende Zeile.
 *
 * Umbrechend brauchte „geeignet für" mit fünf Methoden zwei Zeilen, und
 * mit einer sechsten wären es drei — im Logbuch mit den vollen Namen
 * sogar drei bei fünf Methoden. Waagerecht bleibt es bei einer Zeile, und
 * die Chips behalten ihre 44 px Trefferfläche.
 *
 * Die Beschriftung links ist kein Schmuck: Zwei Chipzeilen übereinander
 * ohne Achsennamen sind zwei Reihen Wörter, bei denen man raten muss,
 * welche Frage sie beantworten.
 */
export function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[68px] shrink-0 text-2xs leading-tight text-faint">{label}</span>
      <div className="scroll-area -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 py-0.5">
        {children}
      </div>
    </div>
  )
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  /**
   * Ab vier Segmenten wird es auf 375 px eng, ab fünf reicht keine
   * Schriftstufe mehr: „Maschine" wurde zu „Masch…", und „AeroPress" war
   * schon vorher abgeschnitten. Ein abgeschnittenes Wort ist als
   * Beschriftung schlechter als gar keines.
   *
   * Deshalb: Wenn die Aufrufstelle Symbole mitgibt, stehen sie über einer
   * kleinen Beschriftung. Das Symbol trägt die Erkennung, das Wort
   * bestätigt sie — und beide passen bei fünf Segmenten noch nebeneinander.
   */
  const mitSymbol = options.some((o) => o.icon)
  const eng = options.length > 3
  return (
    <div className="flex gap-1 rounded-2xl bg-raised p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-current={value === o.value ? 'true' : undefined}
          className={`min-w-0 flex-1 rounded-xl px-1 transition-colors ${
            mitSymbol ? 'flex h-[52px] flex-col items-center justify-center gap-0.5' : 'h-11 truncate'
          } ${eng && !mitSymbol ? 'text-sm' : mitSymbol ? '' : 'text-lg'} ${
            value === o.value ? 'bg-crema font-semibold text-on-crema' : 'text-mute active:bg-line'
          }`}
        >
          {o.icon}
          <span className={`${mitSymbol ? 'w-full truncate text-2xs leading-none' : ''}`}>
            {o.label}
          </span>
        </button>
      ))}
    </div>
  )
}

// ── Eingaben ──────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  term,
  children,
}: {
  label: string
  hint?: string
  term?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-sm font-medium text-mute">{label}</span>
        {term && <InfoDot termId={term} />}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-line bg-raised px-3.5 py-3 text-ink outline-none focus:border-crema/60'

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    />
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`${inputCls} appearance-none`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** Große Touchziele — bedienbar mit nassen Händen (Briefing C9). */
/**
 * Zahleneingabe mit großen Touchzielen.
 *
 * Gedrückthalten beschleunigt — bei 0,1-g-Schritten wäre Einzeltippen sonst
 * unzumutbar (36 g aus 10 g heraus wären 260 Taps).
 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  unit,
  decimals = 0,
  label,
  clock = false,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
  decimals?: number
  /** Für die Beschriftung des Eingabefelds, z. B. „Dosis" */
  label?: string
  /**
   * Zeiten als m:ss statt als Sekundenzahl.
   *
   * Wer am Handfilter eine Zeit nachträgt, liest 2:48 von der Uhr ab und
   * soll nicht erst 168 ausrechnen müssen. Eingegeben werden darf beides.
   */
  clock?: boolean
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  const hold = useRef<{ timer?: number; interval?: number }>({})
  const valueRef = useRef(value)
  valueRef.current = value

  // Während des Tippens gilt der Entwurf, nicht der geklammerte Wert —
  // sonst würde aus einer begonnenen „1" sofort das Minimum.
  const [draft, setDraft] = useState<string | null>(null)
  // Deutsche Schreibweise auch im Feld selbst. Beim Tippen gilt der
  // Entwurf unverändert — commit() nimmt Komma wie Punkt entgegen.
  const anzeige = (v: number) => (clock ? fmtClock(v) : num(v, decimals))
  const shown = draft ?? anzeige(value)

  /** Eingabe zu einer Zahl: „2:48" → 168, „168" → 168, „16,2" → 16,2. */
  const parse = (raw: string): number => {
    const t = raw.trim()
    if (clock && t.includes(':')) {
      const [m, sek] = t.split(':')
      const min = Number.parseInt(m || '0', 10)
      const s2 = Number.parseInt(sek || '0', 10)
      if (Number.isFinite(min) && Number.isFinite(s2)) return min * 60 + s2
      return NaN
    }
    // Deutsche Tastatur liefert das Komma; beide Trennzeichen zulassen.
    return Number.parseFloat(t.replace(',', '.'))
  }

  const commit = (raw: string) => {
    setDraft(null)
    const n = parse(raw)
    if (Number.isFinite(n)) onChange(clamp(n))
  }

  const startHold = (dir: 1 | -1) => {
    stopHold()
    hold.current.timer = window.setTimeout(() => {
      let speed = 120
      const tick = () => {
        valueRef.current = clamp(valueRef.current + dir * step)
        onChange(valueRef.current)
        speed = Math.max(30, speed * 0.85)
        hold.current.interval = window.setTimeout(tick, speed)
      }
      tick()
    }, 400)
  }
  const stopHold = () => {
    if (hold.current.timer) clearTimeout(hold.current.timer)
    if (hold.current.interval) clearTimeout(hold.current.interval)
    hold.current = {}
  }
  useEffect(() => stopHold, [])

  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        aria-label="weniger"
        onPointerDown={() => startHold(-1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onClick={() => onChange(clamp(value - step))}
        className="h-14 w-14 shrink-0 rounded-2xl border border-line bg-raised text-2xl text-crema active:bg-line"
      >
        −
      </button>

      {/* Der Wert ist ein Eingabefeld, kein Text: Große Sprünge tippt man,
          statt vierzigmal auf Plus zu drücken. */}
      <div className="flex flex-1 items-center justify-center rounded-2xl border border-line bg-raised focus-within:border-crema">
        <input
          type="text"
          inputMode={clock ? 'numeric' : 'decimal'}
          enterKeyHint="done"
          aria-label={label}
          value={shown}
          onChange={(e) => {
            const raw = e.target.value.replace(clock ? /[^0-9:]/g : /[^0-9.,-]/g, '')
            setDraft(raw)
            // Sofort übernehmen, nicht erst beim Verlassen: Auf dem iPhone
            // schließt der erste Tipper auf „Weiter zum Verkosten" nur die
            // Tastatur — der Wert muss da längst gespeichert sein.
            // Halbfertige Eingaben („1" bei Mindestwert 5) bleiben außen vor.
            const n = parse(raw)
            if (Number.isFinite(n) && n >= min && n <= max) onChange(clamp(n))
          }}
          onFocus={(e) => {
            setDraft(anzeige(value))
            // Auswahl erst nach dem Fokusereignis, sonst hebt iOS sie auf.
            requestAnimationFrame(() => e.target.select())
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setDraft(null)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          className="tnum w-full min-w-0 border-0 bg-transparent py-4 text-center font-semibold outline-none"
          style={{ fontSize: 22 }}
        />
        {unit && <span className="pr-3 text-base text-mute">{unit}</span>}
      </div>

      <button
        type="button"
        aria-label="mehr"
        onPointerDown={() => startHold(1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onClick={() => onChange(clamp(value + step))}
        className="h-14 w-14 shrink-0 rounded-2xl border border-line bg-raised text-2xl text-crema active:bg-line"
      >
        +
      </button>
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
    >
      <span className="text-xl">{label}</span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-crema' : 'bg-line'}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
        />
      </span>
    </button>
  )
}

// ── Glossar-Tooltip ───────────────────────────────────────────────────

/**
 * Briefing: Wer „Overrun“ nicht kennt, versteht auch keine Empfehlung, die
 * das Wort benutzt. Jeder Fachbegriff bekommt deshalb ein Info-Icon.
 */
export function InfoDot({ termId }: { termId: string }) {
  const [open, setOpen] = useState(false)
  const term = getTerm(termId)
  const level = levelForMode(useStore((s) => s.settings.mode))
  if (!term) return null
  const order = { basis: 0, advanced: 1, expert: 2 }
  if (order[term.level] > order[level] + 1) return null

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label={`Was ist ${term.term}?`}
        // Der Punkt bleibt klein, die Trefferfläche wird groß: 20 px trifft
        // man mit nassen Fingern nicht zuverlässig. Das negative Margin
        // hält das Layout unverändert.
        className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center p-3"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-line text-2xs font-semibold text-mute">
          ?
        </span>
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)} title={term.term}>
          {/* Die Oberfläche zeigt den Fachbegriff, die Sätze der App
              benutzen oft das deutsche Wort. Beides gehört zusammen. */}
          {term.aka && <p className="mb-2 text-base text-faint">auch: {term.aka}</p>}
          <p className="text-xl leading-snug">{term.short}</p>
          <p className="mt-3 text-lg leading-relaxed text-mute">{term.long}</p>
          {term.warning && (
            <p className="mt-3 rounded-xl border border-warn/40 bg-warn/10 p-3 text-base text-warn">
              {term.warning}
            </p>
          )}
        </Sheet>
      )}
    </>
  )
}

// ── Overlay ───────────────────────────────────────────────────────────

/**
 * Modales Blatt von unten.
 *
 * Wird per Portal direkt an `document.body` gehängt. Das ist keine Kosmetik:
 * Ein Sheet, das innerhalb eines `<label>` gerendert wird (z. B. das
 * Glossar-Popup in einem `Field`), bekommt seine Klicks vom Label an das
 * zugehörige Formularfeld weitergereicht — die Schließen-Schaltfläche
 * reagiert dann nicht mehr. Der Portal löst das Blatt aus jedem
 * Eltern-Kontext heraus.
 *
 * Verschachtelte Blätter funktionieren dadurch ebenfalls: Portale werden in
 * Einhängereihenfolge angehängt, das zuletzt geöffnete liegt oben.
 */
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    // Zähler statt Flag: Beim Schließen eines verschachtelten Blattes darf
    // die Sperre nicht aufgehoben werden, solange das äußere noch offen ist.
    lockScroll()
    return () => {
      window.removeEventListener('keydown', onKey)
      unlockScroll()
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end" role="dialog" aria-modal="true">
      {/* `aria-hidden`: Die Fläche trägt keine Information und ist auch
          kein eigener Weg hinaus — Escape und die Schaltfläche „Schließen"
          leisten dasselbe und sind mit der Tastatur erreichbar. Ohne die
          Auszeichnung kündigt der Screenreader ein anonymes Element an,
          das er nicht bedienen kann. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="scroll-area relative max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-card">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-card px-4 py-3">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-mute active:bg-raised"
          >
            ✕
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer && <div className="pb-safe sticky bottom-0 border-t border-line bg-card px-4 py-3">{footer}</div>}
        <div className="h-safe-bottom" />
      </div>
    </div>,
    document.body,
  )
}

let scrollLocks = 0
function lockScroll() {
  scrollLocks++
  document.body.style.overflow = 'hidden'
}
function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1)
  if (scrollLocks === 0) document.body.style.overflow = ''
}

// ── Anzeige ───────────────────────────────────────────────────────────

export function Stat({
  label,
  value,
  unit,
  term,
  tone,
  hint,
}: {
  label: string
  value: string | number
  unit?: string
  term?: string
  tone?: 'ok' | 'warn' | 'bad'
  /** Kleine Zusatzzeile unter dem Wert, z. B. eine abgeleitete Größe */
  hint?: string
}) {
  const c = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : 'text-ink'
  return (
    <div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-mute">{label}</span>
        {term && <InfoDot termId={term} />}
      </div>
      <div className={`tnum text-2xl leading-tight font-semibold ${c}`}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-normal text-mute">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
    </div>
  )
}

export interface TriadItem {
  label: string
  value: string
  unit?: string
  term?: string
  hint?: string
  tone?: 'ok' | 'warn' | 'bad'
  /**
   * Gesetzt: Der Wert ist einstellbar und wird antippbar.
   *
   * Der Weg zum Anpassen lag vorher als eigener Knopf weit unter dem
   * Vorschlag — man musste erst scrollen, um zu erfahren, dass sich
   * überhaupt etwas ändern lässt. Die Zahl selbst ist der nächstliegende
   * Ort dafür: Wer sie ändern will, tippt sie an.
   */
  onEdit?: () => void
}

/**
 * Die drei Zahlen, um die es geht — nebeneinander und groß.
 *
 * Vorher standen Dose, Yield, Ratio, Temp, Mahlgrad und Zielzeit als sechs
 * gleich große Kacheln im Startpunkt. Sechs gleichrangige Zahlen sind keine
 * Hierarchie, sondern eine Liste: Man liest sie der Reihe nach, statt die
 * drei zu greifen, die an der Maschine gebraucht werden. In, Time und Out
 * sind das Rezept; alles andere ist Beiwerk und gehört kleiner darunter.
 */
export function Triad({ items }: { items: TriadItem[] }) {
  return (
    <div className="grid grid-cols-3 divide-x divide-line">
      {items.map((it) => {
        const c =
          it.tone === 'ok'
            ? 'text-ok'
            : it.tone === 'warn'
              ? 'text-warn'
              : it.tone === 'bad'
                ? 'text-bad'
                : 'text-ink'
        // Ein Zielband wie „3:15–4:00" ist dreimal so lang wie „18,0" und
        // würde in einem Drittel der Breite umbrechen. Die Zahl bestimmt
        // ihre Größe deshalb selbst.
        // Die Schwellen sind auf 375 px nachgemessen: In ein Drittel der
        // Kartenbreite passen rund 98 px. „18,0" braucht bei 29 px schon
        // 98, „2:30–3:00" bei 19 px genau 94 — deshalb für die langen
        // Uhrzeitspannen eine Stufe kleiner, sonst bricht die Zeile.
        const groesse =
          it.value.length >= 9 ? 'text-xl' : it.value.length >= 5 ? 'text-2xl' : 'text-3xl'

        const zahl = (
          <>
            <div className={`tnum mt-1.5 leading-none font-semibold ${groesse} ${c}`}>
              {it.value}
              {it.unit && <span className="ml-0.5 text-xs font-normal text-mute">{it.unit}</span>}
            </div>
            {it.hint && <div className="mt-1 text-2xs leading-tight text-faint">{it.hint}</div>}
          </>
        )

        return (
          <div key={it.label} className="min-w-0 px-0.5 text-center first:pl-0 last:pr-0">
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xs font-medium tracking-wider text-mute uppercase">
                {it.label}
              </span>
              {it.term && <InfoDot termId={it.term} />}
            </div>
            {it.onEdit ? (
              /**
               * Die gepunktete Linie unter der Zahl ist der ganze Hinweis.
               *
               * Ein Stiftsymbol neben jeder der drei Zahlen wäre dreimal
               * dasselbe Zeichen in einer Reihe, in der sonst nur Zahlen
               * stehen — und würde die Ziffern schmaler machen. Eine
               * Unterstreichung sagt „daran lässt sich drehen", ohne
               * Platz zu kosten.
               */
              <button
                type="button"
                onClick={it.onEdit}
                aria-label={`${it.label} anpassen`}
                className="w-full border-b border-dashed border-crema/45 pb-1 active:opacity-60"
              >
                {zahl}
              </button>
            ) : (
              zahl
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Die Werte, die stimmen müssen, aber nicht im Blick stehen müssen.
 *
 * Temperatur, Ratio und Mahlgrad sind eingestellt und ändern sich während
 * eines Durchgangs nicht. Sie gehören in eine Zeile, nicht in Kacheln.
 */
export function MetaRow({
  items,
}: {
  items: {
    label: string
    value: string
    term?: string
    tone?: 'ok' | 'warn' | 'bad'
    /** Ein Wort dahinter, wenn der Wert keine Einstellung ist. */
    hint?: string
    /** Gesetzt: einstellbar, also antippbar — wie bei `Triad`. */
    onEdit?: () => void
  }[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {items.map((it) => {
        const wert = (
          <span
            className={`tnum font-medium ${
              it.tone === 'ok'
                ? 'text-ok'
                : it.tone === 'warn'
                  ? 'text-warn'
                  : it.tone === 'bad'
                    ? 'text-bad'
                    : 'text-mute'
            }`}
          >
            {it.value}
          </span>
        )
        return (
          <span key={it.label} className="inline-flex items-baseline gap-1 text-sm">
            <span className="text-faint">{it.label}</span>
            {it.onEdit ? (
              <button
                type="button"
                onClick={it.onEdit}
                aria-label={`${it.label} anpassen`}
                className="border-b border-dashed border-crema/45 active:opacity-60"
              >
                {wert}
              </button>
            ) : (
              wert
            )}
            {it.hint && <span className="text-2xs text-faint">{it.hint}</span>}
            {it.term && <InfoDot termId={it.term} />}
          </span>
        )
      })}
    </div>
  )
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="px-4 py-16 text-center">
      <p className="text-xl font-medium">{title}</p>
      <p className="mx-auto mt-2 max-w-[34ch] text-lg leading-relaxed text-mute">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

/** Frische-Ring: Zustand einer Tüte auf einen Blick */
export function FreshnessRing({
  score,
  size = 36,
  label,
}: {
  score: number
  size?: number
  label?: string
}) {
  // Die Strichstärke wächst mit dem Ring. Fest auf 3 sah er bei 74 px
  // aus wie ein Haar; bei 36 px stimmen die 3 weiterhin.
  const dicke = Math.max(3, Math.round(size / 14))
  const r = (size - dicke - 2) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score))
  const color = pct > 65 ? 'var(--c-ok)' : pct > 35 ? 'var(--c-warn)' : 'var(--c-bad)'
  const style: CSSProperties = { transform: 'rotate(-90deg)' }
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={style} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-line)" strokeWidth={dicke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={dicke}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
        />
      </svg>
      {label && (
        <span
          className="tnum absolute inset-0 flex flex-col items-center justify-center font-semibold"
          style={{ fontSize: Math.max(11, Math.round(size / 3.6)) }}
        >
          {label}
        </span>
      )}
    </div>
  )
}

/**
 * Laufende Zeit als Uhr: immer m:ss, auch unter einer Minute.
 *
 * Am Handfilter steht man zwei bis drei Minuten und liest die Zeit
 * mehrfach ab — „0:45" ordnet sich sofort ein, „45" muss man erst
 * gegen die Zielzeit umrechnen. Beim Espresso bleibt es bei nackten
 * Sekunden: Ein Shot dauert nie eine Minute.
 */
export function fmtClock(s: number): string {
  const ganz = Math.max(0, Math.round(s))
  return `${Math.floor(ganz / 60)}:${String(ganz % 60).padStart(2, '0')}`
}
