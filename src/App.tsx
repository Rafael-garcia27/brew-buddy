/**
 * Zwei Einstiege, weil die App zwei Fragen beantwortet.
 *
 *   Brew   — „Ich will einen V60 machen, welche Bohne nehme ich?"
 *   Coffee — „Ich habe diese Bohne, wie brühe ich sie am besten?"
 *
 * Beide sind vollwertige Startpunkte. Eine Zeit lang war Coffee (damals
 * „Beans") der einzige, mit der Begründung: drei von vier Reiterzielen
 * ergeben nur mit einer bestimmten Bohne Sinn. Für Profil und Log gilt
 * das weiter — deshalb sind sie keine Reiter, sondern Ziele. Fürs Brühen
 * gilt es nicht, sobald die Methode selbst der Anfang ist.
 *
 * Setup gehört keiner Bohne und keiner Methode und sitzt hinter dem
 * Zahnrad. Das Logbuch über alle Bohnen hängt am Kopf von Coffee: Dort
 * steht die Frage „was habe ich schon gebrüht?" am nächsten.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useRouter, beanOf, methodOf, type Tab } from './router'
import { useStore } from './store'
import type { BeanTrash } from './domain'
import type { BrewMethod } from '@domain'
import { METHOD_IDS } from './kb'
import { UndoBar, StorageErrorBar, UpdateToast } from './components/system'
import { Bereichsgrenze } from './components/ErrorBoundary'
import HeuteScreen from './screens/HeuteScreen'
import BrewScreen from './screens/BrewScreen'
import MethodPicker from './screens/MethodPicker'
import BeanPicker from './screens/BeanPicker'
import BeansScreen from './screens/BeansScreen'
import { BeanDetail } from './screens/BeanDetail'
import LogScreen from './screens/LogScreen'
import SetupScreen from './screens/SetupScreen'

const REITER: { id: Tab; label: string; icon: ReactElement }[] = [
  {
    id: 'heute',
    // Der Reiter heißt nach dem, was man dort tut, nicht nach dem
    // Zeitpunkt. „Heute" beschrieb die Sortierung; gemeint war immer der
    // Weg zur Tasse. Die Kennung bleibt `heute` — sie steht in
    // gespeicherten Routen und in `lastMethod`-Verweisen.
    label: 'Brühen',
    icon: (
      <path
        d="M6 9h11a3 3 0 010 6h-1M6 9v5a5 5 0 005 5h0a5 5 0 005-5V9M6 9H5m1-4v1m4-1v1m4-1v1M4 21h14"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: 'coffee',
    label: 'Regal',
    icon: (
      // Kaffeebohne: Ellipse mit der Naht auf der Längsachse. Beide in
      // EINER gedrehten Gruppe — vorher war nur die Ellipse gedreht und
      // die Naht lief quer über sie hinweg.
      <g transform="rotate(-30 12 12)">
        <ellipse cx="12" cy="12" rx="6" ry="9" strokeWidth="1.8" />
        <path d="M12 3.2c-2.9 4.2-2.9 13.4 0 17.6" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'log',
    label: 'Verlauf',
    icon: (
      // Eine Kurve, die ins Zielband läuft — dasselbe Bild wie im
      // Logbuch selbst.
      <path
        d="M4 17l4-4 3 2 4-6 5 3"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
]

export default function App() {
  const { route, navigate, back } = useRouter()
  const ready = useStore((s) => s.ready)
  const hydrate = useStore((s) => s.hydrate)
  const beans = useStore((s) => s.beans)
  const restoreBean = useStore((s) => s.restoreBean)
  const storageError = useStore((s) => s.storageError)
  const dismissStorageError = useStore((s) => s.dismissStorageError)

  /**
   * Was gerade gelöscht wurde, für „Rückgängig“.
   *
   * Liegt hier und nicht im Bildschirm, der gelöscht hat: Der wird im
   * selben Moment neu aufgebaut. Eine Wischgeste ohne Rückfrage braucht
   * aber einen Weg zurück — mit der Bohne gehen ihre Tüten und ihre
   * Protokolle, also die Datenbasis, aus der die App gelernt hat.
   */
  const [papierkorb, setPapierkorb] = useState<BeanTrash | null>(null)
  const uhr = useRef<number | undefined>(undefined)
  const merken = (t: BeanTrash) => {
    window.clearTimeout(uhr.current)
    setPapierkorb(t)
    uhr.current = window.setTimeout(() => setPapierkorb(null), 8000)
  }

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (!ready) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-crema" />
      </div>
    )
  }

  /**
   * Zurück, auch ohne Verlauf.
   *
   * `history.back()` führt ins Nichts, wenn die Route direkt geöffnet
   * wurde — beim Kaltstart einer installierten PWA mit gespeichertem Hash
   * ist genau das der Normalfall.
   */
  const heim = () => {
    if (window.history.length > 1) back()
    else navigate({ tab: 'heute' }, true)
  }

  const bean = beans.find((b) => b.id === beanOf(route))
  const rohMethode = methodOf(route)
  // Nur eine Methode, die die Wissensbasis wirklich führt. Eine erfundene
  // Kennung in der Adresszeile darf die Engine nicht erreichen.
  const methode = (METHOD_IDS as string[]).includes(rohMethode ?? '')
    ? (rohMethode as BrewMethod)
    : undefined

  const coffee = (
    <BeansScreen route={route} navigate={navigate} back={heim} onDeleted={merken} />
  )

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* Ganz oben und über allem: Wenn der Speicher nicht funktioniert,
          ist jede andere Nachricht auf diesem Bildschirm zweitrangig. */}
      {storageError && (
        <StorageErrorBar
          text={storageError}
          onBackup={() => {
            dismissStorageError()
            navigate({ tab: 'setup' })
          }}
          onDismiss={dismissStorageError}
        />
      )}

      {/* Eine Grenze zwischen Bildschirm und Gerüst.
          Die Grenze um `<App/>` fängt jeden Fehler, nimmt aber auch alles
          mit — auch die Reiterleiste, mit der man den kaputten Bildschirm
          verlassen könnte. Diese hier ersetzt nur den Inhalt; Reiter und
          Speicherwarnung bleiben bedienbar.
          `neustartBei` an der Route: Sonst bliebe die Grenze stehen,
          nachdem man längst woanders ist. */}
      <main className="scroll-area flex-1 overflow-y-auto">
        <Bereichsgrenze
          was="Dieser Bildschirm"
          neustartBei={`${route.tab}/${route.id ?? ''}/${route.detail ?? ''}`}
        >
        {route.tab === 'heute' && (
          <HeuteScreen route={route} navigate={navigate} onDeleted={merken} />
        )}

        {route.tab === 'coffee' && coffee}

        {/* Drei Stufen, in der Reihenfolge, in der man wählt: Methode,
            dann Bohne, dann der Durchgang. */}
        {route.tab === 'brew' &&
          (!methode ? (
            // Ohne Methode: der Katalog. Mit Bohne aber ohne Methode
            // (`#/brew/-/<bohne>`) derselbe Bildschirm, nur nach Eignung
            // für diese Bohne sortiert — das ist der Weg aus Coffee.
            <MethodPicker bean={bean} route={route} navigate={navigate} back={heim} />
          ) : !bean ? (
            <BeanPicker method={methode} route={route} navigate={navigate} back={heim} />
          ) : (
            <BrewScreen
              method={methode}
              bean={bean}
              route={route}
              navigate={navigate}
              back={heim}
            />
          ))}

        {/* Eine gelöschte Bohne macht ihr Profil gegenstandslos. Statt
            einen halb gefüllten Bildschirm zu zeigen, geht es zurück. */}
        {route.tab === 'profile' &&
          (bean ? <BeanDetail bean={bean} onBack={heim} onDeleted={merken} /> : coffee)}

        {route.tab === 'log' && <LogScreen route={route} navigate={navigate} back={heim} />}
        {route.tab === 'setup' && <SetupScreen route={route} navigate={navigate} back={heim} />}
        </Bereichsgrenze>
      </main>

      {papierkorb && (
        <UndoBar
          text={`„${papierkorb.bean.name}“ gelöscht`}
          detail={zaehlText(papierkorb)}
          onUndo={() => {
            window.clearTimeout(uhr.current)
            restoreBean(papierkorb)
            setPapierkorb(null)
          }}
        />
      )}

      {/* Liegt über der Reiterleiste und geht nicht von selbst — eine
          Aktualisierung, die man wegwischt, ohne sie zu laden, kommt erst
          beim nächsten Wechsel des Service Workers wieder. */}
      <UpdateToast />

      {/* Nur die beiden Einstiege. Profil, Log und Setup sind Ziele und
          gehören nicht in eine Leiste, die immer sichtbar ist. */}
      {/* Feste Höhe statt Inhalt plus Sicherheitszone — warum, steht bei
          `--nav-h` in index.css. */}
      <nav className="h-nav border-t border-line bg-paper/95 backdrop-blur-xl">
        <div className="flex h-full">
          {REITER.map((t) => {
            /**
             * `brew` gehört unter „Heute": Von dort aus wird gebrüht, und
             * die Leiste soll zeigen, wo man hergekommen ist — nicht ins
             * Leere laufen, weil der Bildschirm keinen eigenen Reiter hat.
             */
            const aktiv =
              route.tab === t.id ||
              (t.id === 'coffee' && route.tab === 'profile') ||
              (t.id === 'heute' && route.tab === 'brew')
            return (
              <button
                key={t.id}
                onClick={() => navigate({ tab: t.id })}
                aria-current={aktiv ? 'page' : undefined}
                className={`flex h-full flex-1 flex-col items-center justify-center gap-1 ${
                  aktiv ? 'text-crema-ink' : 'text-faint'
                }`}
              >
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                  {t.icon}
                </svg>
                {/* `leading-none`: Die Zeilenhöhe der Beschriftung zählte bisher
                    mit, und der Block aus Symbol und Wort war 42 px hoch.
                    Mit 38 px bleibt ober- und unterhalb gleich viel Luft,
                    unten frei vom Home Indicator. */}
                <span className="text-2xs leading-none font-medium">{t.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

/** Was mit der Bohne wegfiel — die Zahl macht den Verlust greifbar. */
function zaehlText({ bags, brews }: BeanTrash): string | undefined {
  const teile: string[] = []
  if (bags.length) teile.push(`${bags.length} ${bags.length === 1 ? 'Bag' : 'Bags'}`)
  if (brews.length) teile.push(`${brews.length} ${brews.length === 1 ? 'Brew' : 'Brews'}`)
  return teile.length ? `mit ${teile.join(' und ')}` : undefined
}
