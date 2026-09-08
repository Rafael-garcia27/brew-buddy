/**
 * Domänen-Layer der App.
 *
 * Basis ist `types/domain.ts` — der fachliche Vertrag der Wissensbasis.
 * Hier kommen nur die Typen dazu, die die App zusätzlich braucht:
 * App-Zustand, Einstellungen und die beiden Lernmodelle.
 */
export * from '@domain'

import type {
  Bean,
  Bag,
  Brew,
  Grinder,
  Water,
  BrewMethod,
  BrewActual,
  EquipmentSet,
} from '@domain'

// ── Einstellungen ─────────────────────────────────────────────────────

/** Der eine Schalter der App. Basis = alles Nötige, Pro = alles Mögliche. */
export type AppMode = 'basic' | 'pro'

/** Interne Sichtbarkeitsstufe der Glossarbegriffe (data/glossary.json) */
export type ExpertLevel = 'basis' | 'advanced' | 'expert'

export function levelForMode(mode: AppMode): ExpertLevel {
  return mode === 'pro' ? 'expert' : 'basis'
}

/** Was der Pro-Modus zusätzlich freischaltet — eine Liste, ein Ort. */
export const PRO_FEATURES = [
  { id: 'measurements', label: 'Refraktometer', hint: 'TDS und Extraktionsausbeute erfassen und auswerten' },
  { id: 'water', label: 'Wasserhärte', hint: 'GH und KH — erklärt Fehler, die kein Mahlgrad behebt' },
  { id: 'glossary', label: 'Glossar', hint: 'Alle Fachbegriffe zum Nachschlagen' },
] as const

export interface Settings {
  activeSetupId?: string
  activeGrinderId?: string
  /**
   * Eigene Mühle für Espresso.
   *
   * Wer einen Siebträger mit verbauter Mühle hat, mahlt Espresso damit und
   * Filter mit der Handmühle. Ohne diesen Eintrag gilt activeGrinderId.
   */
  espressoGrinderId?: string
  activeWaterId?: string
  activeBasketMm: 51 | 53 | 54 | 58
  mode: AppMode
  /** TDS/EY-Felder anzeigen. Nur im Pro-Modus verfügbar. */
  showMeasurements: boolean
  theme: 'dark' | 'light'
  /** Personalisierbarer Zielkorridor (Briefing B1) */
  targetEy: [number, number]
  targetEySource: 'standard' | 'learned'
  lastBackupAt?: string
  lastBeanId?: string
  lastMethod?: BrewMethod
  /**
   * Selbst nachgetragene Herkünfte.
   *
   * Die Auswahl führt die fünfzehn größten Exporteure und die Länder, für
   * die die App ein Herkunftsprofil hat. Wer eine Bohne aus Laos oder
   * Bolivien einträgt, soll sie beim nächsten Mal in der Liste finden
   * statt sie wieder zu tippen. Geprüft wird gegen die Länderliste aus
   * Natural Earth — es landet nur hier, was ein Land ist.
   */
  extraOrigins?: string[]
  /**
   * Die Methoden, die man tatsächlich im Haus hat.
   *
   * Der Katalog kennt mehr Geräte als eine Küche. Wer keine Mokkakanne
   * besitzt, will sie nicht bei jeder Auswahl vor sich haben — und wer
   * eine bekommt, soll sehen, dass es sie gibt.
   *
   * `undefined` oder leer heißt ausdrücklich ALLE: Beim ersten Start hat
   * noch niemand Favoriten gesetzt, und ein leerer Katalog wäre dann eine
   * Sackgasse, die aussieht wie ein Fehler. Der Standard ist also nicht
   * „keine", sondern „noch nicht eingeschränkt".
   */
  favoriteMethods?: BrewMethod[]
  onboardingDone: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  activeBasketMm: 58,
  mode: 'basic',
  showMeasurements: false,
  theme: 'light',
  targetEy: [18, 22],
  targetEySource: 'standard',
  onboardingDone: false,
}

// ── Lernmodelle (Solution Design §6.3) ────────────────────────────────

/** „Wie ich brühe" — systematische Abweichung und Streuung */
export interface ProcessModel {
  /** Ist-Zeit minus vorhergesagte Zeit, gleitender Median (s) */
  timeBiasS: number
  /** Streuung der Shotzeiten bei gleichem Rezept (s) */
  consistencyS: number
  sampleSize: number
}

/** „Was mir schmeckt" — persönliche Zielabweichung vom Standard */
export interface PreferenceModel {
  ratioBias: number
  tempBiasC: number
  grindBiasSteps: number
  /** 0–1, wächst mit der Datenmenge */
  confidence: number
  sampleSize: number
  /** Nutzertext, erst ab LEARN_THRESHOLDS.biasStatement */
  statement?: string
}

export interface PerBeanModel {
  bestBrewId: string
  medianParams: Partial<BrewActual>
  medianGrindSteps?: number
  /** Tage nach Röstung, an denen die Referenz entstand — für die Frische-Drift */
  refDaysOffRoast?: number
  sampleSize: number
  avgRating: number
}

export interface LearnedModels {
  process: Partial<Record<BrewMethod, ProcessModel>>
  preference: Partial<Record<BrewMethod, PreferenceModel>>
  /** Schlüssel: `${beanId}:${method}` */
  perBean: Record<string, PerBeanModel>
  computedAt?: string
}

export const EMPTY_LEARNED: LearnedModels = {
  process: {},
  preference: {},
  perBean: {},
}

// ── Gesamtzustand ─────────────────────────────────────────────────────

/**
 * Was beim Löschen einer Bohne wegfällt.
 *
 * Nicht nur der Eintrag: Mit der Bohne gehen ihre Tüten und ihre
 * Protokolle. Wer das versehentlich auslöst — etwa mit einer
 * Wischgeste —, verliert die Datenbasis, aus der die App gelernt hat.
 * Deshalb reicht das Löschen dieses Bündel heraus, damit es
 * zurückgelegt werden kann.
 */
export interface BeanTrash {
  bean: Bean
  bags: Bag[]
  brews: Brew[]
}

export interface AppState {
  schemaVersion: number
  beans: Bean[]
  bags: Bag[]
  brews: Brew[]
  grinders: Grinder[]
  setups: EquipmentSet[]
  waters: Water[]
  settings: Settings
  learned: LearnedModels
}

export function emptyState(schemaVersion: number): AppState {
  return {
    schemaVersion,
    beans: [],
    bags: [],
    brews: [],
    grinders: [],
    setups: [],
    waters: [],
    settings: { ...DEFAULT_SETTINGS },
    learned: { ...EMPTY_LEARNED },
  }
}

// ── Hilfstypen für die Engine ─────────────────────────────────────────

/** Alles, was die Engine für eine Entscheidung braucht. Rein lesend. */
export interface EngineContext {
  bean: Bean
  bag?: Bag
  method: BrewMethod
  grinder?: Grinder
  water?: Water
  settings: Settings
  learned: LearnedModels
  /** Historie NUR dieser Bohne+Methode, neueste zuerst */
  beanHistory: Brew[]
  /** Historie dieser Methode über alle Bohnen, neueste zuerst */
  methodHistory: Brew[]
  /** Alle bekannten Bohnen — für den Transfer von ähnlichen Bohnen */
  allBeans: Bean[]
  today: Date
}

export function beanKey(beanId: string, method: BrewMethod): string {
  return `${beanId}:${method}`
}

/** Tage seit Röstung. `null`, wenn kein Röstdatum erfasst ist. */
export function daysOffRoast(bag: Bag | undefined, today: Date): number | null {
  if (!bag?.roastDate) return null
  // Bei eingefrorener Ware hält die Frische-Uhr an (kb/05 §5.3): gezählt
  // werden die Tage bis zum Einfrieren, nicht bis heute.
  //
  // Der Rückfall auf createdAt ist wichtig — vorher hing die Regel allein
  // an openedDate, das die App nirgends setzt. Die Uhr lief dadurch bei
  // jeder gefrorenen Tüte weiter, und eine im Mai eingefrorene Bohne galt
  // im August als überaltert.
  const stop = bag.frozenAt ?? bag.openedDate ?? bag.createdAt
  const end = bag.storage === 'frozen' && stop ? new Date(stop) : today
  const start = new Date(bag.roastDate)
  const ms = end.getTime() - start.getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

export function daysSince(iso: string | undefined, today: Date): number | null {
  if (!iso) return null
  return Math.max(0, Math.floor((today.getTime() - new Date(iso).getTime()) / 86_400_000))
}
