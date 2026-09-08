/**
 * Die Herkunftskarte scheitert lautlos.
 *
 * Wenn eine gespeicherte Herkunft nicht in der Länderliste steht, färbt
 * sich einfach nichts ein — kein Fehler, keine Warnung, nur eine leere
 * Karte, die aussieht wie „Herkunft unbekannt". Dieselbe Falle gilt für
 * den Generator: Ein Vorzeichenfehler in der Projektion schiebt Länder
 * aus dem Ausschnitt, ohne dass etwas kaputt wirkt.
 *
 * Deshalb prüft diese Datei die Daten, nicht die Darstellung.
 */
import { describe, it, expect } from 'vitest'
import originsRaw from '@data/origins.json'
import { BLEND, COUNTRIES, EXPORT_RANKING, findCountry, originOptions } from './index'
import { WORLD_MAP, mapPath } from './worldmap'
import { originCountries, originLegend, originMapState } from '@/components/OriginMap'
import { readFileSync } from 'node:fs'

const APP_HERKUENFTE = (originsRaw.origins as { name: string }[]).map((o) => o.name)

describe('Länderliste', () => {
  it('kennt jede Herkunft, für die die App ein Profil führt', () => {
    expect(APP_HERKUENFTE.filter((n) => !findCountry(n))).toEqual([])
  })

  it('zählt jede App-Herkunft zum Kaffeegürtel', () => {
    // Sonst wäre ein Blend eingefärbt, das gewählte Land aber nicht Teil
    // davon — der Nutzer sähe zwei Karten, die sich widersprechen.
    expect(APP_HERKUENFTE.filter((n) => !findCountry(n)?.belt)).toEqual([])
  })

  it('hat für jedes Land im Kaffeegürtel eine Geometrie', () => {
    // Für alle Länder gilt das absichtlich NICHT: Norwegen und Island
    // liegen nördlich des Ausschnitts, bleiben aber gültige Eingaben.
    expect(COUNTRIES.filter((c) => c.belt && !mapPath(c.iso))).toEqual([])
  })

  it('nimmt Länder an, die die Karte nicht zeigt', () => {
    // Sonst hätte die Prüfung „Norwegen ist kein Land" behauptet.
    const norwegen = findCountry('Norwegen')
    expect(norwegen).toBeDefined()
    expect(mapPath(norwegen!.iso)).toBeUndefined()
  })

  it('hat einen Gürtel, der nicht aus Versehen die halbe Welt ist', () => {
    const guertel = COUNTRIES.filter((c) => c.belt)
    expect(guertel.length).toBeGreaterThan(40)
    expect(guertel.length).toBeLessThan(80)
    // China und die USA sind Erzeuger, liegen aber weit außerhalb der
    // Tropen — sie ganz einzufärben wäre geografisch falsch.
    for (const iso of ['CHN', 'USA', 'RUS', 'DEU']) {
      expect(COUNTRIES.find((c) => c.iso === iso)?.belt).toBeFalsy()
    }
  })
})

describe('Eingabeprüfung', () => {
  it('nimmt die deutsche Schreibweise', () => {
    expect(findCountry('Kolumbien')?.iso).toBe('COL')
  })

  it('nimmt auch die englische und antwortet auf deutsch', () => {
    // Auf der Tüte steht mal so, mal so.
    expect(findCountry('Ivory Coast')?.de).toBe('Elfenbeinküste')
    expect(findCountry('Ethiopia')?.de).toBe('Äthiopien')
  })

  it('ignoriert Groß- und Kleinschreibung und Leerraum', () => {
    expect(findCountry('  kENIA ')?.iso).toBe('KEN')
  })

  it('lehnt ab, was kein Land ist', () => {
    for (const murks of ['', '   ', 'Kolumbioen', 'Blend', 'Finca La Esperanza', '123']) {
      expect(findCountry(murks)).toBeUndefined()
    }
  })
})

describe('Reihenfolge der Auswahl', () => {
  const liste = originOptions()

  it('beginnt mit den Exporteuren nach Ausfuhrmenge', () => {
    const erwartet = EXPORT_RANKING.map((iso) => COUNTRIES.find((c) => c.iso === iso)?.de)
    expect(liste.slice(0, EXPORT_RANKING.length)).toEqual(erwartet)
    expect(liste[0]).toBe('Brasilien')
    expect(liste[1]).toBe('Vietnam')
  })

  it('verliert keine der eigenen Herkünfte', () => {
    // Kenia, Panama, Jemen und Ruanda liegen unter Rang 15, sind aber
    // Spezialitätenherkünfte mit eigenem Profil.
    expect(APP_HERKUENFTE.filter((n) => !liste.includes(n))).toEqual([])
  })

  it('führt Blend nicht als Land', () => {
    expect(liste).not.toContain(BLEND)
  })

  it('hängt Nachgetragenes an und lässt Unfug draußen', () => {
    const mit = originOptions(['Bolivien', 'Kolumbioen'])
    expect(mit).toContain('Bolivien')
    expect(mit).not.toContain('Kolumbioen')
    // Ein zweites Mal dasselbe Land erzeugt keinen Doppeleintrag.
    expect(originOptions(['Brasilien']).filter((n) => n === 'Brasilien')).toHaveLength(1)
  })
})

describe('Kartengeometrie', () => {
  it('hält jeden Pfad im Ausschnitt', () => {
    const [, , breite, hoehe] = WORLD_MAP.viewBox.split(' ').map(Number)
    const daneben: string[] = []
    for (const p of WORLD_MAP.paths) {
      // Nur M/L/Z mit absoluten Koordinaten — mehr erzeugt der Generator nicht.
      expect(p.d).toMatch(/^M[-\d. LMZ]*Z$/)
      for (const [, xs, ys] of p.d.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)) {
        const x = Number(xs)
        const y = Number(ys)
        if (x < 0 || x > breite! || y < 0 || y > hoehe!) daneben.push(`${p.iso} ${x}/${y}`)
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

  it('bleibt leer bei einem Land, das die Liste nicht kennt', () => {
    expect(originMapState([{ country: 'Absurdistan' }])).toBe('unknown')
  })

  it('zeigt den Gürtel bei einem Blend ohne Bestandteile', () => {
    expect(originMapState([{ country: BLEND }])).toBe('belt')
  })

  it('zeigt die Bestandteile, sobald der Blend sie nennt', () => {
    const blend = [{ country: BLEND }, { country: 'Brasilien' }, { country: 'Äthiopien' }]
    expect(originMapState(blend)).toBe('countries')
    expect(originCountries(blend)).toEqual(['BRA', 'ETH'])
  })

  it('zeigt das Land, wenn es bekannt ist', () => {
    expect(originMapState([{ country: 'Kenia' }])).toBe('countries')
    expect(originCountries([{ country: 'kenia' }])).toEqual(['KEN'])
  })

  it('nennt kein Land doppelt', () => {
    expect(originCountries([{ country: 'Kenia' }, { country: 'Kenia' }])).toEqual(['KEN'])
  })
})

describe('Kartenlegende', () => {
  it('gibt jeder Herkunft eine eigene Farbe', () => {
    // Der ganze Zweck der Legende: Drei Länder in einer Farbe sind auf
    // der Karte nicht auseinanderzuhalten, und der Text darunter
    // behauptet trotzdem eine Zuordnung.
    const l = originLegend([{ country: BLEND }, { country: 'Brasilien' }, { country: 'Kolumbien' }])
    expect(l.map((e) => e.name)).toEqual(['Brasilien', 'Kolumbien'])
    expect(new Set(l.map((e) => e.color)).size).toBe(2)
  })

  it('lässt den Sammelwert „Blend" aus der Legende heraus', () => {
    // „Blend" ist kein Land und hat keinen Fleck auf der Karte.
    const l = originLegend([{ country: BLEND }])
    expect(l).toEqual([])
  })

  it('verzichtet auf Farben, statt sie zu wiederholen', () => {
    const viele = [
      'Brasilien', 'Kolumbien', 'Äthiopien', 'Kenia', 'Guatemala', 'Indonesien',
    ].map((country) => ({ country }))
    const l = originLegend(viele)
    expect(l).toHaveLength(6)
    expect(l.every((e) => e.color === undefined)).toBe(true)
  })

  it('nimmt Region, Farm und Anteil der Bohne mit', () => {
    const l = originLegend([{ country: 'Kolumbien', region: 'Huila', farm: 'El Paraíso', sharePct: 60 }])
    expect(l[0]!.detail).toBe('Huila · El Paraíso · 60 %')
  })

  it('greift ohne eigene Angabe auf das Herkunftsprofil zurück', () => {
    // Eine Legendenzeile, die nur den Ländernamen wiederholt, den die
    // Karte schon zeigt, wäre keine Ergänzung.
    const l = originLegend([{ country: 'Äthiopien' }])
    expect(l[0]!.detail).toBeUndefined()
    expect(l[0]!.character).toBeTruthy()
    // Und zwar deutsch: Die Schlüssel in origins.json sind englisch.
    expect(l[0]!.character).not.toMatch(/[a-z][A-Z]/)
  })

  it('markiert ein Land, das der Ausschnitt nicht zeigt', () => {
    const l = originLegend([{ country: 'Norwegen' }])
    expect(l[0]!.offMap).toBe(true)
    expect(originLegend([{ country: 'Brasilien' }])[0]!.offMap).toBe(false)
  })

  it('nennt jedes Land nur einmal, auch bei doppelter Angabe', () => {
    const l = originLegend([{ country: 'Brasilien' }, { country: 'Brazil' }])
    expect(l).toHaveLength(1)
  })

  it('bleibt bei fehlender Herkunft leer', () => {
    expect(originLegend(undefined)).toEqual([])
    expect(originLegend([])).toEqual([])
  })

  it('hat für jede Legendenfarbe ein Token im Stylesheet', () => {
    // Eine Farbe ohne Token rendert transparent — das Land wäre
    // eingezeichnet und unsichtbar.
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
    const viele = ['Brasilien', 'Kolumbien', 'Äthiopien', 'Kenia', 'Guatemala'].map((country) => ({
      country,
    }))
    for (const e of originLegend(viele)) {
      const token = e.color!.replace(/var\(|\)/g, '')
      expect(css).toContain(`${token}:`)
    }
  })
})
