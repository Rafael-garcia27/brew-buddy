/**
 * Bohnen-Eignung je Methode.
 *
 * Übernommen aus der alten `barista-pwa` (docs/03 §2.1) — dort die beste Idee,
 * die im Briefing nicht vorkam: Manche Bohnen passen schlicht nicht zu manchen
 * Methoden. Das vorher zu sagen erspart aussichtslose Dial-in-Schleifen
 * (kb/15 §6).
 *
 * Bewusst anders als im Altbestand: dort erfundene Prozentzahlen (95, 92, 74),
 * die eine Präzision suggerieren, die es nicht gibt. Hier fünf Stufen aus
 * `data/methods.json` plus Herkunftsprofil.
 */
import type { Bag, Bean, BrewMethod, Process } from '@domain'
import { METHODS } from '@/labels'
import { getMethod, getOrigin, getMethodDefaults, processFamily } from '@/kb'
import { assessFreshness, type Freshness } from './freshness'

export type SuitabilityLevel = 'ideal' | 'gut' | 'machbar' | 'anspruchsvoll' | 'schwierig'

export interface Suitability {
  score: number // 1–5, eine Nachkommastelle
  level: SuitabilityLevel
  reason: string
  isWarning: boolean
}

/**
 * Ab dieser Eignung gilt eine Bohne für eine Methode als geeignet.
 *
 * Die Schwelle für die Lesart „geeignet für" — die, nach der man sucht,
 * wenn man das Regal filtert. Sie ist bewusst dieselbe Zahl, die
 * `rankMethodsFor` als Abschlagsgrenze benutzt: Eine Bohne, für die eine
 * Methode einen Abschlag kostet, soll unter dieser Methode auch nicht als
 * geeignet gelistet werden.
 */
export const GEEIGNET_AB = 3.5

const LEVELS: [number, SuitabilityLevel][] = [
  [4.5, 'ideal'],
  // Absichtlich dieselbe Grenze: „geeignet für" heißt „gut geeignet oder
  // besser". Zwei Zahlen für dieselbe Aussage wären früher oder später
  // zwei verschiedene Zahlen.
  [GEEIGNET_AB, 'gut'],
  [2.5, 'machbar'],
  [1.5, 'anspruchsvoll'],
  [0, 'schwierig'],
]

/**
 * Aufbereitung → Schlüssel in der Eignungsmatrix.
 *
 * Die Zuordnung stand hier zweimal, seit das Profil die Familien selbst
 * anzeigt: einmal als Zeichenkettenvergleich in dieser Datei, einmal in
 * data/processes.json. Beide waren sich nicht einmal einig — die Anzeige
 * führt Wet Hulled als eigene Familie, die Matrix kennt nur vier. Jetzt
 * entscheidet die Wissensbasis, und wo eine Familie in der Matrix nicht
 * bewertet ist, sagt sie selbst, unter welchem Schlüssel nachgesehen wird.
 */
function family(p: Process): string {
  return processFamily(p).matrixFamily
}

function levelOf(score: number): SuitabilityLevel {
  for (const [min, lvl] of LEVELS) if (score >= min) return lvl
  return 'schwierig'
}

export function suitability(bean: Bean, method: BrewMethod): Suitability {
  const m = getMethod(method) as unknown as {
    suitability?: Record<string, Record<string, number>>
  }
  const base = m.suitability?.[bean.roastLevel]?.[family(bean.process)] ?? 3

  // Herkunftsprofil aus origins.json (1–5) als sanfte Korrektur, nicht als
  // zweite Meinung: maximal ±0,6 Stufen.
  const origin = bean.origins[0] ? getOrigin(bean.origins[0].country) : undefined
  const originFit = origin?.methodSuitability?.[method]
  const delta = originFit !== undefined ? (originFit - 3) * 0.3 : 0

  const score = Math.max(1, Math.min(5, Math.round((base + delta) * 10) / 10))
  const level = levelOf(score)

  return {
    score,
    level,
    reason: reasonFor(bean, method, level, origin?.name),
    isWarning: score < 2.5,
  }
}

/**
 * Warum diese Bohne in dieser Methode so eingeordnet ist.
 *
 * Ein Eintrag JE METHODE, nicht eine Kette aus `if`. Die alte Fassung
 * behandelte Espresso und V60 und ließ alles andere auf den
 * AeroPress-Text durchfallen — die French Press bekam dadurch seit ihrer
 * Einführung „die AeroPress verzeiht viel" zu lesen. Aufgefallen ist das
 * erst, als der Methodenbildschirm die Begründungen nebeneinander
 * zeigte. Als Record erzwingt der Compiler bei jeder neuen Methode einen
 * eigenen Text, statt still einen fremden zu übernehmen.
 */
type Ton = 'schlecht' | 'ideal' | 'mittel'

const GRUND: Record<BrewMethod, Record<Ton, string>> = {
  espresso: {
    schlecht:
      'dicht und säurebetont. Im Druckformat wird die Säure schnell dominant — weite Ratio (1:2,5–1:3), hohe Temperatur, feiner Mahlgrad. Als V60 spielt diese Bohne ihre Stärken besser aus.',
    ideal: 'löst sich leicht, trägt Körper und Süße — das klassische Espressoprofil.',
    mittel: 'funktioniert im Espresso solide.',
  },
  v60: {
    schlecht:
      'wenig Säure und viel Röstaroma. Im V60 wirkt das schnell flach und bitter — AeroPress oder Espresso passen besser.',
    ideal: 'genau das Profil, das der V60 zeigen kann — Klarheit, Säurestruktur, Aromatik.',
    mittel: 'im V60 gut machbar.',
  },
  aeropress: {
    schlecht:
      'im Grenzbereich — die AeroPress verzeiht zwar viel, kann aber nicht herausholen, was nicht drin ist.',
    ideal: 'die AeroPress holt hier Süße und Körper heraus.',
    mittel: 'die AeroPress verzeiht viel — funktioniert.',
  },
  // kb/10b §7: Die French Press spielt Körper und Süße aus und dämpft
  // Klarheit und Säure. Bei hellen gewaschenen Ostafrikanern deckt das
  // Metallsieb genau die Stärke zu, für die man sie gekauft hat.
  frenchpress: {
    schlecht:
      'lebt von Klarheit — und genau die deckt das Metallsieb zu. Nicht falsch, aber Verschwendung; im V60 oder in der AeroPress kommt mehr davon an.',
    ideal: 'volle Immersion spielt hier Körper und Süße aus — das kann die French Press besser als jede andere Methode.',
    mittel: 'in der French Press unkompliziert; der Mahlgrad ist hier der schwächste Hebel.',
  },
  batchbrew: {
    // Der wiederkehrende Grund steht in kb/10c §1: Temperatur und Guss
    // gehören der Maschine. Was dort fehlt, kann man nicht nachregeln —
    // also entscheidet die Bohnenwahl mehr als bei jeder anderen Methode.
    schlecht:
      'in der Maschine unter ihren Möglichkeiten: Sie bräuchte Temperatur an der oberen Grenze und mehr Zeit, und beides gibt das Gerät nicht her.',
    ideal:
      'genau das, wofür die Maschine gebaut ist — mehrere Tassen in gleichbleibender Qualität, ohne dass Gusstechnik hineinspielt.',
    mittel:
      'in der Maschine solide; es bleiben Dose, Ratio und Mahlgrad, denn Temperatur und Guss sind geräteseitig.',
  },
}

function reasonFor(
  bean: Bean,
  method: BrewMethod,
  level: SuitabilityLevel,
  originName?: string,
): string {
  const o = originName ? `${originName}, ` : ''
  const roastWord =
    bean.roastLevel === 'light' || bean.roastLevel === 'medium-light'
      ? 'helle Röstung'
      : bean.roastLevel === 'dark' || bean.roastLevel === 'medium-dark'
        ? 'dunkle Röstung'
        : 'mittlere Röstung'

  const ton: Ton =
    level === 'schwierig' || level === 'anspruchsvoll'
      ? 'schlecht'
      : level === 'ideal'
        ? 'ideal'
        : 'mittel'

  return `${o}${roastWord}: ${GRUND[method][ton]}`
}

// ── Methoden für eine Bohne, beste zuerst ─────────────────────────────

export interface MethodRanking {
  method: BrewMethod
  suitability: Suitability
  /** Herkunftsprofil minus Abschlag für Schwierigkeit. */
  rank: number
  /**
   * Über der Schwierigkeitssperre — nur solche Methoden empfiehlt die App.
   * Darunter ist nicht ausgeschlossen, aber es wird nicht empfohlen.
   */
  viable: boolean
}

/**
 * Unterhalb dieser Eignung empfiehlt die App eine Methode nicht mehr.
 *
 * Eine hell geröstete Brasilianerin ist im Espresso schwierig, egal wie
 * sehr Brasilien für Espresso steht — das Herkunftsprofil darf die
 * Schwierigkeit nicht überstimmen.
 */
const METHODEN_SPERRE = 2.5

/**
 * Alle Methoden für diese Bohne, in einer Reihenfolge.
 *
 * Eine Reihenfolge, drei Verwender: die Empfehlung (`bestMethodFor`), die
 * Methodenliste unter Brew und der Fit im Profil. Vorher rechnete jeder
 * seine eigene — der Fit stand sogar in Anzeigereihenfolge, also immer
 * gleich, egal welche Bohne. Sortiert man ihn nach `suitability`, kann
 * seine oberste Zeile eine andere Methode nennen als die Empfehlung
 * zwei Bildschirme weiter. Zwei Bildschirme, die sich widersprechen,
 * sind schlimmer als eine unsortierte Liste.
 *
 * Bewusst NICHT nach `suitability` allein: Die misst, wie leicht etwas
 * schiefgeht, und die AeroPress ist die fehlerverzeihendste Methode. Sie
 * gewann dadurch fast immer — auch bei einer brasilianischen Natural,
 * die jeder Röster als Espressobohne verkauft. Empfohlen wird nach dem
 * Herkunftsprofil (origins.json): „wo spielt diese Bohne ihre Stärken
 * aus?" Ohne Herkunftsangabe (Blend) bleibt die Eignung.
 */
export function rankMethodsFor(bean: Bean): MethodRanking[] {
  const origin = bean.origins[0] ? getOrigin(bean.origins[0].country) : undefined

  const bewertet: MethodRanking[] = METHODS.map((m) => {
    const suit = suitability(bean, m)
    const fit = origin?.methodSuitability?.[m]
    // Ohne Herkunftsprofil trägt die Eignung die Entscheidung allein.
    const basis = fit ?? suit.score
    // Anspruchsvoll heißt nicht ausgeschlossen, aber es kostet.
    return {
      method: m,
      suitability: suit,
      rank: basis - (suit.score < GEEIGNET_AB ? 0.75 : 0),
      viable: suit.score >= METHODEN_SPERRE,
    }
  })

  const idx = (r: MethodRanking) => METHODS.indexOf(r.method)

  // Liegt keine einzige Methode über der Sperre, gewinnt die am wenigsten
  // schwierige — dann ist die Schwierigkeit die ganze Auskunft.
  if (!bewertet.some((r) => r.viable)) {
    return [...bewertet].sort(
      (a, b) => b.suitability.score - a.suitability.score || idx(a) - idx(b),
    )
  }

  return [...bewertet].sort(
    (a, b) =>
      Number(b.viable) - Number(a.viable) || b.rank - a.rank || idx(a) - idx(b),
  )
}

/**
 * Welche Methode diese Bohne am besten zeigt.
 *
 * Der Kopf von `rankMethodsFor` — nicht eine zweite Rechnung mit
 * demselben Ziel.
 */
export function bestMethodFor(bean: Bean): { method: BrewMethod; suitability: Suitability } {
  const kopf = rankMethodsFor(bean)[0]!
  return { method: kopf.method, suitability: kopf.suitability }
}

// ── Die Gegenrichtung: Methode gewählt, welche Bohne? ─────────────────

export interface BeanRanking {
  bean: Bean
  bag?: Bag
  suitability: Suitability
  freshness: Freshness
  /** Rang, mit dem sortiert wird. Höher ist besser. */
  rank: number
  /**
   * Nicht brühbar: keine Tüte, leer, oder zu wenig für eine Dosis.
   * Getrennt vom Rang, weil das kategorisch ist und nicht graduell —
   * eine Bohne, die man nicht in der Hand hat, ist keine Empfehlung.
   */
  unavailable?: 'no-bag' | 'depleted' | 'too-little'
  /** Warum diese Bohne oben oder unten steht. */
  note: string
}

/**
 * Wie stark die Frische den Rang drücken darf.
 *
 * 0,45 heißt: Eine überalterte Bohne behält 55 % ihrer fachlichen
 * Eignung. Damit gewinnt eine mittelmäßige frische Bohne (3 × 1,0 = 3,0)
 * gegen eine perfekte alte (5 × 0,55 = 2,75) — genau das soll passieren,
 * ohne dass Alter die Fachlichkeit vollständig überstimmt.
 */
const FRISCHE_GEWICHT = 0.45

/** Unterhalb dieses Rangs empfiehlt die App nichts mehr, sondern rät ab. */
export const RANK_SCHWELLE = 2.2

/**
 * Bohnen für eine Methode, beste zuerst.
 *
 * Bewusst NICHT bloß `suitability` absteigend, aus demselben Grund, den
 * `bestMethodFor` unten festhält: Eignung misst, wie leicht etwas
 * schiefgeht. Empfohlen wird nach `origin.methodSuitability` — also
 * danach, wo eine Bohne ihre Stärken ausspielt.
 *
 * Zwei Größen kommen hier dazu, die die Gegenrichtung nicht braucht:
 * Frische und Bestand. Beim Vergleich von METHODEN für eine Bohne sind
 * beide für alle Kandidaten gleich und kürzen sich weg. Beim Vergleich
 * von BOHNEN entscheiden sie mit — eine fachlich perfekte Bohne, die
 * sechzig Tage nach Röstung liegt, ist die falsche Empfehlung, und eine,
 * von der acht Gramm übrig sind, ist gar keine.
 */
export function bestBeansFor(
  method: BrewMethod,
  beans: Bean[],
  bags: Bag[],
  today: Date = new Date(),
): BeanRanking[] {
  const dosis = getMethodDefaults(method, 'medium').doseG

  const bewertet = beans.map((bean) => {
    const suit = suitability(bean, method)
    const origin = bean.origins[0] ? getOrigin(bean.origins[0].country) : undefined
    const fit = origin?.methodSuitability?.[method]
    // Ohne Herkunftsprofil — ein Blend etwa — trägt die Eignung allein.
    const basis = fit ?? suit.score
    // Anspruchsvoll heißt nicht ausgeschlossen, aber es kostet. Dieselbe
    // Größe wie in bestMethodFor, damit beide Richtungen gleich strafen.
    const fachlich = basis - (suit.score < GEEIGNET_AB ? 0.75 : 0)

    const bag = bags
      .filter((b) => b.beanId === bean.id && !b.depleted)
      .sort((a, b) => (b.roastDate ?? '').localeCompare(a.roastDate ?? ''))[0]
    const fresh = assessFreshness(
      bag,
      method,
      bean.roastLevel,
      !!bean.isDecaf,
      today,
      bean.process,
    )

    const unavailable = verfuegbarkeit(bean, bags, bag, dosis)
    const frischeFaktor = 1 - FRISCHE_GEWICHT + FRISCHE_GEWICHT * (fresh.score / 100)
    const rank = Math.round(Math.max(0, fachlich) * frischeFaktor * 100) / 100

    return {
      bean,
      bag,
      suitability: suit,
      freshness: fresh,
      rank,
      ...(unavailable ? { unavailable } : {}),
      note: notiz(suit, fresh, unavailable, fit !== undefined),
    }
  })

  // Nicht Verfügbares nach unten, darüber nach Rang. Innerhalb der
  // Nichtverfügbaren weiter nach Rang, damit „nachkaufen" eine Ordnung hat.
  return bewertet.sort((a, b) => {
    if (!!a.unavailable !== !!b.unavailable) return a.unavailable ? 1 : -1
    return b.rank - a.rank
  })
}

function verfuegbarkeit(
  bean: Bean,
  alle: Bag[],
  offen: Bag | undefined,
  dosis: number,
): BeanRanking['unavailable'] {
  if (!offen) return alle.some((b) => b.beanId === bean.id) ? 'depleted' : 'no-bag'
  if (offen.remainingGrams !== undefined && offen.remainingGrams < dosis) return 'too-little'
  return undefined
}

/**
 * Ein Satz, der die Platzierung erklärt.
 *
 * Die App sagt überall, warum — eine sortierte Liste ohne Begründung
 * wäre die einzige Stelle, an der man ihr glauben müsste.
 */
function notiz(
  suit: Suitability,
  fresh: Freshness,
  unavailable: BeanRanking['unavailable'],
  hatHerkunftsprofil: boolean,
): string {
  if (unavailable === 'no-bag') return 'Keine Tüte angelegt — Röstdatum und Menge fehlen.'
  if (unavailable === 'depleted') return 'Alle Tüten leer.'
  if (unavailable === 'too-little') return 'Zu wenig übrig für eine ganze Dosis.'

  if (fresh.state === 'stale') return `${fresh.label} — die Eignung spielt hier keine Rolle mehr.`
  if (fresh.state === 'too-fresh') return `${fresh.label}. Fachlich passend, aber noch nicht stabil.`

  if (suit.score < 2.5) return suit.reason
  if (fresh.state === 'past-peak') return `${SUITABILITY_LABEL[suit.level]}, aber ${fresh.label}.`
  if (!hatHerkunftsprofil) return `${SUITABILITY_LABEL[suit.level]} — Herkunft offen, geschätzt aus Röstgrad und Aufbereitung.`
  return suit.reason
}

export const SUITABILITY_LABEL: Record<SuitabilityLevel, string> = {
  ideal: 'ideal',
  gut: 'gut geeignet',
  machbar: 'machbar',
  anspruchsvoll: 'anspruchsvoll',
  schwierig: 'schwierig',
}
