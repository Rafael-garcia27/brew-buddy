/**
 * Typisierter Zugang zur Wissensbasis.
 *
 * Leitentscheidung E2 aus dem Solution Design: Fachwissen liegt in `data/*.json`,
 * NICHT im Code. Dieses Modul ist der einzige Ort, an dem die JSON-Dateien
 * gelesen werden — der Rest der App spricht nur mit den Funktionen hier unten.
 *
 * Fachliche Änderungen sind damit Datenänderungen, keine Codeänderungen.
 */
import methodsRaw from '@data/methods.json'
import variablesRaw from '@data/variables.json'
import diagnosticsRaw from '@data/diagnostics.json'
import originsRaw from '@data/origins.json'
import grindersRaw from '@data/grinders.json'
import glossaryRaw from '@data/glossary.json'
import formulasRaw from '@data/formulas.json'
import countriesRaw from '@data/countries.json'
import processesRaw from '@data/processes.json'
import type { BrewMethod, RoastLevel, Process } from '@domain'

// ── Methoden ──────────────────────────────────────────────────────────

export interface MethodDefaults {
  doseG: number
  ratio: number
  timeS?: number
  waterTempC: number
  pressureBar?: number
  preinfusionS?: number
  bloomRatio?: number
  bloomTimeS?: number
  pourCount?: number
  steepS?: number
  stirCount?: number
  inverted?: boolean
}

export interface MethodProfile {
  id: BrewMethod
  label: string
  physics: string
  /** Ein Satz: was die Methode tut und was das für die Tasse heißt. */
  short?: string
  grindSensitivity: number
  timeSensitivity: number
  agitationRelevant: boolean
  channelingPossible: boolean
  lrr: number | null
  targetGrindMicron: [number, number]
  timeIsResult: boolean
  defaults: Record<RoastLevel, MethodDefaults>
  targetTimeByDose?: { doseG: number; timeS: [number, number]; grindOffset: number }[]
  basketDoseMap?: Record<string, { typical: [number, number]; max: number; areaCm2: number }>
  shotStyles?: Record<
    string,
    { ratio: [number, number]; grindOffset: number; note?: string; pressureBar?: number }
  >
  correctionOrder?: Record<string, string[]>
  recipeVariants?: RecipeVariant[]
  maxChamberWaterG?: number
  usableChamberWaterG?: number
  tempRangeC?: { min: number; max: number }
}

export interface RecipeVariant {
  id: string
  label: string
  doseG: number
  waterG?: number
  waterTempC: number
  grindOffset?: number
  inverted?: boolean
  bypassG?: number
  warning?: string
  steps?: {
    index: number
    type: string
    startAtS?: number
    durationS?: number
    targetMassG?: number
    pourStyle?: string
    note?: string
  }[]
}

const methods = methodsRaw.methods as unknown as MethodProfile[]

export const METHODS = methods
export const METHOD_IDS = methods.map((m) => m.id)

export function getMethod(id: BrewMethod): MethodProfile {
  const m = methods.find((x) => x.id === id)
  if (!m) throw new Error(`Unbekannte Methode: ${id}`)
  return m
}

export function getMethodDefaults(id: BrewMethod, roast: RoastLevel): MethodDefaults {
  return getMethod(id).defaults[roast] ?? getMethod(id).defaults['medium']
}

/**
 * Zielfluss je Röstgrad (g/s), aus den ASC-Kurszeiten zurückgerechnet.
 * Dunkler = poröser = schnellerer Fluss, bevor es in die Bitterkeit kippt.
 */
export function targetFlowRate(roast: RoastLevel, ratio = 2): number {
  const f = (getMethod('espresso') as unknown as {
    targetFlowRateGs?: Record<string, number>
  }).targetFlowRateGs
  const base = f?.[roast] ?? 1.44
  const exp = f?.['_ratioExponent'] ?? 0.6
  // Wer die Ratio weitet, mahlt gröber — der Fluss steigt mit.
  // Bei 1:2 wirkt der Term nicht, ASC bleibt damit exakt erhalten.
  return base * Math.pow(Math.max(0.5, ratio) / 2, exp)
}

/**
 * Zielzeit.
 *
 * Espresso: aus Zielausbringung und Zielfluss. Damit reagiert die Zielzeit auf
 * Dosis UND Ratio — der alte Ansatz mit fester Zeit je Röstgrad lieferte bei
 * 1:3 dieselben 28 s wie bei 1:2 und trieb den Nutzer in die Unterextraktion.
 * Bei 18 g → 36 g reproduziert das exakt die ASC-Kurszeiten.
 *
 * V60: skaliert mit der Dosis (Anti-Regel D-66). Eine feste Zielzeit für alle
 * Mengen ist der häufigste Fehler in V60-Apps.
 */
/**
 * Ob die Kontaktzeit gewählt oder Ergebnis ist.
 *
 * Bei Immersion — AeroPress, French Press — bestimmt der Mensch, wie lange
 * gezogen wird. Eine lange Gesamtzeit ist dort kein Befund. Bei Perkolation
 * fällt die Zeit aus Mahlgrad und Bett heraus.
 */
/**
 * In welcher Reihenfolge diese Methode korrigiert werden will.
 *
 * Steht in methods.json, nicht im Code: Beim Espresso ist der Grind der
 * stärkste Hebel, bei der French Press der schwächste. Diese Umkehrung
 * ist Fachwissen und gehört in die Wissensbasis.
 */
export function correctionOrder(
  method: BrewMethod,
  richtung: 'underextracted' | 'overextracted',
): string[] | null {
  const co = (getMethod(method) as unknown as {
    correctionOrder?: string[] | Record<string, string[]>
  }).correctionOrder
  if (!co) return null
  if (Array.isArray(co)) return co
  return co[richtung] ?? null
}

export function isImmersion(method: BrewMethod): boolean {
  return (getMethod(method) as unknown as { physics?: string }).physics === 'immersion'
}

export interface AeropressPhases {
  /** Ende Benetzen/Bloom/Rühren (Sekunden ab Brühbeginn) */
  bloomEnd: number
  /** Ende der Ziehzeit */
  steepEnd: number
  /** Ende Kappe aufsetzen und Wenden */
  transferEnd: number
  /** Gesamtzeit inkl. Pressen */
  total: number
}

/**
 * Phasengrenzen eines AeroPress-Durchgangs (kb/10 §4.1, Standard invertiert).
 *
 * Der Bloom ist hier kein eigener Vorlauf, sondern der Anfang der Ziehzeit:
 * Benetzen, CO₂-Entwicklung und Rühren in den ersten ~35 Sekunden. Danach
 * ruhiges Ziehen, dann Kappe aufsetzen und Wenden, zuletzt Pressen.
 */
export function aeropressPhases(steepS: number, method: BrewMethod = 'aeropress'): AeropressPhases {
  const pm = (getMethod(method) as unknown as {
    phaseModel?: { bloomMaxS: number; bloomFractionOfSteep: number; transferS: number; pressS: number }
  }).phaseModel ?? { bloomMaxS: 35, bloomFractionOfSteep: 0.4, transferS: 8, pressS: 25 }
  const bloomEnd = Math.min(pm.bloomMaxS, Math.round(steepS * pm.bloomFractionOfSteep))
  return {
    bloomEnd,
    steepEnd: steepS,
    transferEnd: steepS + pm.transferS,
    total: steepS + pm.transferS + pm.pressS,
  }
}

/** Was diese Methode am Brühkopf bzw. im Kessel überhaupt liefern kann. */
export function tempRange(method: BrewMethod): { min: number; max: number } {
  return getMethod(method).tempRangeC ?? { min: 70, max: 100 }
}

/**
 * Nutzbares Wasservolumen. Nur die AeroPress ist volumenbegrenzt —
 * ihre Kammer fasst nominal 250 ml, praktisch passen mit Kaffeemehl und
 * Kolbeneinschub rund 230 g hinein.
 */
export function maxWaterG(method: BrewMethod): number | null {
  const m = getMethod(method)
  return m.usableChamberWaterG ?? m.maxChamberWaterG ?? null
}

export function targetTimeRange(
  method: BrewMethod,
  doseG: number,
  roast: RoastLevel = 'medium',
  yieldG?: number,
  steepSOverride?: number,
): [number, number] | null {
  const m = getMethod(method)

  if (m.targetTimeByDose?.length) {
    const table = m.targetTimeByDose
    let best = table[0]!
    for (const row of table) {
      if (Math.abs(row.doseG - doseG) < Math.abs(best.doseG - doseG)) best = row
    }
    // Röstgradabhängig: Helle Röstungen sind dicht und vertragen längeren
    // Kontakt, dunkle sind porös und kippen früher in die Bitterkeit.
    const off = ((m as unknown as { roastTimeOffsetS?: Record<string, number> })
      .roastTimeOffsetS?.[roast]) ?? 0
    return [best.timeS[0] + off, best.timeS[1] + off]
  }

  if (method === 'espresso') {
    const out = yieldG ?? doseG * (m.defaults[roast]?.ratio ?? 2)
    const ratio = out / doseG
    const mid = out / targetFlowRate(roast, ratio)
    // ASC nennt ±3 s Toleranz auf die Kurszeiten.
    return [Math.round(mid - 3), Math.round(mid + 3)]
  }

  if (isImmersion(method)) {
    // Gesamtzeit aus dem Phasenmodell. Ohne diesen Zweig lieferte die
    // Methode gar keine Zielzeit — die Ziehzeit kann bohnenspezifisch
    // angepasst sein (z. B. anaerob kürzer), deshalb der Override.
    const steep = steepSOverride ?? m.defaults[roast]?.steepS ?? m.defaults['medium']?.steepS ?? 90
    const total = aeropressPhases(steep, method).total
    const tol = tolerances(method).timeS
    return [total - tol, total + tol]
  }

  const t = m.defaults[roast]?.timeS ?? m.defaults['medium']?.timeS
  if (t) return [Math.round(t - 2), Math.round(t + 2)]
  return null
}

export interface Tolerances {
  doseG: number
  timeS: number
  yieldG?: number
  waterG?: number
}

/**
 * Toleranzen des Kursrezepts (ASC). Innerhalb dieser Spannen ist eine
 * Abweichung KEIN Fehler, sondern die Wiederholgenauigkeit des Handwerks —
 * die Engine darf dort nicht korrigieren.
 */
export function tolerances(method: BrewMethod): Tolerances {
  const t = (getMethod(method) as unknown as { tolerances?: Tolerances }).tolerances
  return t ?? { doseG: 1, timeS: 3 }
}

/** Basisrezept, von dem aus eingemessen wird */
export function baseRecipe(method: BrewMethod) {
  return (getMethod(method) as unknown as {
    baseRecipe?: { doseG: number; yieldG: number; ratio: number; timeS: number }
  }).baseRecipe
}

/** Mahlgrad-Offset, wenn die Dosis stark vom Referenzpunkt abweicht */
export function doseGrindOffset(method: BrewMethod, doseG: number): number {
  const m = getMethod(method)
  if (!m.targetTimeByDose?.length) return 0
  let best = m.targetTimeByDose[0]!
  for (const row of m.targetTimeByDose) {
    if (Math.abs(row.doseG - doseG) < Math.abs(best.doseG - doseG)) best = row
  }
  return best.grindOffset
}

// ── Variablen ─────────────────────────────────────────────────────────

export interface VariableDef {
  id: string
  label: string
  unit: string
  type: string
  scope?: string[]
  ranges?: Record<string, [number, number]>
  defaults?: Record<string, number | string | boolean>
  step?: Record<string, number>
  sensitivity?: number
  priority?: number | null
  isControl?: boolean
  isResult?: boolean
  tooltip?: string
  target?: number | [number, number]
  acceptable?: [number, number]
  warnings?: { when: string; message: string; severity?: string }[]
  derivedFrom?: string
  formulaRef?: string
  overrunMap?: Record<string, number>
  options?: string[]
}

const variables = variablesRaw.variables as unknown as VariableDef[]
export const VARIABLES = variables

export function getVariable(id: string): VariableDef | undefined {
  return variables.find((v) => v.id === id)
}

export function variableRange(id: string, scope: string): [number, number] | null {
  const v = getVariable(id)
  return (v?.ranges?.[scope] as [number, number] | undefined) ?? null
}

export const ROUNDING = variablesRaw.displayRounding as Record<string, number | string>

// ── Diagnose-Regelwerk ────────────────────────────────────────────────

export interface RuleAction {
  variable: string
  direction: 'increase' | 'decrease' | 'adjust' | 'technique' | 'none'
  delta?: number
  formulaRef?: string
  fallbackDelta?: number
  targetValue?: number | string
  secondary?: { variable: string; direction: string; delta?: number }
  alternative?: { variable: string; direction: string; formulaRef?: string }
  alternativeForMethod?: Record<string, { variable: string; direction: string; formulaRef?: string }>
}

export interface DiagnosticRuleDef {
  id: string
  stage: 0 | 1 | 2
  priority: number
  scope?: string[]
  when: string
  cause?: string
  action: RuleAction
  explanation?: string
  techniqueSteps?: string[]
  techniqueByMethod?: Record<string, string[]>
  checklist?: string[]
  alternative?: string
  reference?: string
  blocks?: string[]
  confidence: 'high' | 'medium' | 'low'
  isAntiRule?: boolean
  overridesCascade?: boolean
  suggestSaveAsReference?: boolean
  precondition?: string
}

export const RULES = diagnosticsRaw.rules as unknown as DiagnosticRuleDef[]
export const ENGINE_META = diagnosticsRaw.engine
export const LOOP_DETECTION = diagnosticsRaw.loopDetection
export const PROHIBITIONS = diagnosticsRaw.prohibitions as string[]

export interface RoastRule {
  id: string
  when: { roast: RoastLevel[]; defect: string }
  reading: string
  order: string[]
  hint: string
  tempCeiling?: number
  tempFloor?: number
  ratioCeiling?: number
  suspectRoast?: boolean
  confidence: 'high' | 'medium' | 'low'
}

const ROAST_RULES = ((diagnosticsRaw as unknown as {
  roastConditioned?: { rules: RoastRule[] }
}).roastConditioned?.rules ?? []) as RoastRule[]

/**
 * Röstgradabhängige Lesart eines Fehlers.
 *
 * Derselbe Fehler bedeutet je nach Röstgrad etwas anderes: Säure bei heller
 * Röstung ist der Normalfall und meist echte Unterextraktion; Säure bei
 * dunkler Röstung ist ungewöhnlich und deutet eher auf Technik hin.
 */
export function roastRuleFor(roast: RoastLevel, defects: string[]): RoastRule | undefined {
  for (const r of ROAST_RULES) {
    if (r.when.roast.includes(roast) && defects.includes(r.when.defect)) return r
  }
  return undefined
}

export function getRule(id: string): DiagnosticRuleDef | undefined {
  return RULES.find((r) => r.id === id)
}

// ── Laufkontrolle (Stufe 0,5) ─────────────────────────────────────────

/**
 * Schwellen der Laufkontrolle.
 *
 * Sie stehen bewusst hier und nicht im Code: Ob „deutlich daneben" bei
 * 20 % oder bei 25 % beginnt, ist eine fachliche Setzung und keine
 * Programmentscheidung.
 */
export interface RunBands {
  abortedBelowFactor: number
  farOffRelative: number
  espressoChokedAboveS: number
  espressoGusherBelowS: number
  spreadWarnS: number
}

export interface RunCheckRuleDef {
  id: string
  priority: number
  scope?: string[]
  when: string
  cause?: string
  action: RuleAction
  explanation?: string
  techniqueSteps?: string[]
  confidence: 'high' | 'medium' | 'low'
}

const runCheckRaw = (diagnosticsRaw as unknown as {
  runCheck?: { bands: RunBands; rules: RunCheckRuleDef[] }
}).runCheck

export const RUN_BANDS: RunBands = runCheckRaw?.bands ?? {
  abortedBelowFactor: 0.35,
  farOffRelative: 0.2,
  espressoChokedAboveS: 45,
  espressoGusherBelowS: 15,
  spreadWarnS: 4,
}

export const RUN_RULES: RunCheckRuleDef[] = runCheckRaw?.rules ?? []

export function getRunRule(id: string): RunCheckRuleDef | undefined {
  return RUN_RULES.find((r) => r.id === id)
}

// ── Herkunft, Aufbereitung, Varietät ──────────────────────────────────

export interface OriginProfile {
  id: string
  name: string
  flag?: string
  continent?: string
  regions?: string[]
  altitudeMasl?: [number, number]
  varieties?: string[]
  commonProcesses?: string[]
  flavorProfile?: string[]
  acidityLevel?: number
  bodyLevel?: number
  sweetnessLevel?: number
  methodSuitability?: Record<string, number>
  modifiers?: { grindSteps?: number; waterTempC?: number; ratio?: number }
  notes?: string
  warnings?: string[]
  highAcidityWarning?: boolean
  grading?: string
}

export interface ProcessProfile {
  id: Process
  label: string
  profile?: string[]
  bodyModifier?: number
  acidityModifier?: number
  modifiers?: { grindSteps?: number; ratio?: number; waterTempC?: number }
  notes?: string
  forgiving?: boolean
  solubilityHigh?: boolean
}

export const ORIGINS = originsRaw.origins as unknown as OriginProfile[]
export const PROCESSES = originsRaw.processes as unknown as ProcessProfile[]
export const VARIETIES = originsRaw.varieties as unknown as {
  id: string
  name: string
  profile?: string[]
  modifiers?: Record<string, number>
  preferMethod?: string
  acidityExpectation?: string
  warnUser?: string
  isLandrace?: boolean
}[]

/** Mühlen, die für diese Methode überhaupt in Frage kommen. */
export function grindersForMethod(method: BrewMethod): GrinderCatalogEntry[] {
  return GRINDER_CATALOG.filter((g) => !g.methods || g.methods.includes(method))
}

export function getOrigin(id: string): OriginProfile | undefined {
  return ORIGINS.find((o) => o.id === id || o.name === id)
}

export function getProcess(id: Process): ProcessProfile | undefined {
  return PROCESSES.find((p) => p.id === id)
}

export const ORIGIN_NAMES = ORIGINS.map((o) => o.name)

// ── Mühlen ────────────────────────────────────────────────────────────

export interface GrinderCatalogEntry {
  id: string
  name: string
  burrType: 'flat' | 'conical'
  scaleType: 'stepped' | 'stepless'
  clicksPerRotation?: number
  clicksPerNumber?: number
  micronPerStep: number
  zeroPointOffsetMicron: number
  usableRange?: [number, number]
  dialRange?: [number, number]
  step?: number
  kind?: 'standalone' | 'integrated'
  shortName?: string
  /** Auf diese Methoden beschränkt. Fehlt das Feld, gilt sie für alle. */
  methods?: BrewMethod[]
  /** Herstellerempfehlungen in Klicks */
  presets?: Record<string, [number, number]>
  /** Dieselben Empfehlungen als Skalennummer, wie auf der Mühle notiert */
  vendorPresetsByNumber?: Record<string, [number, number]>
  /** Welche presets NICHT vom Hersteller stammen, sondern abgeleitet sind */
  presetsDerived?: string[]
  /** Mahlgrad je Rezeptvariante — AeroPress hat die größte Rezeptspanne */
  grindByVariant?: Record<string, [number, number]>
  /** Aufdruck auf dem Verstellring, wie er auf der Mühle steht */
  ringLabels?: { text: string; range: [number, number] }[]
  wordmark?: string
  isDefault?: boolean
  confidence: 'measured' | 'vendor' | 'estimated'
  espressoCapable?: boolean
  isFallback?: boolean
  note?: string
}

export const GRINDER_CATALOG = grindersRaw.grinders as unknown as GrinderCatalogEntry[]
export const GRIND_TARGETS = grindersRaw.targetMicronByMethod as unknown as Record<string, [number, number]>
export const CALIBRATION = grindersRaw.selfCalibration
export const GRIND_TECHNIQUES = grindersRaw.techniques as {
  id: string
  name: string
  when: string
  instruction: string
  effect?: string[]
  downside?: string
  warning?: string
}[]

export function getGrinderCatalogEntry(id: string): GrinderCatalogEntry | undefined {
  return GRINDER_CATALOG.find((g) => g.id === id)
}

/**
 * Mahlgradbereich für eine konkrete Rezeptvariante.
 * Fällt auf den Methodenwert zurück, wenn die Variante nichts Eigenes hat.
 */
export function grindRangeForVariant(
  grinderName: string,
  method: BrewMethod,
  variantId?: string,
): [number, number] | undefined {
  const e = GRINDER_CATALOG.find((g) => g.name === grinderName)
  if (!e) return undefined
  if (variantId && e.grindByVariant?.[variantId]) return e.grindByVariant[variantId]
  return e.presets?.[method]
}

/** Voreingestellte Mühle beim ersten Start */
export function defaultGrinderEntry(): GrinderCatalogEntry {
  return GRINDER_CATALOG.find((g) => g.isDefault) ?? GRINDER_CATALOG[0]!
}

/** Referenz-Mahlgrad in µm für eine Methode (Mitte des Zielbereichs) */
export function referenceMicron(method: BrewMethod): number {
  const range = GRIND_TARGETS[method]
  if (!range) {
    // Lieber laut scheitern als still den falschen Wert einer anderen
    // Methode verwenden — das war ein echter Fehler in Iteration 2.
    throw new Error(`Kein Mahlgrad-Zielbereich für Methode "${method}" hinterlegt`)
  }
  return (range[0] + range[1]) / 2
}

// ── Länder ────────────────────────────────────────────────────────────

/**
 * Sammelwert für Mischungen. Steht in der Auswahl an erster Stelle und
 * ist KEIN Land — die Karte färbt dafür den ganzen Gürtel, solange keine
 * Bestandteile genannt sind.
 */
export const BLEND = 'Blend'

export interface Country {
  /** ISO-3166-1 alpha-3 */
  iso: string
  /** Deutscher Name — die Schreibweise, in der die App speichert */
  de: string
  /** Englischer Name, falls abweichend. Nur zum Erkennen von Eingaben. */
  en?: string
  /** Kaffeeerzeuger mit Schwerpunkt in den Tropen */
  belt?: boolean
}

/**
 * Alle Länder, die die App als Herkunft akzeptiert.
 *
 * Erzeugt aus Natural Earth (`npm run worldmap`), dieselbe Quelle wie die
 * Karte. Damit gilt: Was sich eintragen lässt, lässt sich auch einzeichnen
 * — es kann keine Herkunft geben, die die Karte nicht kennt.
 */
export const COUNTRIES = (countriesRaw as unknown as { countries: Country[] }).countries

/**
 * Eingabe zu einem Land — die Prüfung für manuell nachgetragene Herkünfte.
 *
 * Nimmt deutschen wie englischen Namen, ignoriert Groß- und Kleinschreibung
 * und Leerraum. Ohne Treffer `undefined`: Dann ist die Eingabe kein Land
 * und wird nicht gespeichert.
 */
export function findCountry(eingabe: string): Country | undefined {
  const g = eingabe.trim().toLowerCase()
  if (!g) return undefined
  return COUNTRIES.find((c) => c.de.toLowerCase() === g || c.en?.toLowerCase() === g)
}

/**
 * Geschmacksschlüssel → deutsches Wort.
 *
 * Die Schlüssel stehen als englische Kennungen in origins.json, weil sie
 * dort Datenfelder sind. Angezeigt wird deutsch — und die Übersetzung
 * liegt neben den Daten, nicht im Code, damit ein neues Herkunftsprofil
 * sein Vokabular gleich mitbringt (Leitentscheidung E2).
 */
const FLAVOR_LABELS = (originsRaw as unknown as { flavorLabels?: Record<string, string> })
  .flavorLabels ?? {}

export function flavorLabel(key: string): string {
  return FLAVOR_LABELS[key] ?? key
}

/** Reihenfolge der Exporteure, oben in jeder Herkunftsauswahl. */
export const EXPORT_RANKING = (
  originsRaw as unknown as { exportRanking?: { iso: string[] } }
).exportRanking?.iso ?? []

/**
 * Die Herkunftsauswahl, in der Reihenfolge, in der man sie braucht.
 *
 *   1. die 15 größten Exporteure nach Ausfuhrmenge
 *   2. die übrigen Länder, für die die App ein Herkunftsprofil führt
 *      (Kenia, Panama, Jemen … — klein im Export, groß im Regal)
 *   3. was der Nutzer selbst nachgetragen hat
 *
 * Innerhalb von 2 und 3 alphabetisch: Dort gibt es keine sinnvolle
 * Rangfolge, und Suchen ist dann leichter als Raten.
 */
export function originOptions(extra: string[] = []): string[] {
  const liste: string[] = []
  const gesehen = new Set<string>()
  const dazu = (name: string | undefined) => {
    if (!name || gesehen.has(name)) return
    gesehen.add(name)
    liste.push(name)
  }

  for (const iso of EXPORT_RANKING) dazu(COUNTRIES.find((c) => c.iso === iso)?.de)
  for (const n of ORIGINS.map((o) => o.name).sort((a, b) => a.localeCompare(b, 'de'))) dazu(n)
  for (const n of [...extra].sort((a, b) => a.localeCompare(b, 'de'))) dazu(findCountry(n)?.de)

  return liste
}

// ── Glossar ───────────────────────────────────────────────────────────

export interface GlossaryTerm {
  id: string
  term: string
  /** Die deutsche Entsprechung, wenn die Oberfläche den Fachbegriff zeigt */
  aka?: string
  level: 'basis' | 'advanced' | 'expert'
  unit?: string
  short: string
  long: string
  seeAlso?: string[]
  formulaRef?: string
  showWhen?: string[]
  warning?: string
  productNote?: string
  isOwnTerm?: boolean
}

export const GLOSSARY = glossaryRaw.terms as unknown as GlossaryTerm[]

export function getTerm(id: string): GlossaryTerm | undefined {
  return GLOSSARY.find((t) => t.id === id)
}

export function termsForLevel(level: 'basis' | 'advanced' | 'expert'): GlossaryTerm[] {
  const order = { basis: 0, advanced: 1, expert: 2 }
  return GLOSSARY.filter((t) => order[t.level] <= order[level])
}

// ── Röstgrad als Messgröße (kb/05 §2.1) ───────────────────────────────

/**
 * Die Agtron-Bänder.
 *
 * Der Röstgrad ist der einzige Bohnenwert, der eine echte Messskala hat:
 * Infrarot-Reflexion des Mahlguts, 25–95, höher = heller. Deshalb darf
 * die App ihn als Skala zeichnen und nicht nur als Wort.
 *
 * kb/05 §2.1 sagt außerdem, warum das nötig ist: Etikettenbezeichnungen
 * sind nicht standardisiert und streuen zwischen Röstern um bis zu zwei
 * Stufen. Ein gemessener Agtron und ein aufgedrucktes „Medium" sind also
 * nicht dasselbe — und werden hier auch nicht gleich dargestellt.
 */
export interface AgtronBand {
  min: number
  max: number
  level: RoastLevel
  label: string
  /** Was an dieser Stelle im Röster passiert — macht die Zahl lesbar. */
  context: string
}

const AGTRON = formulasRaw.agtronBands as unknown as {
  range: [number, number]
  bands: AgtronBand[]
}

export const AGTRON_RANGE: [number, number] = AGTRON.range
/** Von hell nach dunkel — die Anzeigereihenfolge einer Skala. */
export const AGTRON_BANDS: AgtronBand[] = AGTRON.bands

/** In welchem Band liegt dieser Messwert? Außerhalb: das Randband. */
export function agtronBand(agtron: number): AgtronBand {
  const treffer = AGTRON_BANDS.find((b) => agtron >= b.min && agtron < b.max)
  if (treffer) return treffer
  // Die Obergrenze gehört zum obersten Band, alles darunter zum untersten.
  return agtron >= AGTRON_RANGE[1] ? AGTRON_BANDS[0]! : AGTRON_BANDS[AGTRON_BANDS.length - 1]!
}

/**
 * Welche Agtron-Spanne deckt eine Etikettenbezeichnung ab?
 *
 * Bewusst eine Spanne, kein Punkt: „Light" umfasst zwei Bänder (75–95).
 * Wer daraus eine einzelne Zahl macht, behauptet eine Messung, die nicht
 * stattgefunden hat.
 */
export function agtronSpan(level: RoastLevel): [number, number] {
  const treffer = AGTRON_BANDS.filter((b) => b.level === level)
  if (!treffer.length) return AGTRON_RANGE
  return [Math.min(...treffer.map((b) => b.min)), Math.max(...treffer.map((b) => b.max))]
}

// ── Aufbereitung (kb/04 §4) ───────────────────────────────────────────

export interface ProcessFamily {
  id: string
  label: string
  /** Kennung für das Symbol, das die App zeichnet — keine Grafik in den Daten. */
  symbol: string
  /** Verbleibende Mucilage in Prozent, oder null wo die Achse nicht greift. */
  mucilagePct: [number, number] | null
  short: string
  profile: string
  brewNote: string
}

export const PROCESS_FAMILIES = processesRaw.families as unknown as ProcessFamily[]

/**
 * Aufbereitung → Familie.
 *
 * Fünf Familien statt neun Einzelwerte, weil die Unterschiede innerhalb
 * einer Familie fürs Brühen kleiner sind als die zwischen ihnen — und
 * weil kb/04 §4.4 ausdrücklich verlangt, die fermentierten Verfahren
 * NICHT unter „natural" zu führen.
 */
export function processFamily(process: Process): ProcessFamily {
  const id = (processesRaw.map as Record<string, string>)[process]
  return PROCESS_FAMILIES.find((f) => f.id === id) ?? PROCESS_FAMILIES[0]!
}

/**
 * Wie viel Fruchtfleisch beim Trocknen an der Bohne blieb (kb/04 §4.3).
 *
 * Das ist die Achse hinter Washed → Honey → Natural und der Grund, warum
 * daraus eine Skala werden darf. `null` heißt: dieses Verfahren liegt
 * nicht auf dieser Achse, sondern auf der Fermentationsachse.
 */
export function mucilagePct(process: Process): number | null {
  const werte = processesRaw.mucilage as Record<string, number>
  return werte[process] ?? null
}

// ── Formeln (Zielkorridore und Grenzen) ───────────────────────────────

export const TARGET_RANGES = formulasRaw.targetRanges
export const HARD_LIMITS = formulasRaw.hardLimits
export const LRR_DEFAULTS = formulasRaw.defaults.lrr as Record<string, number>
export const FRESHNESS_PARAMS = (
  formulasRaw.formulas.find((f) => f.id === 'F-31') as unknown as {
    params: Record<BrewMethod, Record<RoastLevel, { tPeak: number; sigma: number }>>
  }
).params

/** LRR = Retentionswasser je Gramm Kaffee. Ohne diesen Term ist jede EY falsch. */
export function lrrFor(method: BrewMethod, inverted = false): number {
  if (method === 'v60') return LRR_DEFAULTS['v60_paper'] ?? 2.0
  if (method === 'aeropress')
    return inverted
      ? (LRR_DEFAULTS['aeropress_inverted'] ?? 1.6)
      : (LRR_DEFAULTS['aeropress_standard'] ?? 1.5)
  if (method === 'frenchpress') {
    // Grob gemahlener Kaffee in voller Immersion hält rund das Doppelte
    // seines Eigengewichts zurück (kb/10b §5).
    return (getMethod('frenchpress') as unknown as { lrr?: number }).lrr ?? 2.0
  }
  return 0
}

/**
 * Was am Ende wirklich in der Tasse steht.
 *
 * Bei den Aufgussmethoden führt die App das aufgegossene Wasser — der
 * Nutzer denkt aber in Tassengröße. Der Satz behält je nach Methode das
 * Anderthalb- bis Doppelte seines Eigengewichts (F-08).
 */
export function beverageYield(method: BrewMethod, doseG: number, waterG: number, inverted = false): number {
  const lrr = lrrFor(method, inverted)
  if (!lrr) return waterG
  return Math.max(0, Math.round(waterG - doseG * lrr))
}
