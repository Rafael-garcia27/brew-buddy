/**
 * Die zwei neuen Skalen sagen etwas über die Bohne aus — und können
 * deshalb etwas Falsches sagen.
 *
 * Eine Skala ist gefährlicher als ein Wort: „Medium" ist entweder da oder
 * nicht, aber ein Zeiger sitzt immer irgendwo, auch wenn er falsch sitzt.
 * Ein um ein Band verschobener Zeiger sieht genauso überzeugend aus wie
 * ein richtiger. Deshalb prüft diese Datei die Zuordnung Zahl → Position
 * und nicht das Aussehen.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import formulasRaw from '@data/formulas.json'
import processesRaw from '@data/processes.json'
import type { Process, RoastLevel } from '@domain'
import {
  AGTRON_BANDS,
  AGTRON_RANGE,
  agtronBand,
  agtronSpan,
  mucilagePct,
  processFamily,
} from './index'
import { roastReading } from '@/components/beanviz'
import { PROCESS_LABEL, ROAST_LABEL } from '@/labels'

const ROSTGRADE = Object.keys(ROAST_LABEL) as RoastLevel[]
const PROZESSE = Object.keys(PROCESS_LABEL) as Process[]

describe('Agtron-Bänder', () => {
  it('deckt den Bereich lückenlos und ohne Überlappung ab', () => {
    // Eine Lücke wäre ein Messwert ohne Band, eine Überlappung ein
    // Messwert mit zwei — beides würde die Skala stumm falsch zeichnen.
    const nach = [...AGTRON_BANDS].sort((a, b) => a.min - b.min)
    expect(nach[0]!.min).toBe(AGTRON_RANGE[0])
    expect(nach[nach.length - 1]!.max).toBe(AGTRON_RANGE[1])
    for (let i = 0; i < nach.length - 1; i++) {
      expect(nach[i]!.max).toBe(nach[i + 1]!.min)
    }
  })

  it('steht von hell nach dunkel — die Anzeigereihenfolge', () => {
    // Die Skala zeichnet Band 1 links. Kippt die Reihenfolge in den
    // Daten, zeigt der Zeiger auf hell und meint dunkel.
    for (let i = 0; i < AGTRON_BANDS.length - 1; i++) {
      expect(AGTRON_BANDS[i]!.min).toBeGreaterThan(AGTRON_BANDS[i + 1]!.min)
    }
  })

  it('hat für jeden Röstgrad der App mindestens ein Band', () => {
    const abgedeckt = new Set(AGTRON_BANDS.map((b) => b.level))
    expect(ROSTGRADE.filter((r) => !abgedeckt.has(r))).toEqual([])
  })

  it('erklärt jedes Band in einem Satz', () => {
    for (const b of AGTRON_BANDS) {
      expect(b.context.length).toBeGreaterThan(10)
      expect(b.context.endsWith('.')).toBe(true)
    }
  })

  it('ordnet die Grenzwerte dem Band zu, das die Wissensbasis nennt', () => {
    // kb/05 §2.1 führt 65–75 als Medium-Light. Eine 65 gehört also nach
    // Medium-Light, nicht nach Medium — genau der Fall, den eine
    // Berechnung über Koordinaten falsch macht.
    expect(agtronBand(65).label).toBe('Medium-Light')
    expect(agtronBand(64.9).label).toBe('Medium')
    expect(agtronBand(95).label).toBe('Extremely Light')
    expect(agtronBand(25).label).toBe('Very Dark / French')
  })

  it('fängt Werte außerhalb der Skala am Rand ab', () => {
    expect(agtronBand(140).label).toBe('Extremely Light')
    expect(agtronBand(0).label).toBe('Very Dark / French')
  })

  it('gibt jedem Röstgrad eine Spanne innerhalb der Skala', () => {
    for (const r of ROSTGRADE) {
      const [lo, hi] = agtronSpan(r)
      expect(lo).toBeGreaterThanOrEqual(AGTRON_RANGE[0])
      expect(hi).toBeLessThanOrEqual(AGTRON_RANGE[1])
      expect(hi).toBeGreaterThan(lo)
    }
  })

  it('legt die Spannen der Röstgrade in der richtigen Ordnung nebeneinander', () => {
    // „Light" muss heller sein als „Dark". Sonst wäre der geschätzte
    // Balken auf der falschen Seite der Skala.
    const mitten = ROSTGRADE.map((r) => {
      const [lo, hi] = agtronSpan(r)
      return (lo + hi) / 2
    })
    for (let i = 0; i < mitten.length - 1; i++) {
      expect(mitten[i]!).toBeGreaterThan(mitten[i + 1]!)
    }
  })
})

describe('Röstgrad-Lesung', () => {
  it('nimmt den Messwert, wenn es einen gibt', () => {
    const l = roastReading({ roastLevel: 'light', agtron: 48 })
    expect(l.kind).toBe('measured')
    // Und zwar auch dann, wenn er dem Etikett widerspricht: kb/05 §2.1
    // gibt dem gemessenen Wert ausdrücklich den Vorrang.
    if (l.kind === 'measured') expect(l.band.level).toBe('medium-dark')
  })

  it('zeigt ohne Messwert eine Spanne, keinen Punkt', () => {
    const l = roastReading({ roastLevel: 'light' })
    expect(l.kind).toBe('estimated')
    expect(l.to).toBeGreaterThan(l.from)
  })

  it('setzt hell links und dunkel rechts', () => {
    const hell = roastReading({ roastLevel: 'medium', agtron: 90 })
    const dunkel = roastReading({ roastLevel: 'medium', agtron: 30 })
    expect(hell.from).toBeLessThan(dunkel.from)
    expect(hell.from).toBeGreaterThanOrEqual(0)
    expect(dunkel.to).toBeLessThanOrEqual(1)
  })

  it('hält jede Position im Bild, auch bei unmöglichen Werten', () => {
    // Ein Agtron von 300 ist keine Röstung, sondern ein Tippfehler. Er
    // darf den Zeiger nicht aus dem SVG schieben.
    for (const agtron of [-50, 0, 24, 96, 300, Number.MAX_SAFE_INTEGER]) {
      const l = roastReading({ roastLevel: 'medium', agtron })
      expect(l.from).toBeGreaterThanOrEqual(0)
      expect(l.from).toBeLessThanOrEqual(1)
    }
  })

  it('behandelt einen kaputten Agtron-Wert wie keinen', () => {
    // Aus einem alten Datensatz oder einem leeren Formularfeld kann
    // NaN kommen. Dann ist die Etikettenangabe die bessere Auskunft.
    expect(roastReading({ roastLevel: 'medium', agtron: NaN }).kind).toBe('estimated')
  })
})

describe('Aufbereitungs-Familien', () => {
  it('ordnet jede Aufbereitung der App einer Familie zu', () => {
    for (const p of PROZESSE) {
      expect(processFamily(p).id).toBe((processesRaw.map as Record<string, string>)[p])
    }
  })

  it('führt die fermentierten Verfahren nicht unter Natural', () => {
    // kb/04 §4.4 verlangt das ausdrücklich: Diese Kaffees haben eine
    // atypisch hohe Löslichkeit und brauchen eine eigene Kategorie.
    for (const p of ['anaerobic', 'carbonic-maceration', 'experimental'] as Process[]) {
      expect(processFamily(p).id).toBe('fermented')
    }
    expect(processFamily('natural').id).toBe('natural')
  })

  it('erklärt jede Familie und sagt, was sie fürs Brühen bedeutet', () => {
    for (const f of processesRaw.families) {
      expect(f.short.length).toBeGreaterThan(10)
      expect(f.brewNote.length).toBeGreaterThan(20)
      expect(f.symbol.length).toBeGreaterThan(0)
    }
  })

  it('gibt Mucilage nur dort an, wo die Achse gilt', () => {
    // Washed 0 %, Natural 100 %, Honey dazwischen — das ist die Achse
    // aus kb/04 §4.3. Anaerob und Wet Hulled liegen nicht darauf, und
    // ein erfundener Mittelwert wäre dort eine falsche Präzision.
    expect(mucilagePct('washed')).toBe(0)
    expect(mucilagePct('natural')).toBe(100)
    expect(mucilagePct('anaerobic')).toBeNull()
    expect(mucilagePct('wet-hulled')).toBeNull()
    expect(mucilagePct('experimental')).toBeNull()
  })

  it('sortiert die Honey-Stufen aufsteigend zwischen Washed und Natural', () => {
    const gelb = mucilagePct('honey-yellow')!
    const rot = mucilagePct('honey-red')!
    const schwarz = mucilagePct('honey-black')!
    expect(gelb).toBeGreaterThan(0)
    expect(rot).toBeGreaterThan(gelb)
    expect(schwarz).toBeGreaterThan(rot)
    expect(schwarz).toBeLessThan(100)
  })

  it('hält jeden Mucilage-Wert in der Spanne seiner Familie', () => {
    // Sonst läge der Punkt außerhalb der Fläche, die ihn erklären soll.
    for (const p of PROZESSE) {
      const pct = mucilagePct(p)
      const spanne = processFamily(p).mucilagePct
      if (pct === null || !spanne) continue
      expect(pct).toBeGreaterThanOrEqual(spanne[0])
      expect(pct).toBeLessThanOrEqual(spanne[1])
    }
  })

  it('nennt für jedes Symbol nur Kennungen, die die App zeichnen kann', () => {
    // Ein unbekanntes Symbol rendert nichts — ein leerer Platz, wo ein
    // Zeichen stehen sollte, und kein Fehler.
    const gezeichnet = ['drop', 'half', 'cherry', 'flask', 'husk']
    for (const f of processesRaw.families) {
      expect(gezeichnet).toContain(f.symbol)
    }
  })
})

describe('Wissensbasis bleibt die Quelle', () => {
  it('liest die Bänder aus den Daten, nicht aus dem Code', () => {
    expect(AGTRON_BANDS.length).toBe(formulasRaw.agtronBands.bands.length)
  })

  it('nennt für beide Skalen ihre Herkunft in der Wissensbasis', () => {
    // Leitentscheidung E2: Fachwissen ohne Quellenangabe ist im nächsten
    // Jahr nicht mehr überprüfbar.
    expect(formulasRaw.agtronBands._source).toMatch(/kb\/05/)
    expect(processesRaw.source).toMatch(/kb\/04/)
  })
})

describe('Die Skala braucht ihre Farben', () => {
  it('hat für jedes Agtron-Band ein Farbtoken', () => {
    // Ein fehlendes Token rendert transparent: Die Bohne wäre da und
    // unsichtbar — ein Loch in der Skala, kein Fehler in der Konsole.
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
    for (let i = 1; i <= AGTRON_BANDS.length; i++) {
      expect(css).toContain(`--c-roast-${i}:`)
    }
  })

  it('definiert die Töne für hell und dunkel getrennt', () => {
    // Auf #261d18 wäre das dunkelste Band kein Ton mehr, sondern ein
    // Loch. Beide Themes müssen alle sieben führen.
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
    const dunkel = css.slice(css.indexOf('html.dark'))
    for (let i = 1; i <= AGTRON_BANDS.length; i++) {
      expect(dunkel).toContain(`--c-roast-${i}:`)
    }
  })
})
