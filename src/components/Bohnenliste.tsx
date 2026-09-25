/**
 * Listen — und die Bohnenzeile, die in jeder davon gleich aussieht.
 *
 * Eine Bohne stand an drei Stellen in drei Gestalten: im Regal als Zeile
 * in einer gemeinsamen Fläche, unter „Brühen" als eigene Karte mit
 * eigenem Rahmen und Frischering ohne Röstfarbe, in der Bohnenwahl als
 * dritte Variante. Wer eine davon umbaute, musste an die anderen denken,
 * und hat es nicht immer getan. Jetzt kommen alle aus dieser Datei.
 *
 *   Liste         die Fläche mit Rahmen, einmal je Gruppe
 *   ListenZeile   Haarlinie oben, optional die Wischgeste
 *   BohnenZeile   Ring, Name, Röster · Röstung · Aufbereitung, ein Hinweis
 *
 * Was sich je Bildschirm unterscheidet, ist der Hinweis unter dem Namen
 * („Am besten als V60", „gut geeignet, aber 31 Tage …") und was rechts
 * steht. Die Gestalt ist dieselbe.
 */
import type { ReactNode } from 'react'
import type { Bean } from '@domain'
import { ROAST_LABEL, PROCESS_LABEL } from '@/labels'
import SwipeReveal, { type SwipeAction } from './SwipeReveal'
import { BeanRing } from './beanviz'

/**
 * Eine Fläche, ein Rahmen, Haarlinien dazwischen.
 *
 * Nicht eine Karte je Eintrag: Neun gleiche Rahmen sagen neunmal „das
 * hier ist abgetrennt" und damit gar nichts (siehe Regal, 090d2f0).
 */
export function Liste({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-card border border-line bg-card">{children}</div>
}

/**
 * Wo die Haarlinie beginnt: am Textanfang, nicht am Rand.
 *
 * 16 px Rand + 40 px Ring + 12 px Abstand. Durchgezogen schnitte sie den
 * Ring mittendurch und machte aus der Trennung wieder eine Kiste.
 */
export const EINZUG_RING = 68

export function ListenZeile({
  children,
  zurueck,
  einzug = EINZUG_RING,
  wischen,
}: {
  children: ReactNode
  /** Tritt zurück, weil eine andere Zeile gerade aufgeklappt ist. */
  zurueck?: boolean
  /** Ab wo die Haarlinie läuft, in px vom linken Rand. */
  einzug?: number
  /** Nach links wischen legt diese Aktionen frei; ganz hinaus löst die letzte aus. */
  wischen?: { actions: SwipeAction[]; onSwipeAway?: () => void; swipeAwayLabel?: string }
}) {
  return (
    <div
      // `z-[1]`: Die Linie liegt über der Zeile, sonst deckt deren
      // deckende Fläche sie zu.
      className="relative transition-opacity duration-200 before:absolute before:top-0 before:right-4 before:left-[var(--einzug)] before:z-[1] before:h-px before:bg-line first:before:hidden"
      style={{ opacity: zurueck ? 0.38 : 1, ['--einzug' as string]: `${einzug}px` }}
    >
      {wischen ? (
        <SwipeReveal
          // Die Ecken rundet die Liste, nicht die Zeile.
          className=""
          actions={wischen.actions}
          {...(wischen.onSwipeAway ? { onSwipeAway: wischen.onSwipeAway } : {})}
          swipeAwayLabel={wischen.swipeAwayLabel ?? 'Loslassen zum Löschen'}
        >
          {children}
        </SwipeReveal>
      ) : (
        children
      )}
    </div>
  )
}

/** Wie der Hinweis unter dem Namen gefärbt ist — nach dem, was er sagt. */
export type HinweisTon = 'akzent' | 'still' | 'warn' | 'schlecht'
const TON: Record<HinweisTon, string> = {
  akzent: 'text-crema-ink',
  still: 'text-faint',
  warn: 'text-warn',
  schlecht: 'text-bad',
}

/**
 * Eine Bohne als Zeile.
 *
 * Gewählt wechselt die Fläche auf `raised` — deckend, in allen drei
 * Themen. Das ist nicht nur Optik: Unter der Zeile liegen die Knöpfe der
 * Wischgeste. „Brühen" hatte die gewählte Bohne mit `bg-crema/5` markiert,
 * zu fünf Prozent deckend, und durch die Karte schienen „Edit" und
 * „Löschen" hindurch.
 *
 * Mit `children` ist die Zeile aufgeklappt: Der Kopf bleibt der Knopf,
 * der sie wieder schließt, darunter steht, was dazukommt. Knöpfe in
 * Knöpfen wären ungültiges HTML.
 */
export function BohnenZeile({
  bean,
  score,
  tage,
  hinweis,
  hinweisTon = 'akzent',
  zusatz,
  marke,
  rechts,
  gewaehlt,
  gedimmt,
  onClick,
  children,
}: {
  bean: Bean
  /** Frische 0–100 für den Ring. */
  score: number
  /** Tage seit Röstung, `null` wenn unbekannt. */
  tage: number | null
  /** Die eine Zeile, die sagt, warum diese Bohne hier steht. */
  hinweis?: ReactNode
  hinweisTon?: HinweisTon
  /** Weitere Zeilen unter dem Hinweis, klein und still. */
  zusatz?: ReactNode
  /** Kurzes Wort hinter dem Namen: „zuletzt", „beste Wahl". */
  marke?: string
  /** Rechts in der Zeile: ›, ✓ oder ✕. */
  rechts?: ReactNode
  gewaehlt?: boolean
  /** Der Ring blass — die Bohne ist nicht im Haus. */
  gedimmt?: boolean
  onClick: () => void
  children?: ReactNode
}) {
  const offen = children !== undefined && children !== null && children !== false

  const kopf = (
    <div className="flex items-center gap-3">
      {/* Drei Angaben in einem Zeichen: Ring = Frische, Füllung =
          Röstgrad, Zahl = Tage. */}
      <div className={gedimmt ? 'opacity-40' : undefined}>
        <BeanRing
          bean={bean}
          score={score}
          label={tage !== null ? String(tage) : '?'}
          size={offen ? 48 : 40}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className={`truncate leading-tight font-semibold ${offen ? 'text-2xl' : 'text-xl'}`}>
            {bean.name}
          </p>
          {marke && <span className="shrink-0 text-2xs text-faint">{marke}</span>}
        </div>
        <p className="mt-0.5 truncate text-sm text-mute">
          {bean.roaster ? `${bean.roaster} · ` : ''}
          {ROAST_LABEL[bean.roastLevel]} · {PROCESS_LABEL[bean.process]}
        </p>
        {hinweis && <p className={`mt-1 truncate text-xs ${TON[hinweisTon]}`}>{hinweis}</p>}
        {zusatz}
      </div>
      {rechts !== undefined && (
        <span className={`shrink-0 ${gewaehlt || offen ? 'text-crema-ink' : 'text-faint'}`}>
          {rechts}
        </span>
      )}
    </div>
  )

  if (!offen) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={gewaehlt}
        className={`w-full px-4 py-3 text-left ${gewaehlt ? 'bg-raised' : 'bg-card active:bg-raised'}`}
      >
        {kopf}
      </button>
    )
  }

  return (
    <div className="bg-raised px-4 py-4">
      <button type="button" onClick={onClick} aria-expanded className="w-full text-left">
        {kopf}
      </button>
      {children}
    </div>
  )
}
