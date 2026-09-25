/**
 * Der Rettungsweg aus dem Fehlerbildschirm.
 *
 * Anlass ist Befund F-03: Ein Renderfehler entlädt den Baum, und in der
 * installierten PWA gibt es weder Adresszeile noch Neu-laden-Knopf. Der
 * Fehlerbildschirm braucht deshalb einen Knopf, der die Daten herausholt.
 *
 * Dieser Knopf hat eine harte Bedingung: Er muss funktionieren, wenn sonst
 * nichts mehr funktioniert. Also nicht über den Store (der kann leer sein,
 * wenn der Absturz beim Laden passierte) und nicht über `migrate()` (das
 * kann die Ursache sein). Er arbeitet mit dem rohen Blob aus der Datenbank,
 * so wie er dort liegt.
 */
import { describe, it, expect } from 'vitest'
import { rettungsdatei, fehlerZeile, fehlerDetails } from './rescue'

const jetzt = new Date('2026-09-12T18:30:00.000Z')

describe('Rettungsdatei', () => {
  it('packt den Blob ein, wie er ist', () => {
    const roh = { schemaVersion: 4, beans: [{ id: 'a' }], settings: {} }
    const d = rettungsdatei(roh, jetzt)!
    expect(JSON.parse(d.json).state).toEqual(roh)
  })

  it('trägt die Schemaversion DES BLOBS, nicht die aktuelle', () => {
    // Sonst stünde auf einer alten Sicherung eine neue Versionsnummer —
    // und beim Einspielen würden die Migrationsschritte übersprungen.
    const d = rettungsdatei({ schemaVersion: 1, beans: [] }, jetzt)!
    expect(JSON.parse(d.json).schemaVersion).toBe(1)
  })

  it('lässt sich von der Import-Prüfung als Brew-Buddy-Sicherung erkennen', () => {
    const d = rettungsdatei({ schemaVersion: 4, beans: [] }, jetzt)!
    expect(JSON.parse(d.json).app).toBe('brew-buddy')
  })

  it('rettet auch einen Blob, der gar nicht nach Zustand aussieht', () => {
    // Genau dieser Fall ist der Grund für die Datei: Was `migrate()`
    // ablehnt, ist trotzdem die Arbeit des Nutzers.
    const d = rettungsdatei({ beans: 'beschädigt' }, jetzt)!
    expect(JSON.parse(d.json).state).toEqual({ beans: 'beschädigt' })
    expect(JSON.parse(d.json).schemaVersion).toBe(0)
  })

  it('sagt nein, wenn nichts gespeichert ist', () => {
    expect(rettungsdatei(undefined, jetzt)).toBeNull()
    expect(rettungsdatei(null, jetzt)).toBeNull()
  })

  it('trägt das Datum im Dateinamen', () => {
    expect(rettungsdatei({ schemaVersion: 4 }, jetzt)!.name).toContain('2026-09-12')
  })

  it('gibt null zurück, statt selbst abzustürzen', () => {
    // Ein Rettungsweg, der wirft, ist kein Rettungsweg.
    const kreis: Record<string, unknown> = {}
    kreis.selbst = kreis
    expect(rettungsdatei(kreis, jetzt)).toBeNull()
  })
})

describe('Fehlertext', () => {
  it('nennt Art und Wortlaut', () => {
    expect(fehlerZeile(new TypeError('x ist undefined'))).toBe('TypeError: x ist undefined')
  })

  it('kommt mit allem klar, was geworfen werden kann', () => {
    // In JavaScript darf man jeden Wert werfen, nicht nur Error.
    expect(fehlerZeile('einfach ein Text')).toBe('einfach ein Text')
    expect(fehlerZeile(undefined)).toBeTruthy()
    expect(fehlerZeile({ code: 7 })).toContain('7')
  })

  it('bleibt kurz genug für einen Bildschirm', () => {
    expect(fehlerZeile(new Error('x'.repeat(5000))).length).toBeLessThanOrEqual(300)
  })
})

describe('Fehlerdetails', () => {
  it('zeigt die obersten Zeilen des Aufrufstapels', () => {
    const e = new Error('kaputt')
    e.stack = 'Error: kaputt\n  at eins\n  at zwei\n  at drei\n  at vier\n  at fuenf\n  at sechs'
    const d = fehlerDetails(e)
    expect(d).toContain('at eins')
    expect(d).not.toContain('at sechs')
  })

  it('wirft die Herkunft aus den Pfaden', () => {
    // Auf 375 px ist `http://localhost:5173` in jeder Zeile dasselbe
    // und kostet den Platz, an dem die Datei stünde.
    const e = new Error('kaputt')
    e.stack = 'Error: kaputt\n  at App (http://localhost:5173/src/App.tsx:106:51)'
    expect(fehlerDetails(e)).toContain('at App (/src/App.tsx:106:51)')
  })

  it('kommt ohne Aufrufstapel aus', () => {
    expect(fehlerDetails('nur ein Text')).toBe('nur ein Text')
  })
})
