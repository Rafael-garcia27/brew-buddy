/**
 * Die letzte Instanz: ein Renderfehler darf nicht in Weiß enden.
 *
 * Befund F-03. React entlädt bei einem Fehler im Renderbaum den gesamten
 * Baum — ohne Fehlergrenze bleibt ein leeres `<div id="root">` zurück. Im
 * Browser ist das ärgerlich, in der installierten PWA ist es eine
 * Sackgasse: keine Adresszeile, kein Neu-laden-Knopf, keine Reiterleiste.
 * Zu sehen ist die Hintergrundfarbe, sonst nichts.
 *
 * Der Bildschirm hier bietet drei Dinge, in dieser Reihenfolge:
 * einen Satz, der sagt was los ist; einen Weg zurück; und einen Weg, die
 * Daten herauszuholen, falls der Weg zurück nicht hilft.
 *
 * Bewusst ohne `ui.tsx`: Diese Komponente rendert in dem Moment, in dem
 * etwas anderes gerade gescheitert ist. Sie hängt deshalb an nichts außer
 * React und CSS — kein Store, keine Wissensbasis, keine Bausteine, die
 * ihrerseits etwas importieren. Die Klassen sind aus `Button` abgeschrieben;
 * das ist die eine Doppelung, die diese Datei sich leistet.
 */
import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { loadRaw, liefere } from '@/store/persist'
import { rettungsdatei, fehlerDetails } from '@/store/rescue'

/**
 * Wie oft es in dieser Sitzung schon geknallt hat.
 *
 * Steht im `sessionStorage`, weil „Neu starten" die Komponente neu
 * aufbaut und ein Zähler im Zustand damit jedes Mal bei null anfinge.
 * Genau der zweite Absturz ist aber die wichtige Information: Ein
 * einzelner kann Zufall sein, ein wiederkehrender liegt fast immer am
 * gespeicherten Bestand — und dann ist „Neu starten" der falsche Rat.
 */
const ZAEHLER = 'cafe.absturzzaehler'

function zaehleHoch(): number {
  try {
    const n = Number(sessionStorage.getItem(ZAEHLER) ?? '0') + 1
    sessionStorage.setItem(ZAEHLER, String(n))
    return n
  } catch {
    return 1
  }
}

interface State {
  error: unknown
  anzahl: number
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, anzahl: 0 }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Die App schickt nichts nach außen (Leitentscheidung: keine
    // Fremddienste). Die Konsole ist der einzige Ort, an dem der
    // Komponentenpfad überhaupt landet.
    console.error('[ErrorBoundary]', error, info.componentStack)
    this.setState({ anzahl: zaehleHoch() })
  }

  render(): ReactNode {
    if (this.state.error === null) return this.props.children
    return <Fehlerbildschirm error={this.state.error} anzahl={this.state.anzahl} />
  }
}

type Stand = 'bereit' | 'laeuft' | 'shared' | 'downloaded' | 'copied' | 'leer' | 'fehler'

const MELDUNG: Record<Stand, string> = {
  bereit: '',
  laeuft: 'Einen Moment …',
  shared: 'Rettungsdatei geteilt. Leg sie an einen Ort, den du wiederfindest.',
  downloaded: 'Rettungsdatei heruntergeladen. Leg sie an einen Ort, den du wiederfindest.',
  copied: 'Kein Speichern möglich — die Daten liegen jetzt in der Zwischenablage. Füg sie irgendwo ein und sichere sie dort.',
  leer: 'Es ist nichts gespeichert, was gerettet werden müsste.',
  fehler: 'Auch der Speicher antwortet nicht. Schließ die App und versuch es gleich noch einmal.',
}

function Fehlerbildschirm({ error, anzahl }: { error: unknown; anzahl: number }) {
  const [stand, setStand] = useState<Stand>('bereit')

  const retten = async () => {
    setStand('laeuft')
    try {
      const datei = rettungsdatei(await loadRaw(), new Date())
      if (!datei) return setStand('leer')
      setStand(await liefere(datei.json, datei.name))
    } catch {
      setStand('fehler')
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center px-6 py-10">
      <h1 className="text-3xl leading-tight font-semibold tracking-tight">
        Café ist abgestürzt.
      </h1>

      <p className="mt-3 text-xl leading-relaxed text-mute">
        Der Bildschirm ließ sich nicht mehr zeichnen. Gespeichert ist trotzdem alles, was bis
        eben eingetragen war — der Fehler betrifft die Anzeige, nicht die Daten.
      </p>

      {/* Ab dem zweiten Mal ist „Neu starten" keine ehrliche Empfehlung mehr. */}
      {anzahl >= 2 && (
        <p className="mt-3 rounded-2xl border border-bad/40 bg-bad/10 px-4 py-3 text-lg leading-relaxed">
          Das ist in dieser Sitzung schon der {anzahl}. Absturz. Dann liegt es vermutlich am
          gespeicherten Bestand, und ein Neustart führt an dieselbe Stelle. Rette zuerst die
          Daten.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-14 items-center justify-center rounded-2xl bg-crema px-6 text-xl font-semibold text-on-crema active:bg-crema/85"
        >
          Neu starten
        </button>
        <button
          type="button"
          onClick={() => void retten()}
          disabled={stand === 'laeuft'}
          className="inline-flex h-14 items-center justify-center rounded-2xl border border-line bg-raised px-6 text-xl text-ink transition-colors active:bg-line disabled:opacity-40"
        >
          Daten retten
        </button>
      </div>

      {stand !== 'bereit' && (
        <p
          role="status"
          className={`mt-3 text-base leading-snug ${
            stand === 'fehler' ? 'text-bad' : 'text-mute'
          }`}
        >
          {MELDUNG[stand]}
        </p>
      )}

      <p className="mt-6 text-sm leading-relaxed text-faint">
        Hilft der Neustart nicht, spiel im Setup deine letzte Sicherung ein.
      </p>

      {/* Zugeklappt: Der Aufrufstapel hilft beim Suchen und verunsichert
          beim Lesen. Wer ihn braucht, klappt ihn auf. */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-faint">Technische Einzelheiten</summary>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-raised p-3 text-2xs leading-relaxed whitespace-pre-wrap text-mute">
          {fehlerDetails(error)}
        </pre>
      </details>
    </div>
  )
}
