/**
 * Methode → Bohne.
 *
 * Die Gegenrichtung zu `bestMethodFor`, und sie hat zwei Fallen, die die
 * andere Richtung nicht hat: Frische und Bestand. Beim Vergleich von
 * METHODEN für eine Bohne sind beide für alle Kandidaten gleich. Beim
 * Vergleich von BOHNEN entscheiden sie mit — und eine Bohne, die man
 * nicht in der Hand hält, ist überhaupt keine Empfehlung.
 */
import { describe, it, expect } from 'vitest'
import type { Bag, Bean } from '@domain'
import { bestBeansFor, bestMethodFor, suitability, RANK_SCHWELLE } from './suitability'
import { METHODS, METHOD_LABEL } from '@/labels'

const TODAY = new Date('2026-09-08T08:00:00Z')
const daysAgo = (n: number) => new Date(TODAY.getTime() - n * 86_400_000).toISOString()

const bean = (id: string, over: Partial<Bean> = {}): Bean => ({
  id,
  name: id,
  origins: [{ country: 'Kolumbien' }],
  process: 'washed',
  roastLevel: 'medium',
  createdAt: daysAgo(60),
  ...over,
})

const bag = (beanId: string, over: Partial<Bag> = {}): Bag => ({
  id: `bag-${beanId}`,
  beanId,
  roastDate: daysAgo(14),
  remainingGrams: 250,
  depleted: false,
  createdAt: daysAgo(14),
  ...over,
})

/** Nur die Namen in Reihenfolge — das ist, was der Nutzer sieht. */
const reihenfolge = (m: Parameters<typeof bestBeansFor>[0], beans: Bean[], bags: Bag[]) =>
  bestBeansFor(m, beans, bags, TODAY).map((r) => r.bean.name)

describe('Fachliche Reihenfolge', () => {
  const aethiopien = bean('Äthiopien-hell', {
    origins: [{ country: 'Äthiopien' }],
    roastLevel: 'light',
  })
  const brasilien = bean('Brasilien-dunkel', {
    origins: [{ country: 'Brasilien' }],
    roastLevel: 'dark',
    process: 'natural',
  })
  const bags = [bag('Äthiopien-hell'), bag('Brasilien-dunkel')]

  it('empfiehlt für V60 die helle Äthiopierin', () => {
    expect(reihenfolge('v60', [brasilien, aethiopien], bags)[0]).toBe('Äthiopien-hell')
  })

  it('empfiehlt für Espresso die dunkle Brasilianerin', () => {
    expect(reihenfolge('espresso', [aethiopien, brasilien], bags)[0]).toBe('Brasilien-dunkel')
  })

  it('bleibt mit bestMethodFor widerspruchsfrei', () => {
    // Was die Bohne als beste Methode nennt, muss diese Methode auch als
    // gute Bohne zurückmelden. Sonst widersprechen sich die zwei
    // Einstiege der App gegenseitig.
    for (const b of [aethiopien, brasilien]) {
      const beste = bestMethodFor(b).method
      const rang = bestBeansFor(beste, [aethiopien, brasilien], bags, TODAY)
      expect(rang[0]!.bean.name).toBe(b.name)
    }
  })

  it('begründet jede Platzierung', () => {
    for (const r of bestBeansFor('v60', [aethiopien, brasilien], bags, TODAY)) {
      expect(r.note.length).toBeGreaterThan(10)
    }
  })
})

describe('Frische zählt mit', () => {
  const gleich = [bean('frisch'), bean('alt')]

  it('setzt bei gleicher Eignung die frischere nach vorn', () => {
    const bags = [bag('frisch', { roastDate: daysAgo(14) }), bag('alt', { roastDate: daysAgo(70) })]
    expect(reihenfolge('v60', gleich, bags)).toEqual(['frisch', 'alt'])
  })

  it('lässt Alter die Fachlichkeit nicht vollständig überstimmen', () => {
    // Perfekt und alt gegen mittelmäßig und frisch: Die frische gewinnt,
    // aber die alte bleibt in der Liste und wird nicht auf null gedrückt.
    const perfektAlt = bean('perfekt-alt', {
      origins: [{ country: 'Brasilien' }],
      roastLevel: 'dark',
      process: 'natural',
    })
    const mittelFrisch = bean('mittel-frisch', { origins: [{ country: 'Kolumbien' }] })
    const bags = [
      bag('perfekt-alt', { roastDate: daysAgo(75) }),
      bag('mittel-frisch', { roastDate: daysAgo(14) }),
    ]
    const r = bestBeansFor('espresso', [perfektAlt, mittelFrisch], bags, TODAY)
    expect(r[0]!.bean.name).toBe('mittel-frisch')
    expect(r[1]!.rank).toBeGreaterThan(0)
  })

  it('nennt eine überalterte Bohne beim Namen', () => {
    const bags = [bag('frisch'), bag('alt', { roastDate: daysAgo(90) })]
    const alt = bestBeansFor('v60', gleich, bags, TODAY).find((r) => r.bean.name === 'alt')!
    expect(alt.note).toMatch(/Eignung hier keine Rolle|überaltert/)
  })
})

describe('Bestand ist kategorisch, nicht graduell', () => {
  it('sortiert Bohnen ohne Tüte nach unten, auch wenn sie perfekt passen', () => {
    const perfekt = bean('ohne-Tüte', {
      origins: [{ country: 'Äthiopien' }],
      roastLevel: 'light',
    })
    const mittel = bean('mit-Tüte', { origins: [{ country: 'Kolumbien' }] })
    const r = bestBeansFor('v60', [perfekt, mittel], [bag('mit-Tüte')], TODAY)
    expect(r[0]!.bean.name).toBe('mit-Tüte')
    expect(r[1]!.unavailable).toBe('no-bag')
  })

  it('unterscheidet keine Tüte, leere Tüte und zu wenig', () => {
    const beans = [bean('keine'), bean('leer'), bean('wenig'), bean('genug')]
    const bags = [
      bag('leer', { depleted: true }),
      bag('wenig', { remainingGrams: 4 }),
      bag('genug'),
    ]
    const nach = Object.fromEntries(
      bestBeansFor('espresso', beans, bags, TODAY).map((r) => [r.bean.name, r.unavailable]),
    )
    expect(nach).toEqual({
      genug: undefined,
      keine: 'no-bag',
      leer: 'depleted',
      wenig: 'too-little',
    })
  })

  it('erklärt jeden dieser Fälle in einem Satz', () => {
    const beans = [bean('keine'), bean('leer'), bean('wenig')]
    const bags = [bag('leer', { depleted: true }), bag('wenig', { remainingGrams: 4 })]
    for (const r of bestBeansFor('espresso', beans, bags, TODAY)) {
      expect(r.note).toMatch(/Tüte|übrig|leer/i)
    }
  })
})

describe('Abraten ist erlaubt', () => {
  it('lässt erkennen, wenn nichts wirklich passt', () => {
    // Helle gewaschene Bohnen im Espresso: von der App selbst als
    // schwierig geführt. Dann soll die Liste das zeigen dürfen, statt
    // eine Empfehlung zu behaupten (kb/15 §6).
    const schwierig = [
      bean('Kenia', { origins: [{ country: 'Kenia' }], roastLevel: 'light' }),
      bean('Äthiopien', { origins: [{ country: 'Äthiopien' }], roastLevel: 'light' }),
    ]
    const bags = [bag('Kenia'), bag('Äthiopien')]
    const r = bestBeansFor('espresso', schwierig, bags, TODAY)
    expect(r[0]!.rank).toBeLessThan(RANK_SCHWELLE)
  })

  it('hält eine gute Empfehlung über der Schwelle', () => {
    const gut = bean('Brasilien', {
      origins: [{ country: 'Brasilien' }],
      roastLevel: 'dark',
      process: 'natural',
    })
    const r = bestBeansFor('espresso', [gut], [bag('Brasilien')], TODAY)
    expect(r[0]!.rank).toBeGreaterThan(RANK_SCHWELLE)
  })
})

describe('Randfälle', () => {
  it('verträgt ein leeres Regal', () => {
    expect(bestBeansFor('v60', [], [], TODAY)).toEqual([])
  })

  it('verträgt einen Blend ohne Herkunftsprofil', () => {
    const blend = bean('Hausmischung', { origins: [{ country: 'Blend' }] })
    const r = bestBeansFor('v60', [blend], [bag('Hausmischung')], TODAY)
    expect(r).toHaveLength(1)
    expect(r[0]!.note).toMatch(/Herkunft offen|geschätzt/)
  })

  it('verträgt eine Tüte ohne Röstdatum', () => {
    const b = bean('ohne-Datum')
    const r = bestBeansFor('v60', [b], [bag('ohne-Datum', { roastDate: undefined })], TODAY)
    expect(r[0]!.freshness.days).toBeNull()
    expect(Number.isFinite(r[0]!.rank)).toBe(true)
  })
})

describe('Jede Methode begründet mit ihren eigenen Worten', () => {
  // Die French Press bekam seit ihrer Einführung „die AeroPress verzeiht
  // viel" zu lesen: `reasonFor` behandelte Espresso und V60 und ließ
  // alles andere durchfallen. Aufgefallen ist es erst, als der
  // Methodenbildschirm die Begründungen nebeneinander zeigte.
  const proben = [
    bean('hell-washed', { origins: [{ country: 'Äthiopien' }], roastLevel: 'light' }),
    bean('dunkel-natural', {
      origins: [{ country: 'Brasilien' }],
      roastLevel: 'dark',
      process: 'natural',
    }),
    bean('mittel', {}),
  ]

  it('nennt in keiner Begründung eine fremde Methode', () => {
    for (const b of proben) {
      for (const m of METHODS) {
        const grund = suitability(b, m).reason
        const fremde = METHODS.filter((x) => x !== m).filter((x) =>
          grund.includes(METHOD_LABEL[x]),
        )
        // Ein Verweis auf eine Alternative ist erlaubt — aber nur als
        // Empfehlung („passt besser"), nicht als Beschreibung dessen,
        // was die gewählte Methode tut.
        for (const f of fremde) {
          expect(grund).toMatch(
            new RegExp(`${METHOD_LABEL[f]}[^.]*(passen besser|passt besser|kommt mehr|spielt)`),
          )
        }
      }
    }
  })

  it('liefert für jede Methode einen eigenen Text', () => {
    for (const b of proben) {
      const texte = METHODS.map((m) => suitability(b, m).reason)
      expect(new Set(texte).size).toBe(METHODS.length)
    }
  })
})
