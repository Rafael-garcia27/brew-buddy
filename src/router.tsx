/**
 * Mini-Router (~50 Zeilen statt 15 KB Bibliothek).
 *
 * Nutzt die History-API, damit die iOS-Zurück-Wischgeste funktioniert —
 * in der Standalone-PWA gibt es keine Browser-Zurück-Schaltfläche, die
 * Geste ist der einzige Weg zurück.
 */
import { useCallback, useEffect, useState } from 'react'

/**
 * Zwei Einstiege, weil die App zwei Fragen beantwortet.
 *
 *   „Ich will einen V60 — welche Bohne nehme ich?"   → brew
 *   „Ich habe diese Bohne — wie brühe ich sie?"      → coffee
 *
 * Beide sind vollwertige Startpunkte, keiner ist Vorstufe des anderen.
 * Eine Zeit lang war `beans` der einzige Einstieg (c11c1db); die damalige
 * Begründung — drei von vier Zielen ergeben nur mit einer bestimmten
 * Bohne Sinn — gilt für Profil und Log weiter, aber nicht mehr fürs
 * Brühen, sobald die Methode selbst der Anfang ist.
 *
 * `profile`, `log` und `setup` sind keine Reiter, sondern Ziele: Sie
 * hängen an einer Bohne (bzw. an nichts) und werden von den beiden
 * Einstiegen aus geöffnet.
 */
export type Tab = 'coffee' | 'brew' | 'profile' | 'log' | 'setup'

/**
 * Was `id` und `detail` bedeuten, hängt am Reiter.
 *
 * Die Felder sind generisch, ihre Belegung nicht — deshalb hier
 * festgehalten, statt es an fünf Stellen im Code zu erraten:
 *
 * | Reiter    | `id`                     | `detail`        |
 * | --------- | ------------------------ | --------------- |
 * | `coffee`  | Bohne (Vorauswahl)       | `new`           |
 * | `brew`    | **Methode**              | **Bohne**       |
 * | `profile` | Bohne                    | —               |
 * | `log`     | Bohne (Filter)           | Brew            |
 * | `setup`   | —                        | `grinder`       |
 *
 * `brew` ist der Grund für diese Tabelle: Dort steht in `id` keine Bohne,
 * sondern die Methode, und die Bohne rutscht auf `detail`. Das folgt der
 * Reihenfolge, in der man wählt.
 */
export interface Route {
  tab: Tab
  id?: string
  detail?: string
}

const TABS: Tab[] = ['coffee', 'brew', 'profile', 'log', 'setup']

/** Typisierte Leser, damit `route.id` nicht überall gedeutet werden muss. */
export function beanOf(r: Route): string | undefined {
  return r.tab === 'brew' ? r.detail : r.id
}

export function methodOf(r: Route): string | undefined {
  return r.tab === 'brew' ? r.id : undefined
}

/**
 * Alte Adressen weiterleiten.
 *
 * Eine installierte PWA startet mit dem Hash, der beim letzten Mal offen
 * war. Ohne diese Zuordnung landet ein Update auf `#/shelf` und zeigt
 * einen leeren Bildschirm.
 */
const ALT: Record<string, Tab> = { shelf: 'coffee', beans: 'coffee' }

/**
 * Segmentfolge: `#/tab/id/detail`.
 *
 * Die Bohnenkennung steht VOR dem Detail, weil fast jede Route eine hat
 * und fast keine ein Detail. Fehlt sie trotzdem — `setup/grinder` etwa
 * gehört keiner Bohne —, muss ihr Platz mit `-` belegt werden: Sonst
 * rutscht das Detail auf die Position der Kennung, und `#/beans/<id>`
 * käme als `detail` zurück. Genau das ist beim Umbau passiert; die
 * Auswahl sprang nach dem Zurückgehen auf die falsche Bohne.
 *
 * Bei `brew` sind beide Segmente belegt (`#/brew/v60/<bohne>`), der
 * Platzhalter kommt dort also nicht vor.
 */
const LEER = '-'

function seg(v: string | undefined): string | undefined {
  return v && v !== LEER ? v : undefined
}

function parse(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '')
  const [tab, id, detail] = clean.split('/')
  const roh = tab ?? ''
  const t = (TABS as string[]).includes(roh) ? (roh as Tab) : (ALT[roh] ?? 'coffee')
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
