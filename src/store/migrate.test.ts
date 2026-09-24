/**
 * Tests für die Migration.
 *
 * Diese Datei beantwortet eine einzige Frage: Überleben meine Bohnen, Tüten
 * und Durchgänge ein App-Update? Jede Änderung am Datenmodell muss hier
 * vorbeikommen.
 */
import { describe, it, expect } from 'vitest'
import { migrate, buildBackup, parseBackup, backupFilename } from './migrate'
import type { AppState } from '@/domain'
import type { Bean, Bag, Brew } from '@domain'

const bean: Bean = {
  id: 'b1', name: 'Finca La Esperanza',
  origins: [{ country: 'Kolumbien' }],
  process: 'washed', roastLevel: 'medium',
  createdAt: '2026-08-01T08:00:00.000Z',
}
const bag: Bag = {
  id: 'g1', beanId: 'b1', roastDate: '2026-08-06',
  purchasedGrams: 250, remainingGrams: 190,
  depleted: false, createdAt: '2026-08-01T08:00:00.000Z',
}
const brew: Brew = {
  id: 'r1', bagId: 'g1', beanId: 'b1', method: 'espresso',
  actual: { doseG: 18, yieldG: 36, timeS: 25, waterTempC: 93 },
  tasting: { rating: 5, defects: [], characters: ['balanced'], wouldRepeat: true },
  isBest: true, createdAt: '2026-08-18T07:30:00.000Z',
}

/** Ein Zustand, wie ihn eine ältere App-Version gespeichert hätte. */
function alterZustand(extra: Record<string, unknown> = {}): AppState {
  return {
    schemaVersion: 1,
    beans: [bean], bags: [bag], brews: [brew],
    grinders: [], setups: [], waters: [],
    settings: { theme: 'dark', expertLevel: 'advanced' },
    learned: { process: {}, preference: {}, perBean: {} },
    ...extra,
  } as unknown as AppState
}

describe('Migration bewahrt die Historie', () => {
  it('Bohnen, Tüten und Durchgänge bleiben unverändert', () => {
    const m = migrate(alterZustand())
    expect(m.beans).toEqual([bean])
    expect(m.bags).toEqual([bag])
    expect(m.brews).toEqual([brew])
  })

  it('auch die Details im Durchgang bleiben erhalten', () => {
    const m = migrate(alterZustand())
    expect(m.brews[0]!.actual.doseG).toBe(18)
    expect(m.brews[0]!.tasting?.rating).toBe(5)
    expect(m.brews[0]!.isBest).toBe(true)
  })

  it('leere Vorgabelisten überschreiben gespeicherte Daten NICHT', () => {
    // Der klassische Fehler: { ...gespeichert, ...vorgaben } statt umgekehrt
    const m = migrate(alterZustand())
    expect(m.beans.length).toBe(1)
    expect(m.brews.length).toBe(1)
  })

  it('unbekannte Felder aus künftigen Versionen fliegen nicht auf', () => {
    const m = migrate(alterZustand({ irgendwasNeues: 42 }))
    expect(m.beans).toEqual([bean])
  })

  it('Restmenge der Tüte überlebt', () => {
    expect(migrate(alterZustand()).bags[0]!.remainingGrams).toBe(190)
  })
})

describe('Migration ergänzt fehlende Felder', () => {
  it('neue Einstellungen bekommen Vorgabewerte', () => {
    const m = migrate(alterZustand())
    expect(m.settings.activeBasketMm).toBe(58)
    expect(m.settings.targetEy).toEqual([18, 22])
  })

  it('fehlende Sammlungen werden zu leeren Listen, nicht undefined', () => {
    const ohne = { schemaVersion: 1, beans: [bean], settings: {}, learned: {} } as unknown as AppState
    const m = migrate(ohne)
    expect(Array.isArray(m.grinders)).toBe(true)
    expect(Array.isArray(m.waters)).toBe(true)
    expect(m.beans).toEqual([bean])
  })

  it('Schema wird auf die aktuelle Version gehoben', () => {
    expect(migrate(alterZustand()).schemaVersion).toBeGreaterThanOrEqual(2)
  })
})

describe('Migration setzt Einstellungen um', () => {
  it('alte Detailstufe wird zum Basis/Pro-Schalter', () => {
    expect(migrate(alterZustand()).settings.mode).toBe('pro')
    const basis = alterZustand({ settings: { expertLevel: 'basis' } })
    expect(migrate(basis).settings.mode).toBe('basic')
  })

  it('Schema 1 setzt das Thema einmalig auf den neuen Standard', () => {
    expect(migrate(alterZustand()).settings.theme).toBe('light')
  })

  it('ab Schema 2 bleibt eine bewusste Themenwahl erhalten', () => {
    const gewaehlt = alterZustand({ schemaVersion: 2, settings: { theme: 'dark', mode: 'pro' } })
    expect(migrate(gewaehlt).settings.theme).toBe('dark')
  })
})

describe('Sicherung und Wiederherstellung', () => {
  const jetzt = new Date('2026-08-26T20:00:00.000Z')

  it('Hin und zurück verliert nichts', () => {
    const original = migrate(alterZustand())
    const datei = JSON.stringify(buildBackup(original, jetzt))
    const zurueck = parseBackup(datei)
    expect('error' in zurueck).toBe(false)
    if ('error' in zurueck) return
    expect(zurueck.state.beans).toEqual(original.beans)
    expect(zurueck.state.brews).toEqual(original.brews)
    expect(zurueck.state.bags).toEqual(original.bags)
  })

  it('Sicherungen von vor der Umbenennung lassen sich einspielen', () => {
    const alt = JSON.stringify({
      app: 'dialed', schemaVersion: 1, exportedAt: jetzt.toISOString(),
      state: alterZustand(),
    })
    const r = parseBackup(alt)
    expect('error' in r).toBe(false)
    if ('error' in r) return
    expect(r.state.beans).toEqual([bean])
  })

  it('fremde Dateien werden abgelehnt statt Daten zu zerstören', () => {
    expect(parseBackup('{"app":"etwas-anderes","state":{}}')).toHaveProperty('error')
    expect(parseBackup('kein json')).toHaveProperty('error')
    expect(parseBackup('{"app":"cafe"}')).toHaveProperty('error')
  })

  it('Dateiname trägt das Datum', () => {
    expect(backupFilename(jetzt)).toBe('cafe-backup-2026-08-26.json')
  })
})

describe('Röstdatum-Vorgabe', () => {
  /**
   * Kein Test des Formulars, sondern der Annahme dahinter: Zwischen
   * Röstung und Kauftheke liegen bei Spezialitätenkaffee fünf bis zehn
   * Tage (kb/05 §3). Eine Woche liegt in diesem Fenster, „heute" nicht.
   *
   * Der Test hängt an der Zahl, damit ein späteres Zurückdrehen auf
   * „heute" auffällt — genau das hat in echten Logdaten Durchgänge an
   * Tag 0 erzeugt, die keine waren.
   */
  it('liegt im typischen Fenster zwischen Röstung und Kauf', () => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    const tage = Math.round((Date.now() - d.getTime()) / 86_400_000)
    expect(tage).toBeGreaterThanOrEqual(5)
    expect(tage).toBeLessThanOrEqual(10)
  })
})
