/**
 * Persistenz.
 *
 * Leitentscheidung E4: Der gesamte Zustand liegt als EIN JSON-Blob in
 * IndexedDB. Bei 1000 Brews sind das unter 500 KB — Lesen ist damit
 * effektiv synchron, Export ist trivial, und es gibt keine Migrationshölle
 * über mehrere Object Stores hinweg.
 *
 * Briefing C5: Safari löscht IndexedDB einer PWA nach 7 Tagen ohne Nutzung.
 * Die Historie IST das Produkt — deshalb ist Backup hier kein Extra.
 */
import { openDB, type IDBPDatabase } from 'idb'
import type { AppState } from '@/domain'
import { migrate, buildBackup, backupFilename, parseBackup } from './migrate'
export { migrate, buildBackup, backupFilename, parseBackup }
export type { BackupFile } from './migrate'

// ACHTUNG: Der Datenbankname bleibt 'dialed', obwohl die App inzwischen
// Café heißt. Eine Umbenennung würde eine NEUE, leere Datenbank anlegen und
// alle bisherigen Bohnen, Tüten und Protokolle verwaisen lassen. Der Name ist
// ein interner Schlüssel, kein Anzeigetext — er darf nie geändert werden.
const DB_NAME = 'dialed'
const DB_VERSION = 1
const STORE = 'state'
const KEY = 'app'

let dbPromise: Promise<IDBPDatabase> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE)
      },
    })
  }
  return dbPromise
}

/**
 * Was beim Laden herausgekommen ist — drei Fälle, nicht zwei.
 *
 * „Nichts gespeichert" und „Speicher nicht lesbar" sahen vorher gleich
 * aus: Beide lieferten einen leeren Zustand. Der Aufrufer konnte sie
 * deshalb nicht unterscheiden und hat den leeren Zustand in beiden Fällen
 * zurückgeschrieben — im zweiten über echte Daten drüber.
 */
export type LoadResult =
  | { kind: 'ok'; state: AppState }
  | { kind: 'empty' }
  | { kind: 'failed'; error: unknown }

export async function loadState(): Promise<LoadResult> {
  try {
    const d = await db()
    const raw = (await d.get(STORE, KEY)) as AppState | undefined
    if (!raw) return { kind: 'empty' }
    return { kind: 'ok', state: migrate(raw) }
  } catch (e) {
    console.error('[persist] Laden fehlgeschlagen', e)
    return { kind: 'failed', error: e }
  }
}

let writeTimer: ReturnType<typeof setTimeout> | null = null
let pending: AppState | null = null

/** Gebündeltes Schreiben — die UI soll nie auf die Platte warten. */
export function saveState(state: AppState): void {
  pending = state
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(flush, 300)
}

export async function flush(): Promise<void> {
  if (!pending) return
  const snapshot = pending
  pending = null
  try {
    const d = await db()
    await d.put(STORE, snapshot, KEY)
  } catch (e) {
    console.error('[persist] Speichern fehlgeschlagen', e)
  }
}

/** Vor dem Schließen der App noch schnell wegschreiben. */
export function installFlushHandlers(): void {
  const handler = () => void flush()
  window.addEventListener('pagehide', handler)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') handler()
  })
}

/**
 * Speicher als dauerhaft markieren. Ohne das räumt Safari nach 7 Tagen
 * Inaktivität auf — mitsamt der gesamten Lernbasis.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function storageEstimate(): Promise<{ usedKb: number; quotaMb: number } | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const e = await navigator.storage.estimate()
    return {
      usedKb: Math.round((e.usage ?? 0) / 1024),
      quotaMb: Math.round((e.quota ?? 0) / 1024 / 1024),
    }
  } catch {
    return null
  }
}

// ── Migration ─────────────────────────────────────────────────────────


// ── Export / Import ───────────────────────────────────────────────────





/**
 * Sicherung teilen. In der iOS-Standalone-PWA sind `<a download>`-Links
 * unzuverlässig — die Share-API ist der verlässliche Weg, mit
 * Zwischenablage als Rückfallebene.
 */
export async function shareBackup(state: AppState): Promise<'shared' | 'copied' | 'downloaded'> {
  const json = JSON.stringify(buildBackup(state, new Date()), null, 2)
  const name = backupFilename(new Date())

  const file = new File([json], name, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Café — Sicherung' })
      return 'shared'
    } catch {
      /* Nutzer hat abgebrochen — auf die nächste Ebene fallen */
    }
  }

  try {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return 'downloaded'
  } catch {
    await navigator.clipboard.writeText(json)
    return 'copied'
  }
}
