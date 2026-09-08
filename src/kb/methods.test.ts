/**
 * Eine neue Methode ist halb eingebaut, bevor sie ganz eingebaut ist.
 *
 * Der Compiler fängt den größeren Teil: `Record<BrewMethod, …>` bricht bei
 * jedem neuen Wert, und genau dafür ist `BrewMethod` ein Literal-Union und
 * kein `string`. Was er NICHT fängt, ist alles, was aus JSON kommt —
 * Frischefenster, Retentionswasser, Zielzeiten, Eignungsmatrix. Dort
 * ergänzt eine fehlende Methode keinen Fehler, sondern einen stillen
 * Rückfallwert: irgendeine Zahl, die plausibel aussieht.
 *
 * Diese Datei ist die Gegenprobe für die JSON-Seite.
 */
import { describe, it, expect } from 'vitest'
import diagnosticsRaw from '@data/diagnostics.json'
import methodsRaw from '@data/methods.json'
import type { RoastLevel } from '@domain'
import {
  FRESHNESS_PARAMS,
  METHOD_IDS,
  getMethod,
  getMethodDefaults,
  lrrFor,
  targetTimeRange,
  timeSignalsGrind,
  isImmersion,
  referenceMicron,
} from './index'
import { METHODS, METHOD_LABEL, METHOD_SHORT, ROAST_LABEL } from '@/labels'
import { METHOD_ICON_IDS } from '@/components/methodicons'
import { suitability } from '@/engine/suitability'

const ROSTGRADE = Object.keys(ROAST_LABEL) as RoastLevel[]

describe('Jede Methode ist vollständig', () => {
  it('steht in der Anzeigeliste und in den Daten — in beiden', () => {
    expect([...METHODS].sort()).toEqual([...METHOD_IDS].sort())
  })

  it('hat eine Beschriftung, eine Kurzform und einen Einzeiler', () => {
    for (const m of METHODS) {
      expect(METHOD_LABEL[m]).toBeTruthy()
      expect(METHOD_SHORT[m]).toBeTruthy()
      // Der Einzeiler trägt die Katalogkachel — ohne ihn ist sie leer.
      expect((getMethod(m) as unknown as { short?: string }).short?.length ?? 0).toBeGreaterThan(20)
    }
  })

  it('hat ein Symbol für den Katalog', () => {
    for (const m of methodsRaw.methods) {
      expect((m as { icon?: string }).icon).toBeTruthy()
    }
  })

  it('hat Vorgaben für jeden Röstgrad', () => {
    for (const m of METHODS) {
      for (const r of ROSTGRADE) {
        const d = getMethodDefaults(m, r)
        expect(d.doseG).toBeGreaterThan(0)
        expect(d.ratio).toBeGreaterThan(0)
        expect(d.waterTempC).toBeGreaterThan(60)
      }
    }
  })

  it('hat ein Frischefenster für jeden Röstgrad', () => {
    // Fehlt es, rechnet die Frische-Engine mit einem Rückfallwert weiter
    // und nennt für eine Tüte zwei verschiedene Tageszahlen, je nachdem,
    // welcher Bildschirm fragt.
    for (const m of METHODS) {
      const p = FRESHNESS_PARAMS[m]
      expect(p, `Frischefenster fehlt für ${m}`).toBeDefined()
      for (const r of ROSTGRADE) {
        expect(p[r]?.tPeak, `${m}/${r}`).toBeGreaterThan(0)
        expect(p[r]?.sigma, `${m}/${r}`).toBeGreaterThan(0)
      }
    }
  })

  it('hat ein Retentionswasser, das zur Physik passt', () => {
    for (const m of METHODS) {
      const lrr = lrrFor(m)
      // Espresso hat keins — dort ist der Puck nicht das Getränk.
      if (m === 'espresso') expect(lrr).toBe(0)
      else expect(lrr, `LRR fehlt für ${m}`).toBeGreaterThan(0)
    }
  })

  it('begründet ihre Eignung mit eigenen Worten', () => {
    const proben = ROSTGRADE.map((roastLevel) => ({
      id: 'x',
      name: 'x',
      origins: [{ country: 'Kolumbien' }],
      process: 'washed' as const,
      roastLevel,
      createdAt: new Date().toISOString(),
    }))
    for (const b of proben) {
      const texte = METHODS.map((m) => suitability(b, m).reason)
      expect(new Set(texte).size).toBe(METHODS.length)
    }
  })
})

describe('Zeit und Mahlgrad hängen nicht überall zusammen', () => {
  it('deckt sich mit dem, was diagnostics.json in D-90/D-91 sagt', () => {
    // Gegen die Daten geprüft, nicht gegen eine Kopie der Erwartung: Wer
    // den scope in diagnostics.json ändert, ändert damit das Verhalten —
    // und dieser Test sagt es ihm.
    const rules = diagnosticsRaw.runCheck.rules as { id: string; scope?: string[] }[]
    const scopeOf = (id: string) => rules.find((r) => r.id === id)?.scope
    expect(scopeOf('D-90')).toEqual(scopeOf('D-91'))
    for (const m of METHODS) {
      expect(timeSignalsGrind(m)).toBe(scopeOf('D-90')!.includes(m))
    }
    expect(timeSignalsGrind('espresso')).toBe(true)
    expect(timeSignalsGrind('v60')).toBe(true)
    expect(timeSignalsGrind('aeropress')).toBe(false)
    expect(timeSignalsGrind('frenchpress')).toBe(false)
    // Perkolation, aber die Zeit gehört der Pumpe (kb/10c §4).
    expect(timeSignalsGrind('batchbrew')).toBe(false)
  })

  it('ist nicht mehr dasselbe wie Immersion', () => {
    // Solange es vier Methoden waren, waren die beiden Fragen
    // deckungsgleich, und der Code prüfte die falsche.
    const abweichler = METHODS.filter((m) => isImmersion(m) !== !timeSignalsGrind(m))
    expect(abweichler).toEqual(['batchbrew'])
  })

  it('gibt jeder Methode mit Zielzeiten auch ein Band für ihre Dosen', () => {
    for (const m of METHODS) {
      const dosen = (getMethod(m) as unknown as { targetTimeByDose?: { doseG: number }[] })
        .targetTimeByDose
      if (!dosen) continue
      for (const d of dosen) {
        const band = targetTimeRange(m, d.doseG, 'medium')
        expect(band, `${m} bei ${d.doseG} g`).toBeTruthy()
        expect(band![1]).toBeGreaterThan(band![0])
      }
    }
  })
})

describe('Angekündigte Methoden bleiben außerhalb der Engine', () => {
  const announced = (methodsRaw as unknown as {
    announced: { id: string; label: string; icon: string; teaser: string; why: string }[]
  }).announced

  it('taucht in keiner Methodenliste auf', () => {
    // Der eigentliche Schutz ist der Typ: Eine angekündigte Methode ist
    // keine BrewMethod und kann deshalb keinen Startpunkt erreichen. Diese
    // Prüfung stellt sicher, dass niemand sie versehentlich einreiht.
    for (const a of announced) {
      expect(METHOD_IDS as string[]).not.toContain(a.id)
      expect(METHODS as string[]).not.toContain(a.id)
    }
  })

  it('sagt, was sie ist und warum sie noch nicht geht', () => {
    for (const a of announced) {
      expect(a.label).toBeTruthy()
      expect(a.icon).toBeTruthy()
      expect(a.teaser.length).toBeGreaterThan(30)
      // „Kommt später" ist keine Auskunft. Der Grund ist eine fachliche
      // Aussage und gehört genauso geprüft wie der Rest der Wissensbasis.
      expect(a.why.length).toBeGreaterThan(60)
    }
  })

  it('hat eindeutige Kennungen', () => {
    const alle = [...announced.map((a) => a.id), ...(METHOD_IDS as string[])]
    expect(new Set(alle).size).toBe(alle.length)
  })
})

describe('Jedes Symbol wird auch gezeichnet', () => {
  it('kennt eine Zeichnung für jede Methode und jede Ankündigung', () => {
    // Die Kennungen stehen in methods.json, gezeichnet wird in
    // methodicons.tsx. Zwei Orte, die auseinanderlaufen können — und ein
    // fehlendes Symbol fällt nicht auf, es zeichnet einfach einen Kreis.
    const kennungen = [
      ...methodsRaw.methods.map((m) => (m as { icon?: string }).icon),
      ...(methodsRaw as unknown as { announced: { icon: string }[] }).announced.map((a) => a.icon),
    ]
    expect(kennungen.filter((k) => !k || !METHOD_ICON_IDS.includes(k))).toEqual([])
  })

  it('zeichnet nichts, was niemand benutzt', () => {
    const benutzt = new Set([
      ...methodsRaw.methods.map((m) => (m as { icon?: string }).icon),
      ...(methodsRaw as unknown as { announced: { icon: string }[] }).announced.map((a) => a.icon),
    ])
    expect(METHOD_ICON_IDS.filter((id) => !benutzt.has(id))).toEqual([])
  })
})

describe('Der Mahlgrad braucht für jede Methode einen Bezugspunkt', () => {
  it('hat einen Zielbereich in µm', () => {
    // `referenceMicron` wirft absichtlich, statt still den Wert einer
    // anderen Methode zu nehmen. Ohne diesen Test merkt man das erst,
    // wenn der Brühbildschirm weiß bleibt — so ist es beim Einbau der
    // Filterkaffeemaschine tatsächlich passiert.
    for (const m of METHODS) {
      expect(() => referenceMicron(m), `Zielbereich fehlt für ${m}`).not.toThrow()
      expect(referenceMicron(m)).toBeGreaterThan(0)
    }
  })

  it('ordnet die Methoden nach Feinheit, wie die Physik es verlangt', () => {
    // Espresso am feinsten, French Press am gröbsten, die Maschine
    // zwischen V60 und French Press (kb/10c §2.1).
    expect(referenceMicron('espresso')).toBeLessThan(referenceMicron('aeropress'))
    expect(referenceMicron('v60')).toBeLessThan(referenceMicron('batchbrew'))
    expect(referenceMicron('batchbrew')).toBeLessThan(referenceMicron('frenchpress'))
  })
})

describe('Die Maschine ist die verlässliche, nicht die beste', () => {
  /**
   * kb/10c §5: „das Profil eines V60 mit weniger Klarheit und weniger
   * Kontrolle". Der erste Anlauf gab ihr für mittlere Röstungen eine 5 —
   * damit gewann sie im Regal gegen den V60, und die Liste behauptete
   * das Gegenteil des Wissenskapitels.
   */
  const matrix = (id: string) =>
    (methodsRaw.methods.find((m) => m.id === id) as unknown as {
      suitability: Record<string, Record<string, number>>
    }).suitability

  it('bewertet keine Bohne als ideal', () => {
    const werte = Object.entries(matrix('batchbrew'))
      .filter(([k]) => !k.startsWith('_'))
      .flatMap(([, row]) => Object.values(row))
    expect(Math.max(...werte)).toBeLessThan(5)
  })

  it('liegt am hellen Ende unter dem V60 und am dunklen darüber', () => {
    const m = matrix('batchbrew')
    const v = matrix('v60')
    expect(m['light']!['washed']!).toBeLessThan(v['light']!['washed']!)
    expect(m['dark']!['washed']!).toBeGreaterThan(v['dark']!['washed']!)
  })

  it('hat ihren Höhepunkt bei mittlerer Röstung', () => {
    const m = matrix('batchbrew')
    const reihe = ['light', 'medium-light', 'medium', 'medium-dark', 'dark'].map(
      (l) => m[l]!['washed']!,
    )
    expect(Math.max(...reihe)).toBe(m['medium']!['washed']!)
    // Und fällt zu beiden Seiten ab — eine flache Kurve wäre keine Aussage.
    expect(reihe[0]!).toBeLessThan(reihe[2]!)
    expect(reihe[4]!).toBeLessThan(reihe[2]!)
  })
})
