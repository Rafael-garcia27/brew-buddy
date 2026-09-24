/**
 * Die Wissensbasis prüft sich selbst.
 *
 * Leitentscheidung E2: Fachwissen liegt in `data/*.json`, der Code ist
 * ihr Interpreter. Der Preis dafür ist, dass TypeScript die Dateien nur
 * grob kennt — dass in `methods.json` unter `id` eine gültige Methode
 * steht und nicht ein Tippfehler, kann es nicht wissen. Deshalb stehen
 * an solchen Stellen Typumgehungen, und deshalb sind Datenfehler bis
 * 2.0 erst zur Laufzeit aufgefallen: `referenceMicron('batchbrew')` warf,
 * weil in `grinders.json` ein Eintrag fehlte, und der Brühbildschirm
 * blieb weiß.
 *
 * Ein Schema-Generator wäre die große Lösung. Diese hier ist die kleine
 * und deckt dieselben Fälle ab: Was die Engine an Struktur voraussetzt,
 * steht als Behauptung im Test. Kostet kein Byte im Bundle und schlägt
 * beim Bauen an, nicht auf dem Telefon.
 *
 * Neue Regel dazu? Neue Behauptung dazu.
 */
import { describe, it, expect } from 'vitest'
import { METHODS as METHOD_IDS } from '@/labels'
import { grinderFromCatalog } from '@/engine/grinder'
import {
  METHODS,
  getMethod,
  RULES,
  ORIGINS,
  PROCESSES,
  GRINDER_CATALOG,
  GLOSSARY,
  referenceMicron,
  targetTimeRange,
  getMethodDefaults,
} from './index'

const ROASTS = ['light', 'medium-light', 'medium', 'medium-dark', 'dark'] as const

describe('Methoden', () => {
  it('jede angebotene Methode steht auch in den Daten', () => {
    for (const m of METHOD_IDS) {
      expect(() => getMethod(m), `Methode ${m} fehlt in methods.json`).not.toThrow()
      expect(getMethod(m)?.id, `Methode ${m} fehlt in methods.json`).toBe(m)
    }
  })

  it('jede Methode in den Daten wird auch angeboten', () => {
    // Sonst liegt Wissen in der Datei, das die App nie erreicht.
    for (const m of METHODS) {
      expect((METHOD_IDS as readonly string[]).includes(m.id), `${m.id} wird nirgends angeboten`).toBe(true)
    }
  })

  it('jede Methode hat einen Mahlgrad-Zielbereich', () => {
    // Genau der Fall, an dem der Brühbildschirm weiß wurde:
    // `referenceMicron` wirft, wenn ein Eintrag fehlt.
    for (const m of METHOD_IDS) {
      expect(() => referenceMicron(m), `${m} hat keinen Zielbereich`).not.toThrow()
      expect(referenceMicron(m), `${m}`).toBeGreaterThan(0)
    }
  })

  it('jede Methode hat Vorgaben für jeden Röstgrad', () => {
    for (const m of METHOD_IDS) {
      for (const r of ROASTS) {
        const d = getMethodDefaults(m, r)
        expect(d?.doseG, `${m}/${r}: keine Dosis`).toBeGreaterThan(0)
        expect(d?.ratio, `${m}/${r}: kein Verhältnis`).toBeGreaterThan(0)
        expect(d?.waterTempC, `${m}/${r}: keine Temperatur`).toBeGreaterThan(50)
      }
    }
  })

  it('jede Methode liefert ein Zielzeitband', () => {
    for (const m of METHOD_IDS) {
      const band = targetTimeRange(m, getMethodDefaults(m, 'medium').doseG, 'medium')
      expect(band, `${m} hat kein Zielband`).toBeTruthy()
      expect(band![1]).toBeGreaterThan(band![0])
    }
  })

  it('die Physik ist eine der bekannten', () => {
    // `isImmersion()` vergleicht auf 'immersion'. Ein Tippfehler hier
    // macht aus einer Immersionsmethode stillschweigend eine Perkolation.
    for (const m of METHODS) {
      expect(
        ['immersion', 'gravity-percolation', 'pressure-percolation'],
        `${m.id}: ${m.physics}`,
      ).toContain(m.physics)
    }
  })
})

describe('Diagnoseregeln', () => {
  it('haben eindeutige Kennungen', () => {
    // Seit 2.0 wird je Regel Buch geführt (`regelId` in der Empfehlung).
    // Zwei Regeln mit derselben Kennung machen die Trefferquote wertlos.
    const ids = RULES.map((r) => r.id)
    expect(new Set(ids).size, `doppelte Regel-IDs: ${ids.filter((x, i) => ids.indexOf(x) !== i)}`).toBe(ids.length)
  })

  it('haben eine Kennung im erwarteten Format', () => {
    for (const r of RULES) expect(r.id, `Regel ohne saubere ID`).toMatch(/^[A-Z]-\d+$/)
  })

  it('nennen nur Methoden, die es gibt', () => {
    /**
     * `scope` trägt auch Bereiche, die keine Brühmethode sind — `milk`
     * und `iced` stehen für Regeln über Getränke, nicht über den Shot.
     * Alles andere muss eine Methode sein, sonst greift die Regel nie.
     */
    const ZUSATZ = ['all', 'milk', 'iced']
    for (const r of RULES) {
      for (const m of r.scope ?? []) {
        if (ZUSATZ.includes(m)) continue
        expect((METHOD_IDS as readonly string[]).includes(m), `Regel ${r.id} nennt ${m}`).toBe(true)
      }
    }
  })
})

describe('Herkünfte und Aufbereitungen', () => {
  it('jede Herkunft hat einen Namen und ein Land', () => {
    for (const o of ORIGINS) {
      expect(o.name, 'Herkunft ohne Namen').toBeTruthy()
    }
  })

  it('Eignungswerte liegen in der Skala 1 bis 5', () => {
    for (const o of ORIGINS) {
      for (const [m, v] of Object.entries(o.methodSuitability ?? {})) {
        expect(v, `${o.name}/${m}`).toBeGreaterThanOrEqual(1)
        expect(v, `${o.name}/${m}`).toBeLessThanOrEqual(5)
      }
    }
  })

  it('jede Aufbereitung nennt ihren Fruchtkontakt', () => {
    for (const p of PROCESSES) {
      expect(p.id, 'Aufbereitung ohne Kennung').toBeTruthy()
    }
  })
})

describe('Mühlen', () => {
  it('nur stufenlose Mühlen kommen ohne Schrittweite aus', () => {
    // Eine stufenlose Mühle HAT keine Schrittweite — das ist die Natur
    // des Geräts, kein fehlender Wert. Eine gerastete ohne wäre einer.
    for (const g of GRINDER_CATALOG) {
      if (g.scaleType === 'stepless') continue
      expect(g.micronPerStep, `${g.name} ist gerastet, hat aber keine Schrittweite`).toBeGreaterThan(0)
    }
  })

  it('jeder Katalogeintrag lässt sich zu einer benutzbaren Mühle machen', () => {
    /**
     * Das ist die Frage, die zählt: Die App legt aus jedem Eintrag ein
     * `Grinder`-Objekt an, und dessen `micronPerStep` ist Pflicht. Eine
     * stufenlose Mühle muss dabei einen brauchbaren Ersatzwert bekommen —
     * sonst rechnet die Engine später mit `undefined`.
     */
    for (const g of GRINDER_CATALOG) {
      const angelegt = grinderFromCatalog(g.id, `test-${g.id}`)
      expect(angelegt, `${g.name} lässt sich nicht anlegen`).toBeTruthy()
      expect(angelegt!.micronPerStep, `${g.name}: keine Schrittweite`).toBeGreaterThan(0)
    }
  })

  it('jede Mühle nennt nur Methoden, die es gibt', () => {
    for (const g of GRINDER_CATALOG) {
      for (const m of g.methods ?? []) {
        expect((METHOD_IDS as readonly string[]).includes(m), `${g.name} nennt ${m}`).toBe(true)
      }
    }
  })
})

describe('Glossar', () => {
  it('jeder Begriff hat Kennung, Titel und Erklärung', () => {
    for (const t of GLOSSARY) {
      expect(t.id, 'Begriff ohne Kennung').toBeTruthy()
      expect(t.term, `${t.id}: kein Titel`).toBeTruthy()
    }
  })

  it('Kennungen sind eindeutig', () => {
    const ids = GLOSSARY.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('Mühlenkatalog', () => {
  /**
   * Die Sage Barista Express trug `confidence: "derived"` — ein Wert,
   * den der Typ `Grinder` nicht kennt (estimated | measured | vendor).
   * `grinderFromCatalog` reicht das Feld unverändert durch, also stand
   * es anschließend im Bestand des Nutzers und der Typ log.
   */
  it('nennt nur Vertrauensstufen, die der Typ kennt', () => {
    const erlaubt = ['estimated', 'measured', 'vendor']
    for (const g of GRINDER_CATALOG) {
      expect(erlaubt, `${g.id} führt „${g.confidence}"`).toContain(g.confidence)
    }
  })
})
