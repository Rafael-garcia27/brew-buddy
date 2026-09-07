/**
 * Eine Oberfläche, keine Registerkarten.
 *
 * Die Navigationsleiste hat vier gleichrangige Ziele angeboten, von denen
 * drei nur mit einer bestimmten Bohne Sinn ergeben: Brühen, Profil und Log
 * beziehen sich immer auf eine. Beans ist deshalb kein Reiter neben den
 * anderen, sondern der Ort, an den man zurückkehrt — die drei Aktionen
 * hängen an der dort gewählten Bohne, und der Weg zurück ist der Pfeil im
 * Kopf oder die Wischgeste.
 *
 * Setup fällt aus dieser Logik heraus: Es gehört keiner Bohne und wird
 * einmal eingerichtet. Es sitzt hinter dem Zahnrad im Kopf von Beans.
 */
import { useEffect } from 'react'
import { useRouter } from './router'
import { useStore } from './store'
import BrewScreen from './screens/BrewScreen'
import BeansScreen, { BeanDetail } from './screens/BeansScreen'
import LogScreen from './screens/LogScreen'
import SetupScreen from './screens/SetupScreen'

export default function App() {
  const { route, navigate, back } = useRouter()
  const ready = useStore((s) => s.ready)
  const hydrate = useStore((s) => s.hydrate)
  const beans = useStore((s) => s.beans)

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
   * Zurück zu Beans, auch ohne Verlauf.
   *
   * `history.back()` führt ins Nichts, wenn die Route direkt geöffnet wurde
   * — beim Kaltstart einer installierten PWA mit gespeichertem Hash ist
   * genau das der Normalfall.
   */
  const heim = () => {
    if (window.history.length > 1) back()
    else navigate({ tab: 'beans' }, true)
  }

  /** Die Bohne, um die es in dieser Route geht. */
  const bean = route.id ? beans.find((b) => b.id === route.id) : undefined

  return (
    <div className="flex h-[100dvh] flex-col">
      <main className="scroll-area flex-1 overflow-y-auto">
        {route.tab === 'beans' && <BeansScreen route={route} navigate={navigate} back={heim} />}

        {/* Eine gelöschte Bohne macht ihre Aktionen gegenstandslos. Statt
            einen halb gefüllten Bildschirm zu zeigen, geht es zurück. */}
        {route.tab === 'brew' &&
          (bean ? (
            <BrewScreen route={route} navigate={navigate} back={heim} />
          ) : (
            <BeansScreen route={{ tab: 'beans' }} navigate={navigate} back={heim} />
          ))}

        {route.tab === 'profile' &&
          (bean ? (
            <BeanDetail bean={bean} onBack={heim} />
          ) : (
            <BeansScreen route={{ tab: 'beans' }} navigate={navigate} back={heim} />
          ))}

        {route.tab === 'log' && <LogScreen route={route} navigate={navigate} back={heim} />}
        {route.tab === 'setup' && <SetupScreen route={route} navigate={navigate} back={heim} />}
      </main>
    </div>
  )
}
