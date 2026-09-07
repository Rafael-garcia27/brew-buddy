/**
 * Die Herkunftskarte scheitert lautlos.
 *
 * Wenn ein Ländername in origins.json nicht zu dem in der Kartendatei
 * passt, färbt sich einfach nichts ein — kein Fehler, keine Warnung, nur
 * eine leere Karte, die aussieht wie „Herkunft unbekannt". Dieselbe Falle
 * gilt für den Generator: Ein Vorzeichenfehler in der Projektion schiebt
 * Länder aus dem Ausschnitt, ohne dass etwas kaputt wirkt.
 *
 * Deshalb prüft diese Datei die Daten, nicht die Darstellung.
 */
import { describe, it, expect } from 'vitest'
import originsRaw from '@data/origins.json'
import { WORLD_MAP, mapCountry } from './worldmap'
import { originMapState } from '@/components/OriginMap'

const APP_HERKUENFTE = (originsRaw.origins as { name: string }[]).map((o) => o.name)

describe('Kartendaten', () => {
  it('kennt jede Herkunft, die die App anbietet', () => {
    const fehlend = APP_HERKUENFTE.filter((n) => !mapCountry(n))
    expect(fehlend).toEqual([])
  })

  it('zählt jede App-Herkunft zum Kaffeegürtel', () => {
    // Sonst wäre ein Blend eingefärbt, das gewählte Land aber nicht Teil
    // davon — der Nutzer sähe zwei Karten, die sich widersprechen.
    const draussen = APP_HERKUENFTE.filter((n) => !mapCountry(n)?.belt)
    expect(draussen).toEqual([])
  })

  it('hat einen Gürtel, der nicht aus Versehen die halbe Welt ist', () => {
    const guertel = WORLD_MAP.countries.filter((c) => c.belt)
    expect(guertel.length).toBeGreaterThan(40)
    expect(guertel.length).toBeLessThan(80)
    // China und die USA sind Erzeuger, liegen aber weit außerhalb der
    // Tropen — sie ganz einzufärben wäre geografisch falsch.
    for (const iso of ['CHN', 'USA', 'RUS', 'DEU']) {
      expect(WORLD_MAP.countries.find((c) => c.iso === iso)?.belt).toBeFalsy()
    }
  })

  it('hält jeden Pfad im Ausschnitt', () => {
    const [, , breite, hoehe] = WORLD_MAP.viewBox.split(' ').map(Number)
    const daneben: string[] = []
    for (const c of WORLD_MAP.countries) {
      // Nur M/L/Z mit absoluten Koordinaten — mehr erzeugt der Generator nicht.
      expect(c.d).toMatch(/^M[-\d. LMZ]*Z$/)
      for (const [, xs, ys] of c.d.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)) {
        const x = Number(xs)
        const y = Number(ys)
        if (x < 0 || x > breite! || y < 0 || y > hoehe!) daneben.push(`${c.iso} ${x}/${y}`)
      }
    }
    expect(daneben).toEqual([])
  })

  it('legt die Wendekreise symmetrisch um den Äquator', () => {
    const { cancer, capricorn } = WORLD_MAP.tropics
    expect(WORLD_MAP.equator - cancer).toBeCloseTo(capricorn - WORLD_MAP.equator, 1)
  })
})

describe('Zustand der Karte', () => {
  it('bleibt leer, wenn die Herkunft fehlt', () => {
    expect(originMapState(undefined)).toBe('unknown')
    expect(originMapState([])).toBe('unknown')
    expect(originMapState([{ country: '  ' }])).toBe('unknown')
  })

  it('bleibt leer bei einem Land, das die Karte nicht kennt', () => {
    expect(originMapState([{ country: 'Absurdistan' }])).toBe('unknown')
  })

  it('färbt den Gürtel beim Blend', () => {
    expect(originMapState([{ country: 'Blend' }])).toBe('blend')
  })

  it('färbt das Land, wenn es bekannt ist', () => {
    expect(originMapState([{ country: 'Kenia' }])).toBe('country')
    // Groß- und Kleinschreibung darf nicht entscheiden.
    expect(originMapState([{ country: 'kenia' }])).toBe('country')
  })

  it('behandelt mehrere echte Länder als Länderauswahl, nicht als Blend', () => {
    expect(originMapState([{ country: 'Kenia' }, { country: 'Brasilien' }])).toBe('country')
  })
})
