/**
 * Der Router ist fünfzig Zeilen — und hat beim Umbau auf bohnenbezogene
 * Routen trotzdem einen Fehler gehabt, den keine Typprüfung findet:
 * `stringify` schrieb `#/beans/<id>`, `parse` las daraus ein `detail`.
 * Die Auswahl sprang dadurch nach jedem Zurückgehen auf die falsche
 * Bohne. Deshalb gibt es hier die Rundreise als Test.
 */
import { describe, it, expect } from 'vitest'
import { _internal, type Route } from './router'

const { parse, stringify } = _internal

/** Jede Route muss die Rundreise durch die Adresszeile überleben. */
function rundreise(r: Route): Route {
  return parse(stringify(r))
}

describe('Routen überleben die Adresszeile', () => {
  const faelle: Route[] = [
    { tab: 'beans' },
    { tab: 'beans', id: 'bean-1' },
    { tab: 'beans', detail: 'new' },
    { tab: 'brew', id: 'bean-1' },
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

describe('Unbekannte Adressen', () => {
  it('landen auf Beans statt auf einem leeren Bildschirm', () => {
    expect(parse('#/').tab).toBe('beans')
    expect(parse('').tab).toBe('beans')
    expect(parse('#/quatsch').tab).toBe('beans')
  })

  it('leiten die alte Regal-Adresse weiter', () => {
    // Eine installierte PWA startet mit dem Hash des letzten Besuchs.
    expect(parse('#/shelf').tab).toBe('beans')
    expect(parse('#/shelf/-/bean-1')).toEqual({ tab: 'beans', detail: 'bean-1' })
  })
})
