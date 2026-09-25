/**
 * Der Rettungsweg aus dem Fehlerbildschirm.
 *
 * Wenn der Bildschirm nicht mehr gezeichnet werden kann, ist die einzige
 * Frage, die noch zählt: Kommt der Nutzer an seine Daten? Diese Datei
 * beantwortet sie — und zwar unter der Annahme, dass alles andere kaputt
 * ist.
 *
 * Daraus folgen drei Regeln, die hier bewusst anders sind als im normalen
 * Sicherungsweg (`shareBackup`):
 *
 *  1. **Kein Store.** Stürzt die App schon beim Laden ab, steht dort nichts.
 *  2. **Kein `migrate()`.** Wenn der gespeicherte Bestand die Ursache ist,
 *     wirft genau der Schritt, den man hier bräuchte.
 *  3. **Keine Prüfung des Inhalts.** Was `migrate()` ablehnen würde, ist
 *     trotzdem die Arbeit des Nutzers und gehört gerettet.
 *
 * Deshalb wird der rohe Blob eingepackt, unverändert, mitsamt seiner
 * eigenen Schemaversion.
 *
 * Ohne Browser-Schnittstellen, aus demselben Grund wie `startup.ts`.
 */

export interface Rettungsdatei {
  /** Dateiname — bewusst anders als bei `backupFilename()`, siehe unten. */
  name: string
  json: string
}

/** So viele Zeilen Aufrufstapel passen auf einen Telefonbildschirm. */
const STAPELZEILEN = 4
const MAX_ZEILE = 300

/**
 * Den rohen Blob in eine Datei packen, die sich später einspielen lässt.
 *
 * `null`, wenn nichts zu retten ist oder sich nichts einpacken lässt —
 * ein Rettungsweg, der selbst wirft, ist kein Rettungsweg.
 */
export function rettungsdatei(roh: unknown, jetzt: Date): Rettungsdatei | null {
  if (roh === null || roh === undefined) return null

  /**
   * Die Schemaversion DES BLOBS, nicht die aktuelle.
   *
   * `buildBackup()` stempelt `SCHEMA_VERSION` auf, weil es einen Zustand
   * sichert, der gerade durch `migrate()` gelaufen ist. Hier ist das
   * gegenteilig: Der Blob ist ungeprüft und womöglich alt. Eine zu hohe
   * Nummer daraufzuschreiben hieße, beim Einspielen Migrationsschritte
   * zu überspringen — aus einem lesbaren Problem würde ein stilles.
   */
  const version =
    typeof roh === 'object' && typeof (roh as { schemaVersion?: unknown }).schemaVersion === 'number'
      ? (roh as { schemaVersion: number }).schemaVersion
      : 0

  try {
    const json = JSON.stringify(
      { app: 'brew-buddy', schemaVersion: version, exportedAt: jetzt.toISOString(), state: roh },
      null,
      2,
    )
    // JSON.stringify(undefined) gibt undefined zurück, nicht "undefined".
    if (typeof json !== 'string') return null
    return { name: dateiname(jetzt), json }
  } catch {
    // Zirkelbezug oder BigInt im Blob. Sehr unwahrscheinlich, aber der
    // Aufrufer steht schon im Fehlerfall und braucht eine Antwort.
    return null
  }
}

/**
 * „rettung" statt „backup" im Namen — mit Absicht.
 *
 * Diese Datei kann einen beschädigten Bestand enthalten. Sähe sie aus wie
 * eine gesunde Sicherung, würde sie im Ordner irgendwann mit einer
 * verwechselt.
 */
function dateiname(jetzt: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `brew-buddy-rettung-${jetzt.getFullYear()}-${p(jetzt.getMonth() + 1)}-${p(jetzt.getDate())}.json`
}

/** Eine Zeile, die sagt, was passiert ist. Geworfen werden kann alles. */
export function fehlerZeile(e: unknown): string {
  let s: string
  if (e instanceof Error) s = `${e.name}: ${e.message}`
  else if (typeof e === 'string') s = e
  else {
    try {
      s = JSON.stringify(e) ?? String(e)
    } catch {
      s = String(e)
    }
  }
  return s.length > MAX_ZEILE ? `${s.slice(0, MAX_ZEILE - 1)}…` : s
}

/**
 * Fehlerzeile plus die obersten Stapelzeilen.
 *
 * Die App hat keine Fehlerübermittlung und soll auch keine bekommen
 * (E-Entscheidung „keine Fremddienste"). Was hier nicht auf dem Bildschirm
 * steht, erfährt niemand je.
 */
export function fehlerDetails(e: unknown): string {
  const kopf = fehlerZeile(e)
  if (!(e instanceof Error) || !e.stack) return kopf
  const stapel = e.stack
    .split('\n')
    .filter((z) => z.trim().startsWith('at '))
    .slice(0, STAPELZEILEN)
    // Ohne Herkunft: `http://localhost:5173/src/App.tsx` wird zu
    // `/src/App.tsx`. Auf 375 px ist die Domain vier Zeilen Umbruch
    // wert, die in jeder Stapelzeile dasselbe sagen.
    .map((z) => z.replace(/https?:\/\/[^/)\s]+/g, ''))
  return stapel.length ? `${kopf}\n${stapel.join('\n')}` : kopf
}
