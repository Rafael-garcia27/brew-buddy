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
import { useEffect, useRef, useState } from 'react'
import { useRouter } from './router'
import { useStore } from './store'
import type { BeanTrash } from './domain'
import { UndoBar } from './components/system'
import BrewScreen from './screens/BrewScreen'
import BeansScreen, { BeanDetail } from './screens/BeansScreen'
import LogScreen from './screens/LogScreen'
import SetupScreen from './screens/SetupScreen'

export default function App() {
  const { route, navigate, back } = useRouter()
  const ready = useStore((s) => s.ready)
  const hydrate = useStore((s) => s.hydrate)
  const beans = useStore((s) => s.beans)
  const restoreBean = useStore((s) => s.restoreBean)

  /**
   * Was gerade gelöscht wurde, für „Rückgängig“.
   *
   * Liegt hier und nicht im Profil: Der Bildschirm, auf dem gelöscht
   * wird, verschwindet im selben Moment. Eine Wischgeste ohne Rückfrage
   * braucht aber einen Weg zurück — mit der Bohne gehen ihre Tüten und
   * ihre Protokolle, also die Datenbasis, aus der die App gelernt hat.
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
        {route.tab === 'beans' && <BeansScreen route={route} navigate={navigate} back={heim} onDeleted={merken} />}

        {/* Eine gelöschte Bohne macht ihre Aktionen gegenstandslos. Statt
            einen halb gefüllten Bildschirm zu zeigen, geht es zurück. */}
        {route.tab === 'brew' &&
          (bean ? (
            <BrewScreen route={route} navigate={navigate} back={heim} />
          ) : (
            <BeansScreen route={{ tab: 'beans' }} navigate={navigate} back={heim} onDeleted={merken} />
          ))}

        {route.tab === 'profile' &&
          (bean ? (
            <BeanDetail bean={bean} onBack={heim} onDeleted={merken} />
          ) : (
            <BeansScreen route={{ tab: 'beans' }} navigate={navigate} back={heim} onDeleted={merken} />
          ))}

        {route.tab === 'log' && <LogScreen route={route} navigate={navigate} back={heim} />}
        {route.tab === 'setup' && <SetupScreen route={route} navigate={navigate} back={heim} />}
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
