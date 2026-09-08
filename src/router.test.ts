/**
 * Der Router ist fünfzig Zeilen — und hat beim Umbau auf bohnenbezogene
 * Routen trotzdem einen Fehler gehabt, den keine Typprüfung findet:
 * `stringify` schrieb `#/beans/<id>`, `parse` las daraus ein `detail`.
 * Die Auswahl sprang dadurch nach jedem Zurückgehen auf die falsche
 * Bohne. Deshalb gibt es hier die Rundreise als Test.
 */
import { describe, it, expect } from 'vitest'
import { _internal, beanOf, methodOf, type Route } from './router'

const { parse, stringify } = _internal

/** Jede Route muss die Rundreise durch die Adresszeile überleben. */
function rundreise(r: Route): Route {
  return parse(stringify(r))
}

describe('Routen überleben die Adresszeile', () => {
  const faelle: Route[] = [
    { tab: 'coffee' },
    { tab: 'coffee', id: 'bean-1' },
    { tab: 'coffee', detail: 'new' },
    // brew trägt Methode UND Bohne — der Grund für die Segmenttabelle.
    { tab: 'brew', id: 'v60' },
    { tab: 'brew', id: 'v60', detail: 'bean-1' },
    { tab: 'profile', id: 'bean-1' },
    { tab: 'log', id: 'bean-1' },
    { tab: 'log', id: 'bean-1', detail: 'brew-9' },
    { tab: 'log', detail: 'brew-9' },
    { tab: 'setup' },
    { tab: 'setup', detail: 'grinder' },
  ]

  for (const r of faelle) {
    it(stringify(r), () => {
      expect(rundreise(r)).toEqual(r)
    })
  }
})

describe('Bedeutung der Segmente', () => {
  it('liest bei brew die Methode aus `id` und die Bohne aus `detail`', () => {
    const r = parse('#/brew/v60/bean-1')
    expect(methodOf(r)).toBe('v60')
    expect(beanOf(r)).toBe('bean-1')
  })

  it('liest überall sonst die Bohne aus `id` und kennt keine Methode', () => {
    for (const tab of ['coffee', 'profile', 'log'] as const) {
      const r = parse(`#/${tab}/bean-1`)
      expect(beanOf(r)).toBe('bean-1')
      expect(methodOf(r)).toBeUndefined()
    }
  })
})

describe('Unbekannte Adressen', () => {
  it('landen auf Beans statt auf einem leeren Bildschirm', () => {
    expect(parse('#/').tab).toBe('coffee')
    expect(parse('').tab).toBe('coffee')
    expect(parse('#/quatsch').tab).toBe('coffee')
  })

  it('leiten die alten Regal-Adressen weiter', () => {
    // Zweimal umbenannt: shelf → beans → coffee. Eine installierte PWA
    // startet mit dem Hash des letzten Besuchs, also müssen beide
    // Zwischenstände weiterleiten.
    expect(parse('#/beans').tab).toBe('coffee')
    expect(parse('#/beans/-/bean-1')).toEqual({ tab: 'coffee', detail: 'bean-1' })
  })

  it('leitet die erste Regal-Adresse weiter', () => {
    // Eine installierte PWA startet mit dem Hash des letzten Besuchs.
    expect(parse('#/shelf').tab).toBe('coffee')
    expect(parse('#/shelf/-/bean-1')).toEqual({ tab: 'coffee', detail: 'bean-1' })
  })
})
