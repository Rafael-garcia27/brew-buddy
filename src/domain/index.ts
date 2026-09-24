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

export type Theme = 'light' | 'dark' | 'organic'

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
  /**
   * Hell, Dunkel — oder „Organic".
   *
   * Die dritte Variante ist kein Farbwechsel, sondern ein eigenes
   * Formvokabular: Pillen statt Rechtecke, weichere Karten, eigene
   * Schriften. Sie hängt trotzdem an derselben Einstellung, weil sie
   * dasselbe beantwortet — wie die App aussieht.
   */
  theme: Theme
  /** Personalisierbarer Zielkorridor (Briefing B1) */
  targetEy: [number, number]
  targetEySource: 'standard' | 'learned'
  lastBackupAt?: string
  /**
   * Tonhinweise während des Durchgangs.
   *
   * Ersatz für die Haptik, die eine PWA auf iOS nicht hat: ein kurzer Ton
   * am Anfang und am Ende des Zielbands. Wer beide Hände am Siebträger
   * hat, muss dann nicht hinsehen.
   */
  tonhinweise?: boolean
  /**
   * Die Getränkekarte nach einem Espresso.
   *
   * Eine Zusatzfunktion, keine Grundfunktion: Wer seinen Espresso pur
   * trinkt, soll nach jedem Durchgang nicht gefragt werden, ob ein
   * Cortado daraus werden soll. `undefined` heißt an — die Funktion
   * existiert, wer sie nicht will, schaltet sie in den Optionen ab.
   */
  getraenke?: boolean
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
  tonhinweise: true,
  getraenke: true,
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
  /**
   * Wie einig sich die guten Durchgänge über das Verhältnis sind.
   * Grundlage der Gewichtung — siehe `engine/ueberzeugung.ts`.
   */
  streuungRatio: number
  /** Tage seit dem jüngsten guten Durchgang. */
  alterTage: number
  /**
   * Wie stark diese Vorliebe gegen den Standard zählt — 0 bis 1.
   *
   * Vorher gab es hier eine Kante: unter zwölf Durchgängen gar kein
   * Bias, ab zwölf der volle. Der zwölfte Shot verschob den Startpunkt um
   * einen Sprung, den kein einzelner Shot rechtfertigt.
   */
  gewicht: number
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
  /**
   * Gegebene Empfehlungen mit ihrem Ausgang.
   *
   * Das Solution Design nennt das Feld ERWARTUNG „den
   * Vertrauensmechanismus der App" — gebaut war es als Anzeigetext. Eine
   * Vorhersage, die niemand nachprüft, ist eine Behauptung. Hier steht
   * sie als Gegenstand mit Lebenslauf, und damit wird sie messbar.
   */
  empfehlungen: Empfehlung[]
}

// ── Die Empfehlung als Gegenstand ─────────────────────────────────────

/** Woran gedreht wird. */
export type Stellgroesse = 'mahlgrad' | 'ratio' | 'temperatur' | 'dosis' | 'technik'

/** Was sich messen lässt, wenn man wieder brüht. */
export type Messgroesse = 'zeit' | 'ausbringung'

export interface Eingriff {
  groesse: Stellgroesse
  von?: number
  nach?: number
  einheit: string
}

export interface Vorhersage {
  groesse: Messgroesse
  /** Der erwartete Wert. */
  erwartet: number
  /** Wie weit daneben noch als getroffen gilt. */
  toleranz: number
  /** 0…1, aus der Konfidenz der Regel. */
  konfidenz: number
}

export interface Einloesung {
  /** Der Durchgang, an dem gemessen wurde. */
  brewId: string
  istWert: number
  abweichung: number
  getroffen: boolean
  at: string
}

export type Empfehlungszustand =
  | 'offen'
  | 'uebernommen'
  | 'verworfen'
  | 'eingeloest'
  | 'verfehlt'

export interface Empfehlung {
  id: string
  at: string
  /** Der Durchgang, der sie ausgelöst hat. */
  brewId: string
  beanId: string
  method: BrewMethod
  /** Welche der Regeln aus `data/diagnostics.json` gefeuert hat. */
  regelId: string
  /** Die Überschrift, wie sie dem Nutzer gezeigt wurde. */
  titel: string
  eingriff?: Eingriff
  vorhersage?: Vorhersage
  /**
   * Die Begründungskette, gespeichert statt neu gerechnet.
   *
   * Sie muss auch dann noch stimmen, wenn die Regel inzwischen geändert
   * wurde — sonst behauptet die App rückwirkend etwas, das sie damals
   * nicht gesagt hat.
   */
  begruendung: string[]
  zustand: Empfehlungszustand
  einloesung?: Einloesung
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
    empfehlungen: [],
  }
}

// ── Hilfstypen für die Engine ─────────────────────────────────────────

/** Alles, was die Engine für eine Entscheidung braucht. Rein lesend. */
export interface EngineContext {
  bean: Bean
  bag?: Bag
  method: BrewMethod
  grinder?: Grinder
  /**
   * Alle bekannten Mühlen — um die Referenz einer ANDEREN umzurechnen.
   *
   * Ohne sie ist eine Mahlgradzahl aus der Historie nicht deutbar: Sie
   * trägt zwar ihre `equipmentId`, aber ohne die zugehörige Mühle fehlt
   * die Skala, auf die sie sich bezieht.
   */
  grinders?: Grinder[]
  /**
   * Alle bekannten Tüten — um das Alter eines Referenz-Shots zu kennen.
   *
   * `bag` ist die Tüte von heute. Der Referenz-Shot kann aus einer
   * anderen stammen, und ohne deren Röstdatum lässt sich nicht sagen,
   * wie viele Tage zwischen damals und heute liegen (F-32).
   */
  bags?: Bag[]
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
