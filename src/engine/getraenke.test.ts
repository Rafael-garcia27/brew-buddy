import { describe, it, expect } from 'vitest'
import { basisKaffeeG, rezept, karte, PRUEFUNGEN_AKTIV, PRUEFUNGEN_KONSTANT } from './getraenke'
import { getDrink, DRINK_PRUEFUNGEN, ausEspresso } from '@/kb'

const BEZUG = { doseG: 18, yieldG: 36, roastLevel: 'medium' } as const

function d(id: string) {
  const g = getDrink(id)
  if (!g) throw new Error(`kein Getränk ${id}`)
  return g
}

describe('Bezugsmenge', () => {
  it('rechnet Einwaage mal Ratio', () => {
    expect(basisKaffeeG(d('cortado'))).toBe(36)
    expect(basisKaffeeG(d('latte'))).toBe(36)
  })

  it('nimmt die feste Masse, wo die Karte eine nennt', () => {
    // Cappuccino classico ist über Drittel definiert, nicht über Ratio.
    expect(basisKaffeeG(d('cappuccino-classic'))).toBe(25)
  })
})

describe('Skalierung', () => {
  it('lässt den Bezugsshot unverändert', () => {
    const r = rezept(d('cortado'), BEZUG)
    expect(r.faktor).toBe(1)
    expect(r.kaffeeG).toBe(36)
    expect(r.zutaten[0]?.massG).toBe(60)
    expect(r.gesamtG).toBe(96)
    expect(r.milchEingiessenG).toBe(52)
  })

  it('zieht die Milch mit dem größeren Shot mit', () => {
    // 20 g auf 42 g ist ein Sechstel mehr Kaffee — also auch ein
    // Sechstel mehr Milch, sonst ist es kein Cortado mehr.
    const r = rezept(d('cortado'), { doseG: 20, yieldG: 42, roastLevel: 'medium' })
    expect(r.kaffeeG).toBe(42)
    expect(r.zutaten[0]?.massG).toBe(70)
    expect(r.gesamtG).toBe(112)
  })

  it('lässt feste Rezepturen fest', () => {
    // Zwei Kugeln Eis bleiben zwei Kugeln, auch bei einem doppelten Shot.
    const r = rezept(d('affogato'), { doseG: 36, yieldG: 72, roastLevel: 'medium' })
    expect(r.faktor).toBe(1)
    expect(r.kaffeeG).toBe(36)
    expect(r.zutaten[0]?.massG).toBe(100)
  })

  it('rundet Kleinmengen feiner als Großmengen', () => {
    // Ein sehr kurzer Shot schrumpft die Schokolade unter zehn Gramm —
    // dort ist die Nachkommastelle keine Scheingenauigkeit mehr, bei der
    // Milch darüber schon.
    const r = rezept(d('mocha'), { doseG: 18, yieldG: 11, roastLevel: 'medium' })
    expect(r.zutaten[0]?.massG).toBeCloseTo(9.2, 1)
    expect(Number.isInteger(r.zutaten[1]?.massG)).toBe(true)
  })
})

describe('Stärke', () => {
  it('bleibt beim reinen Vergrößern gleich', () => {
    const klein = rezept(d('latte'), BEZUG)
    const gross = rezept(d('latte'), { doseG: 36, yieldG: 72, roastLevel: 'medium' })
    expect(gross.intensitaetPct).toBeCloseTo(klein.intensitaetPct ?? 0, 2)
    expect(gross.hinweise).toHaveLength(0)
  })

  it('sinkt, wenn der Shot länger läuft als die Karte rechnet', () => {
    // Gleiche Einwaage, 1:3 statt 1:2 — dieselbe Menge Kaffee in mehr
    // Flüssigkeit. Das Getränk wird dünner, und das muss dranstehen.
    const r = rezept(d('cortado'), { doseG: 18, yieldG: 54, roastLevel: 'medium' })
    expect(r.intensitaetPct).toBeLessThan(d('cortado').intensityPct ?? 99)
    expect(r.hinweise.join(' ')).toMatch(/dünn/i)
  })

  it('meldet den kurzen Shot im Milchgetränk als kräftig', () => {
    const r = rezept(d('latte'), { doseG: 18, yieldG: 25, roastLevel: 'medium' })
    expect(r.hinweise.join(' ')).toMatch(/kräftig/i)
  })

  it('schweigt bei kleinen Abweichungen', () => {
    const r = rezept(d('cortado'), { doseG: 18, yieldG: 38, roastLevel: 'medium' })
    expect(r.hinweise).toHaveLength(0)
  })
})

describe('Röstgrad', () => {
  it('weist auf die bevorzugte Röstung hin, ohne sie zu verlangen', () => {
    const r = rezept(d('espresso-tonic'), { doseG: 18, yieldG: 36, roastLevel: 'dark' })
    expect(r.hinweise.join(' ')).toMatch(/hellen Röstungen/)
  })

  it('schweigt, wenn die Röstung passt', () => {
    const r = rezept(d('espresso-tonic'), { doseG: 18, yieldG: 36, roastLevel: 'light' })
    expect(r.hinweise).toHaveLength(0)
  })
})

describe('Die Karte', () => {
  it('führt nur, was aus einem Shot entsteht', () => {
    const ids = karte(BEZUG).map((r) => r.getraenk.id)
    // Ein Ristretto ist ein anders gezogener Espresso, kein Getränk,
    // das aus einem fertigen Shot wird.
    expect(ids).not.toContain('ristretto')
    expect(ids).not.toContain('espresso')
    // Und nichts, was eine eigene Brühmethode ist.
    expect(ids).not.toContain('pour-over')
    expect(ids).not.toContain('cold-brew-concentrate')
    expect(ids).toContain('cortado')
    expect(ids).toContain('flat-white')
    expect(ids).toContain('affogato')
  })

  it('beginnt mit den Milchgetränken und ordnet sie von klein nach groß', () => {
    const k = karte(BEZUG)
    expect(k[0]?.getraenk.category).toBe('milk')
    const milch = k.filter((r) => r.getraenk.category === 'milk')
    const mengen = milch.map((r) => r.gesamtG)
    expect(mengen).toEqual([...mengen].sort((a, b) => a - b))
  })

  it('hat für jedes Getränk ein Glas und eine Gesamtmenge', () => {
    for (const r of karte(BEZUG)) {
      expect(r.gesamtG).toBeGreaterThan(0)
      expect(r.getraenk.glassMl[1]).toBeGreaterThan(0)
    }
  })

  it('ist nicht leer', () => {
    expect(ausEspresso().length).toBeGreaterThan(15)
  })
})

describe('Prüfregeln der Datei', () => {
  it('kennt jede Regel, die in der Datei steht', () => {
    // Der Sinn dieses Tests: Eine achte Regel in drinks.json darf nicht
    // stillschweigend nie ausgewertet werden. Wer sie einträgt, muss
    // hier entscheiden, ob sie etwas über den Shot sagt oder über die
    // Rezeptur.
    const bekannt = [...PRUEFUNGEN_AKTIV, ...PRUEFUNGEN_KONSTANT].sort()
    expect(Object.keys(DRINK_PRUEFUNGEN).sort()).toEqual(bekannt)
  })

  it('nimmt die Meldungstexte aus der Datei', () => {
    const r = rezept(d('cortado'), { doseG: 18, yieldG: 54, roastLevel: 'medium' })
    expect(r.hinweise[0]).toContain(DRINK_PRUEFUNGEN['intensityLow']?.message)
  })
})
