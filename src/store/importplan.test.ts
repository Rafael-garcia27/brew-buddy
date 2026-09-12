/**
 * Der Import ist nach dem Ladefehler der zweite Weg, alles zu verlieren:
 * Eine Datei, ein Fingertipp, und der ganze Bestand ist ersetzt.
 *
 * Geprüft wird hier nicht das Ersetzen selbst, sondern das, was davor
 * auf dem Bildschirm steht — denn genau daran entscheidet sich, ob
 * jemand den falschen Tipp macht.
 */
import { describe, it, expect } from 'vitest'
import type { AppState, Bean, Bag, Brew } from '@/domain'
import { emptyState } from '@/domain'
import { SCHEMA_VERSION } from '@/config'
import { importplan, bestandssatz } from './importplan'

const bohne = (id: string) => ({ id, name: id, origins: [], process: 'washed', roastLevel: 'medium', createdAt: '2026-01-01T00:00:00.000Z' }) as Bean
const tuete = (id: string) => ({ id }) as Bag
const brew = (id: string) => ({ id }) as Brew

const zustand = (beans: number, bags: number, brews: number): AppState => ({
  ...emptyState(SCHEMA_VERSION),
  beans: Array.from({ length: beans }, (_, i) => bohne(`b${i}`)),
  bags: Array.from({ length: bags }, (_, i) => tuete(`t${i}`)),
  brews: Array.from({ length: brews }, (_, i) => brew(`w${i}`)),
})

describe('Importplan', () => {
  it('zählt beide Seiten', () => {
    const p = importplan(zustand(2, 1, 14), zustand(12, 3, 40))
    expect(p.alt).toMatchObject({ beans: 2, bags: 1, brews: 14 })
    expect(p.neu).toMatchObject({ beans: 12, bags: 3, brews: 40 })
  })

  it('schweigt, wenn die Sicherung neuer ist', () => {
    // Der Normalfall: Man spielt ein neueres Gerät auf ein älteres.
    expect(importplan(zustand(2, 1, 14), zustand(12, 3, 40)).warnung).toBeUndefined()
  })

  it('warnt, wenn die Sicherung weniger Brews hat', () => {
    // Der teure Fehler: die falsche von drei Sicherungen im Ordner.
    const p = importplan(zustand(4, 2, 40), zustand(4, 2, 14))
    expect(p.warnung).toContain('26 Brews weniger')
    expect(p.warnung).toContain('älter')
  })

  it('zählt im Singular, wenn es einer ist', () => {
    expect(importplan(zustand(1, 1, 2), zustand(1, 1, 1)).warnung).toContain('1 Brew weniger')
  })

  it('warnt am deutlichsten bei einer leeren Sicherung', () => {
    const p = importplan(zustand(4, 2, 40), emptyState(SCHEMA_VERSION))
    expect(p.warnung).toContain('leer')
  })

  it('schweigt beim Erststart — da ist nichts zu verlieren', () => {
    // Wer noch nichts hat, kann durch einen Import nichts verlieren.
    // Eine Warnung wäre hier nur Lärm vor dem einzigen sinnvollen Weg.
    expect(importplan(emptyState(SCHEMA_VERSION), zustand(0, 0, 0)).warnung).toBeUndefined()
    expect(importplan(emptyState(SCHEMA_VERSION), zustand(5, 5, 5)).warnung).toBeUndefined()
  })

  it('nennt den schwerwiegendsten Fall, nicht den ersten', () => {
    // Leer UND weniger Brews: „leer" ist die Aussage, die zählt.
    expect(importplan(zustand(4, 2, 40), emptyState(SCHEMA_VERSION)).warnung).toContain('leer')
  })
})

describe('Bestandssatz', () => {
  it('schreibt Mehrzahl', () => {
    expect(bestandssatz({ beans: 12, bags: 3, brews: 40, grinders: 2 })).toBe('12 Bohnen, 3 Bags, 40 Brews')
  })

  it('schreibt Einzahl', () => {
    expect(bestandssatz({ beans: 1, bags: 1, brews: 1, grinders: 1 })).toBe('1 Bohne, 1 Bag, 1 Brew')
  })

  it('schreibt auch die Null in der Mehrzahl', () => {
    expect(bestandssatz({ beans: 0, bags: 0, brews: 0, grinders: 0 })).toBe('0 Bohnen, 0 Bags, 0 Brews')
  })
})
