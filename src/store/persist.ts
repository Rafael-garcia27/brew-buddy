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
import type { Ereignis } from './events'
import { migrate, buildBackup, backupFilename, parseBackup } from './migrate'
export { migrate, buildBackup, backupFilename, parseBackup }
export type { BackupFile } from './migrate'

// ACHTUNG: Der Datenbankname bleibt 'dialed', obwohl die App inzwischen
// Café heißt. Eine Umbenennung würde eine NEUE, leere Datenbank anlegen und
// alle bisherigen Bohnen, Tüten und Protokolle verwaisen lassen. Der Name ist
// ein interner Schlüssel, kein Anzeigetext — er darf nie geändert werden.
const DB_NAME = 'dialed'
/**
 * 1 → 2: zweiter Object Store `events` für den Ereignisstrom.
 *
 * Der Aufstieg legt ihn nur an; er wandelt nichts um. Ein Bestand aus
 * Fassung 1 hat einen leeren Strom und einen vollen Blob — genau der
 * Zustand, den `startzustand()` als Übernahme behandelt.
 */
const DB_VERSION = 2
const STORE = 'state'
const EVENTS = 'events'
const KEY = 'app'

let dbPromise: Promise<IDBPDatabase> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE)
        // `autoIncrement` statt eigener Schlüssel: Die Reihenfolge im
        // Strom IST die fachliche Reihenfolge, und IndexedDB liefert sie
        // bei `getAll()` in Schlüsselfolge zurück.
        if (!d.objectStoreNames.contains(EVENTS))
          d.createObjectStore(EVENTS, { autoIncrement: true })
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

/**
 * Der Blob, wie er in der Datenbank liegt — ohne `migrate()`.
 *
 * Nur für den Fehlerbildschirm: Wenn `migrate()` die Ursache des Absturzes
 * ist, darf der Rettungsweg nicht darüber führen. Wirft absichtlich weiter,
 * statt `undefined` zurückzugeben — „nichts gespeichert" und „nicht lesbar"
 * auseinanderzuhalten ist die Lehre aus F-01.
 */
export async function loadRaw(): Promise<unknown> {
  const d = await db()
  return await d.get(STORE, KEY)
}

// ── Ereignisstrom ─────────────────────────────────────────────────────

/**
 * Ereignisse anhängen.
 *
 * Gesammelt und gebündelt geschrieben wie der Blob — aber mit einer
 * Warteschlange statt einer einzigen Momentaufnahme: Ein Ereignis darf
 * nicht von einem späteren überschrieben werden, es ist der einzige
 * Nachweis, dass etwas passiert ist.
 */
let wartende: Ereignis[] = []
let stromTimer: ReturnType<typeof setTimeout> | null = null

export function appendEvents(...neue: Ereignis[]): void {
  wartende.push(...neue)
  if (stromTimer) clearTimeout(stromTimer)
  stromTimer = setTimeout(flushEvents, 300)
}

export async function flushEvents(): Promise<void> {
  if (!wartende.length) return
  const stapel = wartende
  wartende = []
  try {
    const d = await db()
    const tx = d.transaction(EVENTS, 'readwrite')
    for (const e of stapel) void tx.store.add(e)
    await tx.done
  } catch (e) {
    console.error('[persist] Ereignisse konnten nicht angehängt werden', e)
    // Vorn einreihen, damit die Reihenfolge stimmt, wenn es beim
    // nächsten Versuch klappt.
    wartende = [...stapel, ...wartende]
    meldeFehler?.(e)
  }
}

export type StromErgebnis =
  | { kind: 'ok'; strom: Ereignis[] }
  | { kind: 'failed'; error: unknown }

export async function loadEvents(): Promise<StromErgebnis> {
  try {
    const d = await db()
    return { kind: 'ok', strom: (await d.getAll(EVENTS)) as Ereignis[] }
  } catch (e) {
    console.error('[persist] Ereignisstrom nicht lesbar', e)
    return { kind: 'failed', error: e }
  }
}

/** Nur für den Übergang: den Strom einmalig aus einem Blob neu setzen. */
export async function resetEvents(strom: Ereignis[]): Promise<void> {
  const d = await db()
  const tx = d.transaction(EVENTS, 'readwrite')
  await tx.store.clear()
  for (const e of strom) void tx.store.add(e)
  await tx.done
}

let writeTimer: ReturnType<typeof setTimeout> | null = null
let pending: AppState | null = null

/**
 * Wer erfahren will, dass das Schreiben fehlschlug.
 *
 * Vorher landete so ein Fehler in `console.error` und sonst nirgends: Die
 * App tat weiter so, als sei gespeichert — bei vollem Speicher, im
 * privaten Modus oder mit beschädigter Datenbank. Wer es merkt, merkt es
 * erst, wenn die Daten fehlen.
 *
 * Bewusst ein Rückruf und kein Import des Stores: `persist.ts` darf nichts
 * über den Store wissen, sonst zeigen beide Module aufeinander.
 */
let meldeFehler: ((e: unknown) => void) | null = null

export function onPersistError(fn: (e: unknown) => void): void {
  meldeFehler = fn
}

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
    // Zurücklegen: Beim nächsten Versuch soll derselbe Stand noch einmal
    // geschrieben werden, statt verloren zu sein.
    if (!pending) pending = snapshot
    meldeFehler?.(e)
  }
}

/** Vor dem Schließen der App noch schnell wegschreiben. */
export function installFlushHandlers(): void {
  const handler = () => {
    void flush()
    void flushEvents()
  }
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
export async function shareBackup(state: AppState): Promise<Auslieferung> {
  const now = new Date()
  return liefere(JSON.stringify(buildBackup(state, now), null, 2), backupFilename(now))
}

export type Auslieferung = 'shared' | 'copied' | 'downloaded'

/**
 * JSON beim Nutzer abliefern — drei Ebenen, absteigend nach Verlässlichkeit.
 *
 * Herausgezogen, damit der Fehlerbildschirm denselben Weg nimmt wie der
 * normale Sicherungsknopf. Auf genau diesen Weg kommt es dort am meisten
 * an, und zwei Umsetzungen davon wären eine zu viel.
 */
export async function liefere(json: string, name: string): Promise<Auslieferung> {
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
