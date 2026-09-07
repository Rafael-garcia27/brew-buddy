/**
 * Domänenmodell der Kaffee-Wissensbasis.
 *
 * Quelle der Wahrheit: ../kb/00-domaenenmodell.md
 * Zahlenwerte und Grenzen: ../data/*.json
 *
 * Dieses Modul enthält NUR Typen und reine Funktionen.
 * Kein DB-Zugriff, keine Seiteneffekte, vollständig testbar.
 */

// ═══════════════════════════════════════════════════════════════
//  ENUMS
// ═══════════════════════════════════════════════════════════════

export type BrewMethod = 'espresso' | 'v60' | 'aeropress' | 'frenchpress'

export type RoastLevel =
  | 'light' | 'medium-light' | 'medium' | 'medium-dark' | 'dark'

export type Process =
  | 'washed' | 'natural'
  | 'honey-yellow' | 'honey-red' | 'honey-black'
  | 'anaerobic' | 'carbonic-maceration' | 'wet-hulled' | 'experimental'

export type DecafProcess =
  | 'swiss-water' | 'ea-sugarcane' | 'co2' | 'methylene-chloride'

export type PuckState =
  | 'even' | 'wet-soupy' | 'dry-cracked' | 'crater' | 'sideChannel'

export type FlowState =
  | 'choked' | 'slow' | 'normal' | 'fast' | 'gusher' | 'uneven' | 'spritzing'

export type BloomBehavior = 'vigorous' | 'moderate' | 'flat' | 'uneven'

/**
 * Der eigene Eindruck vom Durchlauf, unabhängig von der Uhr.
 *
 * Zwei Signale statt einem: Die Zeit ist reproduzierbar, der Eindruck
 * kennt den Kontext. Decken sie sich, steigt die Konfidenz der Korrektur;
 * widersprechen sie sich, ist genau das der Befund (kb/14 D-93/D-94).
 */
export type SpeedFeel = 'tooFast' | 'onPoint' | 'tooSlow'

export type DrawdownClass = 'fast' | 'normal' | 'slow' | 'stalled'

export type Modifier =
  | 'iced' | 'bypass' | 'inverted' | 'bloomless'
  | 'pressure-profiled' | 'preinfusion' | 'double-filter' | 'paper-rinse-skipped'

export type MilkType =
  | 'whole' | 'semi' | 'skim' | 'lactose-free'
  | 'oat-barista' | 'soy-barista' | 'almond-barista' | 'pea' | 'coconut'

export type FoamClass =
  | 'flat' | 'microfoam-thin' | 'microfoam-standard' | 'airy' | 'stiff'

export type StepType =
  | 'prepare' | 'weigh' | 'rdt' | 'grind' | 'wdt' | 'level' | 'tamp'
  | 'flush' | 'rinse' | 'fill' | 'tare' | 'assemble' | 'cap' | 'invert'
  | 'bloom' | 'pour' | 'wait' | 'swirl' | 'stir' | 'steep'
  | 'press' | 'plunge' | 'drawdown' | 'dilute' | 'brew' | 'stop'
  | 'record' | 'taste'

export type PourStyle = 'center' | 'spiral' | 'pulse' | 'aggressive'

export type Confidence = 'high' | 'medium' | 'low'

/** Fehlerachse — löst Korrekturen aus. Siehe kb/16 §2.1 */
export type Defect =
  | 'sour' | 'salty' | 'thin' | 'shortFinish'
  | 'bitter' | 'astringent' | 'harsh' | 'ashy'
  | 'flat' | 'hollow' | 'papery' | 'rancid' | 'fermented' | 'cooked'

/** Charakterachse — rein beschreibend, löst NIE eine Korrektur aus. kb/16 §2.2 */
export type Character =
  | 'citrus' | 'stoneFruit' | 'berry' | 'tropical' | 'applePear' | 'driedFruit'
  | 'floral' | 'jasmine' | 'rose' | 'tea'
  | 'caramel' | 'honey' | 'brownSugar' | 'panela' | 'vanilla' | 'maple'
  | 'chocolate' | 'darkChocolate' | 'nutty' | 'malt' | 'toast'
  | 'spice' | 'cinnamon' | 'clove' | 'pepper'
  | 'earthy' | 'woody' | 'herbal' | 'tobacco'
  | 'bright' | 'juicy' | 'winey' | 'complex' | 'clean' | 'balanced'
  | 'syrupy' | 'creamy' | 'silky' | 'tealike' | 'full' | 'light'

// ═══════════════════════════════════════════════════════════════
//  MATERIAL
// ═══════════════════════════════════════════════════════════════

export interface OriginRef {
  country: string
  region?: string
  farm?: string
  sharePct?: number      // für Blends
}

export interface Bean {
  id: string
  name: string
  roaster?: string
  origins: OriginRef[]
  varieties?: string[]
  process: Process
  roastLevel: RoastLevel
  agtron?: number                 // 25–95; hat Vorrang vor roastLevel
  altitudeMasl?: [number, number]
  densityGL?: number
  harvestYear?: number
  flavorNotes?: string[]
  preferredMethod?: BrewMethod
  isDecaf?: boolean
  decafProcess?: DecafProcess
  pricePerKg?: number
  createdAt: string
}

export interface Bag {
  id: string
  beanId: string
  roastDate?: string              // kritisch für die Frische-Engine
  openedDate?: string
  purchasedGrams?: number
  remainingGrams?: number
  storage?: 'ambient' | 'frozen'  // frozen hält die Frische-Uhr an
  /** Wann eingefroren wurde. Ab hier steht die Frische-Uhr (kb/05 §5.3). */
  frozenAt?: string
  depleted: boolean
  createdAt: string
}

export interface Water {
  id: string
  label: string
  source: 'tap' | 'filtered' | 'built' | 'bottled' | 'unknown'
  tdsMgL?: number
  ghMgL?: number                  // Extraktionsmotor
  khMgL?: number                  // Säureregler — der wichtigste Wert
  ph?: number
  naMgL?: number
  chlorineMgL?: number
}

// ═══════════════════════════════════════════════════════════════
//  GERÄT
// ═══════════════════════════════════════════════════════════════

export interface Grinder {
  id: string
  name: string
  burrType: 'flat' | 'conical'
  burrDiameterMm?: number
  scaleType: 'stepped' | 'stepless'
  clicksPerRotation?: number
  /** Klicks je aufgedruckter Skalennummer. 10 = „2,4" heißt Nummer 2 plus 4 Klicks. */
  clicksPerNumber?: number
  micronPerStep: number
  zeroPointOffsetMicron: number
  usableRange?: [number, number]
  /** Anzeigeschritt einer stufenlosen Skala. 0,5 = halbe Nummern. */
  step?: number
  /** Katalogeintrag, aus dem diese Mühle stammt */
  catalogId?: string
  /** Im Siebträger verbaut statt eigenständig */
  kind?: 'standalone' | 'integrated'
  /** Auf diese Methoden beschränkt. Fehlt das Feld, gilt sie für alle. */
  methods?: BrewMethod[]
  retentionG?: number
  confidence: 'measured' | 'vendor' | 'estimated'
}

export interface Brewer {
  id: string
  method: BrewMethod
  model?: string
  groupType?: 'e61' | 'lever' | 'saturated' | 'thermoblock' | 'other'
  maxPressureBar?: number
  hasPid?: boolean
  hasPressureProfiling?: boolean
}

export interface Basket {
  id: string
  diameterMm: 51 | 53 | 54 | 58
  doseRangeG: [number, number]
  type: 'stock' | 'precision' | 'ridgeless' | 'ims' | 'vst'
}

export interface Dripper {
  id: string
  model: 'v60-01' | 'v60-02' | 'v60-03' | 'v60-switch' | 'other'
  material: 'plastic' | 'glass' | 'ceramic' | 'metal'
  /** Keramik/Glas: unbedingt vorheizen — sonst bis zu 4 °C Verlust */
  thermalMass: 'low' | 'medium' | 'high'
}

export interface Filter {
  id: string
  brand?: string
  bleached: boolean
  flowClass: 'slow' | 'standard' | 'fast'
}

export interface EquipmentSet {
  id: string
  label: string
  grinderId?: string
  brewerId?: string
  basketId?: string
  dripperId?: string
  filterId?: string
  scaleResolutionG?: 0.1 | 0.01 | 1
}

// ═══════════════════════════════════════════════════════════════
//  VERFAHREN
// ═══════════════════════════════════════════════════════════════

export interface GrindSetting {
  equipmentId: string
  value: number
  unit: 'clicks' | 'dial' | 'micron'
  /** Abgeleitet über F-29 — nur zur Anzeige und für Transfers */
  derivedMicron?: number
}

export interface RecipeStep {
  index: number
  type: StepType
  startAtS?: number
  durationS?: number
  /** IMMER kumulativ — das ist, was die Waage anzeigt */
  targetMassG?: number
  pourStyle?: PourStyle
  note?: string
  warning?: string
}

export interface PressurePoint {
  atSecond: number
  bar: number
}

export interface Recipe {
  id: string
  name: string
  method: BrewMethod
  doseG: number
  ratio: number
  targetYieldG?: number           // abgeleitet: doseG * ratio (F-03)
  waterTempC: number
  grindSetting?: GrindSetting
  totalTimeS?: number
  steps?: RecipeStep[]            // für V60/AeroPress zwingend
  pressureProfile?: PressurePoint[]
  modifiers?: Modifier[]
  icedModifier?: IcedModifier
  source: 'builtin' | 'user' | 'derived-from-log'
  parentRecipeId?: string
}

export interface IcedModifier {
  mode: 'flash-chill' | 'over-ice' | 'cold-brew'
  icePct?: number                 // Anteil des Brühwassers als Eis
  iceG?: number                   // Eis im Glas
  iceTempC: number                // Default −18
  servedOverIce: boolean
  concentrationFactor: number     // Default 1,15 für over-ice
  steepHours?: number             // cold-brew
}

// ═══════════════════════════════════════════════════════════════
//  ERGEBNIS
// ═══════════════════════════════════════════════════════════════

export interface BrewActual {
  doseG: number
  yieldG?: number                 // Espresso
  waterG?: number                 // Filter
  timeS: number
  waterTempC?: number
  grindSetting?: GrindSetting
  pressureBar?: number
  stirCount?: number
  pourCount?: number
  bypassG?: number
  inverted?: boolean
}

export interface Observation {
  flowState?: FlowState
  puckState?: PuckState
  bloomBehavior?: BloomBehavior
  drawdownS?: number
  bedAppearance?: 'even' | 'crater' | 'uneven'
  cremaQuality?: 'good' | 'thin' | 'dark-spotted' | 'excessive' | 'absent'
  pressResistance?: 'none' | 'light' | 'normal' | 'heavy'
  /**
   * Wie schnell der Durchlauf sich angefühlt hat.
   *
   * Wird VOR der Verkostung erfasst und getrennt von ihr ausgewertet:
   * „lief zu schnell" ist eine Aussage über den Fluss, nicht über den
   * Geschmack, und trägt deshalb eine eigene Korrektur (kb/15 §3.1 Phase C).
   */
  perceivedSpeed?: SpeedFeel
  /**
   * French Press: Wurde nach dem Pressen sofort umgefüllt?
   *
   * Der einzige Fehler, der NACH dem Brühen passiert. Wer die Kanne stehen
   * lässt, extrahiert weiter — das erklärt Bitterkeit, die an keiner
   * Einstellung liegt (kb/10b §6).
   */
  decantedImmediately?: boolean
}

export interface Measurement {
  tdsPct: number
  beverageMassG: number
  brewTempC?: number
  /** IMMER berechnet (F-06), nie eingegeben */
  extractionYield?: number
}

export interface Tasting {
  rating: 1 | 2 | 3 | 4 | 5
  defects: Defect[]
  characters: Character[]
  intensity?: {
    acidity: number
    sweetness: number
    bitterness: number
    body: number
    aftertaste: number
  }
  temperatureAtTasting?: 'hot' | 'warm' | 'cool' | 'room'
  notes?: string
  wouldRepeat: boolean
}

export interface Brew {
  id: string
  bagId: string
  beanId: string
  /** Explizit gespeichert — aus BrewActual ableiten ist mehrdeutig. */
  method: BrewMethod
  recipeId?: string
  equipmentSetId?: string
  waterId?: string
  actual: BrewActual
  observations?: Observation
  measurement?: Measurement
  tasting?: Tasting
  isBest: boolean
  createdAt: string
}

// ═══════════════════════════════════════════════════════════════
//  GETRÄNK
// ═══════════════════════════════════════════════════════════════

export type ComponentKind =
  | 'milk' | 'water' | 'ice' | 'syrup' | 'tonic' | 'cream' | 'chocolate'

export interface DrinkComponent {
  kind: ComponentKind
  massG: number
  tempC?: number
  foamClass?: FoamClass
  note?: string
}

export interface MilkSpec {
  milkType: MilkType
  milkStartG: number              // einzufüllen
  milkFinalG: number              // berechnet (F-19)
  startTempC: number
  targetTempC: number
  foamClass: FoamClass
  overrunPct: number
}

export interface Drink {
  id: string
  drinkTypeId: string
  baseBrewId: string
  components: DrinkComponent[]
  milkSpec?: MilkSpec
  glassMl?: number
  /** Kaffeeintensität in % (F-40) */
  intensityPct?: number
  createdAt: string
}

// ═══════════════════════════════════════════════════════════════
//  DIAGNOSE
// ═══════════════════════════════════════════════════════════════

export interface Suggestion {
  /** 1. WAS — konkrete Änderung mit Zahl */
  what: string
  /** 2. WARUM — Ursache in einem Satz */
  why: string
  /** 3. ERWARTUNG — überprüfbare Vorhersage. VERPFLICHTEND. */
  expectation: string
  /** 4. KONFIDENZ */
  confidence: Confidence
  /** 5. ALTERNATIVE — hinter „Falls das nicht hilft", nie gleichrangig */
  alternative?: string

  variable: string
  direction: 'increase' | 'decrease' | 'adjust' | 'technique' | 'none'
  delta?: number
  ruleId: string
  formulaRef?: string
}

export interface Diagnosis {
  stage: 0 | 1 | 2
  blocked: boolean
  blockReason?: string
  summary: string
  /** Genau EINE — außer Stufe 1 mit TDS-Messung */
  suggestions: Suggestion[]
  escalation?: string[]
  saveAsReference?: boolean
}

export interface StartingPoint {
  recipe: Recipe
  source: 'personal' | 'transfer' | 'default'
  rationale: string
  sourceBrewId?: string
  sourceBrewDate?: string
  freshnessCorrection?: { deltaSteps: number; reason: string }
  grinderHint?: { min: number; max: number; center: number; note?: string }
  warning?: string
}

// ═══════════════════════════════════════════════════════════════
//  RECHENKERN — reine Funktionen
// ═══════════════════════════════════════════════════════════════

export const CONSTANTS = {
  C_WATER: 4.18,        // J/(g·K)
  C_ICE: 2.09,
  C_MILK: 3.90,
  C_BEVERAGE: 4.10,
  L_FUSION: 334,        // J/g
  H_VAPORIZATION: 2257, // J/g
  MAX_SOLUBLE_PCT: 30,
} as const

export const LRR: Record<string, number> = {
  'v60-paper': 2.0,
  'v60-metal': 1.8,
  'aeropress-standard': 1.5,
  'aeropress-inverted': 1.6,
  'frenchpress': 2.2,
}

/** F-01 / F-02 */
export const ratio = (dose: number, waterOrYield: number): number =>
  waterOrYield / dose

/** F-03 */
export const targetYield = (doseG: number, r: number): number => doseG * r

/** F-05 — Getränkemasse beim Filter */
export const beverageMass = (waterG: number, doseG: number, lrr = 2.0): number =>
  waterG - lrr * doseG

/** F-06 — Extraktionsausbeute in % */
export const extractionYield = (
  tdsPct: number, beverageG: number, doseG: number,
): number => (tdsPct * beverageG) / doseG

/** F-08 — erwartetes TDS ohne Refraktometer */
export const expectedTds = (
  ey: number, r: number, lrr = 0,
): number => ey / (r - lrr)

/** F-11 — Mischungs-TDS */
export const blendTds = (
  parts: { massG: number; tdsPct: number }[],
): number => {
  const total = parts.reduce((s, p) => s + p.massG, 0)
  if (total === 0) return 0
  return parts.reduce((s, p) => s + p.massG * p.tdsPct, 0) / total
}

/** F-13 / F-15 — Wasser- bzw. Bypassmenge für Ziel-TDS */
export const waterForTargetTds = (
  concG: number, tdsConc: number, tdsTarget: number,
): number => concG * (tdsConc / tdsTarget - 1)

/** F-16 — Mischtemperatur ohne Phasenwechsel */
export const mixTemperature = (
  parts: { massG: number; c: number; tempC: number }[],
): number => {
  const denom = parts.reduce((s, p) => s + p.massG * p.c, 0)
  if (denom === 0) return 0
  return parts.reduce((s, p) => s + p.massG * p.c * p.tempC, 0) / denom
}

/** F-17 — Eismenge, die exakt vollständig schmilzt */
export const iceForTargetTemp = (
  hotG: number, tHot: number, tFinal: number, tIce = -18,
): number =>
  (hotG * CONSTANTS.C_BEVERAGE * (tHot - tFinal)) /
  (CONSTANTS.C_ICE * Math.abs(tIce) + CONSTANTS.L_FUSION + CONSTANTS.C_WATER * tFinal)

/** F-19 — relative Massenzunahme der Milch durch Dampfkondensat */
export const steamCondensateRatio = (
  tStart: number, tFinal: number,
): number =>
  (CONSTANTS.C_MILK * (tFinal - tStart)) /
  (CONSTANTS.H_VAPORIZATION + CONSTANTS.C_WATER * (100 - tFinal))

/** F-41 — einzufüllende Milchmenge für eine gewünschte Endmasse */
export const milkToPour = (
  targetMilkFinalG: number, overrunPct: number, tStart = 4, tFinal = 60,
): number =>
  targetMilkFinalG /
  ((1 + overrunPct / 100) * (1 + steamCondensateRatio(tStart, tFinal)))

/** F-22 — Mahlgrad-Skalierungsfaktor. >1 = gröber, <1 = feiner. */
export const grindScaleFactor = (
  actualTimeS: number, targetTimeS: number,
): number => Math.sqrt(actualTimeS / targetTimeS)

/**
 * F-22 gesperrt bei Channeling — die Zeit ist dann physikalisch bedeutungslos.
 * Diese Prüfung MUSS jedem Mahlgradvorschlag vorausgehen.
 */
export const canUseTimeForGrind = (flow?: FlowState): boolean =>
  flow !== 'uneven' && flow !== 'spritzing'

/** F-23 — Skalierungsfaktor in Mühlenschritte umrechnen */
export const grindSteps = (
  currentMicron: number, factor: number, micronPerStep: number,
): number => Math.round((currentMicron * (factor - 1)) / micronPerStep)

/** F-22r — überprüfbare Erwartung für die Diagnoseausgabe */
export const expectedTimeAfterGrindChange = (
  actualTimeS: number, currentMicron: number, newMicron: number,
): number => actualTimeS * Math.pow(currentMicron / newMicron, 2)

/** F-24 */
export const flowRate = (yieldG: number, timeS: number): number =>
  yieldG / timeS

/** F-25a */
export const basketAreaCm2 = (diameterMm: number): number =>
  Math.PI * Math.pow(diameterMm / 20, 2)

/** F-25b — macht Rezepte zwischen Korbgrößen übertragbar */
export const doseDensity = (doseG: number, diameterMm: number): number =>
  doseG / basketAreaCm2(diameterMm)

export const doseForBasket = (
  density: number, diameterMm: number,
): number => density * basketAreaCm2(diameterMm)

/** F-29 */
export const settingToMicron = (
  setting: number, g: Pick<Grinder, 'micronPerStep' | 'zeroPointOffsetMicron'>,
): number => g.zeroPointOffsetMicron + setting * g.micronPerStep

/** F-31 — Frische-Score 0–100 */
export const freshnessScore = (
  days: number, tPeak: number, sigma: number, daysSinceOpened = 0,
): number => {
  const base = 100 * Math.exp(-Math.pow(days - tPeak, 2) / (2 * sigma * sigma))
  return base * Math.max(0.6, 1 - 0.004 * daysSinceOpened)
}

/** F-32 — Mahlgraddrift durch Alterung. Negativ = feiner. */
export const ageGrindDrift = (daysNow: number, daysRef: number): number =>
  -0.08 * (daysNow - daysRef)

/** F-33 — Koffein als Spanne, nie als Punktwert */
export const caffeineEstimateMg = (
  doseG: number, method: BrewMethod | 'coldbrew', species: 'arabica' | 'robusta' = 'arabica',
): [number, number] => {
  const w = species === 'arabica' ? 0.012 : 0.022
  const eff: Record<string, [number, number]> = {
    espresso: [0.35, 0.55],
    v60: [0.70, 0.90],
    aeropress: [0.80, 0.95],
    coldbrew: [0.70, 0.85],
  }
  const [lo, hi] = eff[method] ?? [0.5, 0.9]
  const total = w * doseG * 1000
  return [Math.round(total * lo), Math.round(total * hi)]
}

/** F-34 */
export const costPerCup = (pricePerKg: number, doseG: number): number =>
  (pricePerKg / 1000) * doseG

/** F-40 — Kaffeeintensität eines zusammengesetzten Getränks */
export const drinkIntensity = (
  tdsBrewPct: number, brewG: number, totalG: number,
): number => (tdsBrewPct * brewG) / totalG

/** Drawdown-Klassifikation (V60) */
export const classifyDrawdown = (
  drawdownS: number, totalTimeS: number,
): DrawdownClass => {
  const pct = (drawdownS / totalTimeS) * 100
  if (pct < 15) return 'fast'
  if (pct < 30) return 'normal'
  if (pct < 45) return 'slow'
  return 'stalled'
}

/** Plausibilitätsprüfung einer Messung (D-05) */
export const isMeasurementPlausible = (ey: number, tdsPct: number): boolean =>
  ey >= 12 && ey <= 26 && tdsPct > 0 && tdsPct <= 15
