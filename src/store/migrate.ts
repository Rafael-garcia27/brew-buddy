/**
 * Migration und Sicherungsformat — bewusst ohne Browser-Schnittstellen.
 *
 * Das ist der einzige Code, der zwischen dem Nutzer und seiner Historie
 * steht: Jedes Update läuft hier durch. Deshalb liegt er getrennt von
 * `persist.ts` (das IndexedDB und `window` braucht) und ist vollständig
 * testbar.
 *
 * Grundregel: Migration darf Felder ERGÄNZEN und Einstellungen anpassen,
 * aber niemals Bohnen, Tüten oder Durchgänge verlieren.
 */
import type { AppState } from '@/domain'
import { emptyState, DEFAULT_SETTINGS } from '@/domain'
import { SCHEMA_VERSION, INTEGRATED_GRINDER_ID } from '@/config'
import { grinderFromCatalog } from '@/engine/grinder'

export function migrate(state: AppState): AppState {
  let s = state
  if (s.schemaVersion === undefined) s = { ...s, schemaVersion: 1 }

  // Schema 1 → 2: Der alte Standard war 'dark'. Wer die App nie umgestellt
  // hat, trägt diesen Wert nur, weil er einmal voreingestellt war — nicht
  // weil er gewählt wurde. Beim Wechsel auf die Kaffee-Palette wird er
  // einmalig auf den neuen Standard gesetzt.
  if ((s.schemaVersion ?? 1) < 2) {
    s = { ...s, settings: { ...s.settings, theme: DEFAULT_SETTINGS.theme } }
  }

  // Vorversion kannte drei Detailstufen. Alles außer „basis" wird Pro.
  const legacy = (s.settings as unknown as { expertLevel?: string })?.expertLevel
  if (legacy && !(s.settings as { mode?: string }).mode) {
    s = { ...s, settings: { ...s.settings, mode: legacy === 'basis' ? 'basic' : 'pro' } }
  }

  // Schema 2 → 3: Die im Siebträger verbaute Mühle wird nachgetragen.
  // Sie kommt HINZU — die Handmühle und alle Kalibrierungen bleiben
  // unangetastet, und die Espressoauswahl wird nicht vorbelegt.
  // `grinders` kann in einer beschädigten oder alten Sicherung fehlen —
  // die Migration muss auch damit durchlaufen, statt hier abzubrechen.
  const vorhandene = s.grinders ?? []
  if ((s.schemaVersion ?? 1) < 3 && !vorhandene.some((g) => g.catalogId === INTEGRATED_GRINDER_ID)) {
    const g = grinderFromCatalog(INTEGRATED_GRINDER_ID, `gr-${INTEGRATED_GRINDER_ID}`)
    if (g) s = { ...s, grinders: [...vorhandene, g] }
  }

  // Schema 3 → 4: `empfehlungen` kommt dazu. Kein eigener Schritt nötig —
  // das Auffüllen unten setzt die leere Liste. Der Versionssprung steht
  // trotzdem hier, damit die Nummer die Form beschreibt und nicht nur
  // zählt, wie oft etwas passiert ist.

  // Künftige Migrationen hier, jeweils mit Versionssprung.

  // Auffüllen: Neue Felder bekommen Vorgabewerte, vorhandene Daten gewinnen.
  // Reihenfolge wichtig — `s` steht hinter `base`, sonst würden gespeicherte
  // Bohnen von leeren Listen überschrieben.
  const base = emptyState(SCHEMA_VERSION)
  return {
    ...base,
    ...s,
    settings: { ...base.settings, ...s.settings },
    learned: { ...base.learned, ...s.learned },
    schemaVersion: SCHEMA_VERSION,
  }
}

// ── Sicherungsformat ──────────────────────────────────────────────────

export interface BackupFile {
  /** Seit der Umbenennung 'cafe'. Alte Sicherungen tragen 'dialed'. */
  app: 'cafe' | 'dialed'
  schemaVersion: number
  exportedAt: string
  state: AppState
}

export function buildBackup(state: AppState, now: Date): BackupFile {
  return {
    app: 'cafe',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    state,
  }
}

export function backupFilename(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `cafe-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`
}

export function parseBackup(text: string): { state: AppState } | { error: string } {
  try {
    const parsed = JSON.parse(text) as BackupFile
    // Beide Kennungen akzeptieren: Sicherungen von vor der Umbenennung
    // müssen sich weiterhin einspielen lassen.
    if ((parsed.app !== 'cafe' && parsed.app !== 'dialed') || !parsed.state)
      return { error: 'Das ist keine Café-Sicherung.' }
    return { state: migrate(parsed.state) }
  } catch {
    return { error: 'Die Datei ließ sich nicht lesen.' }
  }
}
