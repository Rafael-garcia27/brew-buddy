/**
 * Mini-Router (~50 Zeilen statt 15 KB Bibliothek).
 *
 * Nutzt die History-API, damit die iOS-Zurück-Wischgeste funktioniert —
 * in der Standalone-PWA gibt es keine Browser-Zurück-Schaltfläche, die
 * Geste ist der einzige Weg zurück.
 */
import { useCallback, useEffect, useState } from 'react'

/**
 * `beans` ist das Zuhause der App, nicht `brew`.
 *
 * Gebrüht wird immer eine bestimmte Bohne — die Auswahl stand deshalb
 * ohnehin am Anfang jedes Durchgangs. Sie ist damit keine Vorstufe des
 * Brühens, sondern die Oberfläche selbst; Brühen, Profil und Log sind
 * Aktionen AN einer Bohne und tragen ihre Kennung in der Route.
 */
export type Tab = 'beans' | 'brew' | 'profile' | 'log' | 'setup'

export interface Route {
  tab: Tab
  detail?: string
  /** Die Bohne, um die es geht — bei brew, profile und log verpflichtend. */
  id?: string
}

const TABS: Tab[] = ['beans', 'brew', 'profile', 'log', 'setup']

/**
 * Alte Adressen weiterleiten.
 *
 * Eine installierte PWA startet mit dem Hash, der beim letzten Mal offen
 * war. Ohne diese Zuordnung landet ein Update auf `#/shelf` und zeigt
 * einen leeren Bildschirm.
 */
const ALT: Record<string, Tab> = { shelf: 'beans' }

/**
 * Segmentfolge: `#/tab/id/detail`.
 *
 * Die Bohnenkennung steht VOR dem Detail, weil fast jede Route eine hat
 * und fast keine ein Detail. Fehlt sie trotzdem — `setup/grinder` etwa
 * gehört keiner Bohne —, muss ihr Platz mit `-` belegt werden: Sonst
 * rutscht das Detail auf die Position der Kennung, und `#/beans/<id>`
 * käme als `detail` zurück. Genau das ist beim Umbau passiert; die
 * Auswahl sprang nach dem Zurückgehen auf die falsche Bohne.
 */
const LEER = '-'

function seg(v: string | undefined): string | undefined {
  return v && v !== LEER ? v : undefined
}

function parse(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '')
  const [tab, id, detail] = clean.split('/')
  const roh = tab ?? ''
  const t = (TABS as string[]).includes(roh) ? (roh as Tab) : (ALT[roh] ?? 'beans')
  return { tab: t, id: seg(id), detail: seg(detail) }
}

function stringify(r: Route): string {
  let s = `#/${r.tab}`
  if (r.id || r.detail) s += `/${r.id ?? LEER}`
  if (r.detail) s += `/${r.detail}`
  return s
}

/** Nur für Tests — der Router selbst braucht keinen Zugriff von außen. */
export const _internal = { parse, stringify }

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))

  useEffect(() => {
    const onPop = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onPop)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('hashchange', onPop)
      window.removeEventListener('popstate', onPop)
    }
  }, [])

  const navigate = useCallback((r: Route, replace = false) => {
    const h = stringify(r)
    if (replace) window.history.replaceState(null, '', h)
    else window.history.pushState(null, '', h)
    setRoute(r)
  }, [])

  const back = useCallback(() => window.history.back(), [])

  return { route, navigate, back }
}
