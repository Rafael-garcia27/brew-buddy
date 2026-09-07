/**
 * Erzeugt `data/worldmap.json` aus Natural Earth.
 *
 * Warum generiert und nicht von Hand gezeichnet: Ländergrenzen aus dem
 * Gedächtnis zu zeichnen ergibt eine Karte, die auf den ersten Blick
 * stimmt und beim zweiten falsch ist. Quelle ist Natural Earth 110m
 * (gemeinfrei, https://www.naturalearthdata.com) — dieselben Daten, die
 * unter fast jeder gedruckten Übersichtskarte liegen.
 *
 * Aufruf:  npm run worldmap
 *
 * Die Ausgabe ist ein reines Anzeige-Artefakt: Pfade in Grad, damit die
 * Oberfläche sie ohne Projektionsrechnung zeichnen kann.
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const QUELLE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'

/**
 * Der Ausschnitt.
 *
 * Plate carrée: x = Längengrad, y = Breitengrad, beides linear. Mercator
 * wäre falsch — er bläht die Pole auf, und genau die interessieren hier
 * nicht. Oben und unten bei 58° gekappt: Grönland, Nordkanada, Sibirien
 * und die Antarktis fallen weg, der Kaffeegürtel rückt in die Mitte.
 */
const LAT_OBEN = 58
const LAT_UNTEN = -58
const BREITE = 360
const HOEHE = LAT_OBEN - LAT_UNTEN

/** Wendekreise — sie sind die Grenzen der Tropen und damit des Gürtels. */
const KREBS = 23.436
const STEINBOCK = -23.436

/**
 * Kaffeeproduzenten (ICO-Erzeugerländer plus die üblichen Nicht-Mitglieder).
 *
 * Für einen Blend wird „der ganze Gürtel" eingefärbt. Rein nach
 * Breitengrad wären das auch Sahara und Namib; rein nach Produktion auch
 * China und die USA, die zu 95 % nördlich der Tropen liegen. Deshalb der
 * Schnitt aus beidem: Erzeugerland UND Schwerpunkt innerhalb ±26°.
 */
const ERZEUGER = new Set([
  // Amerika
  'BRA', 'COL', 'PER', 'ECU', 'BOL', 'VEN', 'MEX', 'GTM', 'HND', 'SLV',
  'NIC', 'CRI', 'PAN', 'CUB', 'DOM', 'HTI', 'JAM', 'TTO', 'GUY', 'SUR',
  // Afrika
  'ETH', 'KEN', 'TZA', 'UGA', 'RWA', 'BDI', 'COD', 'COG', 'CMR', 'CIV',
  'GHA', 'GIN', 'SLE', 'LBR', 'TGO', 'BEN', 'NGA', 'CAF', 'GAB', 'GNQ',
  'AGO', 'ZMB', 'ZWE', 'MWI', 'MOZ', 'MDG', 'SSD',
  // Asien und Ozeanien
  'YEM', 'IND', 'IDN', 'VNM', 'LAO', 'THA', 'PHL', 'PNG', 'TLS', 'MYS',
  'MMR', 'LKA', 'NPL', 'KHM', 'CHN', 'USA',
])

/** Ab wann ein Schwerpunkt noch „in den Tropen" liegt. */
const GUERTEL_LAT = 26

/**
 * Kleinstinseln fliegen raus — sie kosten Pfaddaten und sind bei rund
 * 0,9 px je Grad ohnehin nicht zu sehen. Für Erzeugerländer ist die
 * Schwelle feiner: Indonesien und die Philippinen SIND ihre Inseln.
 */
const MIN_GRAD = 0.7
const MIN_GRAD_ERZEUGER = 0.15

/** Eine Nachkommastelle = 0,1° ≈ 0,09 px in der Anzeige. Mehr ist Ballast. */
const STELLEN = 1

const rd = (v) => Number(v.toFixed(STELLEN))

/** Grad → Bildkoordinaten. y wird am Ausschnitt gekappt, nicht skaliert. */
function projiziere([lon, lat]) {
  const y = LAT_OBEN - Math.max(LAT_UNTEN, Math.min(LAT_OBEN, lat))
  return [rd(lon + 180), rd(y)]
}

function ringBox(ring) {
  let latMin = 90, latMax = -90, lonMin = 180, lonMax = -180
  for (const [lon, lat] of ring) {
    if (lat < latMin) latMin = lat
    if (lat > latMax) latMax = lat
    if (lon < lonMin) lonMin = lon
    if (lon > lonMax) lonMax = lon
  }
  return { latMin, latMax, lonMin, lonMax }
}

/** Ein Ring als SVG-Pfad, aufeinanderfolgende Dubletten entfernt. */
function ringPfad(ring) {
  const punkte = []
  for (const p of ring) {
    const [x, y] = projiziere(p)
    const letzter = punkte[punkte.length - 1]
    if (!letzter || letzter[0] !== x || letzter[1] !== y) punkte.push([x, y])
  }
  if (punkte.length < 3) return null
  const [start, ...rest] = punkte
  return `M${start[0]} ${start[1]}` + rest.map(([x, y]) => `L${x} ${y}`).join('') + 'Z'
}

function ringe(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat()
  return []
}

const hier = dirname(fileURLToPath(import.meta.url))

const antwort = await fetch(QUELLE)
if (!antwort.ok) throw new Error(`Natural Earth nicht erreichbar: HTTP ${antwort.status}`)
const geo = await antwort.json()

const laender = []
let uebersprungen = 0

for (const f of geo.features) {
  const p = f.properties
  const iso = p.ISO_A3_EH && p.ISO_A3_EH !== '-99' ? p.ISO_A3_EH : p.ADM0_A3
  const name = p.NAME_DE || p.NAME
  const istErzeuger = ERZEUGER.has(iso)
  const schwelle = istErzeuger ? MIN_GRAD_ERZEUGER : MIN_GRAD

  let latSum = 0
  let latAnzahl = 0
  const pfade = []
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity

  for (const ring of ringe(f.geometry)) {
    const box = ringBox(ring)
    // Vollständig außerhalb des Ausschnitts: gar nicht zeichnen. Sonst
    // klebte eine platte Linie am oberen oder unteren Rand.
    if (box.latMin > LAT_OBEN || box.latMax < LAT_UNTEN) continue
    if (box.latMax - box.latMin < schwelle && box.lonMax - box.lonMin < schwelle) continue
    const d = ringPfad(ring)
    if (!d) continue
    pfade.push(d)
    latSum += (box.latMin + box.latMax) / 2
    latAnzahl++
    const [x0, yA] = projiziere([box.lonMin, box.latMax])
    const [x1, yB] = projiziere([box.lonMax, box.latMin])
    if (x0 < bx0) bx0 = x0
    if (x1 > bx1) bx1 = x1
    if (yA < by0) by0 = yA
    if (yB > by1) by1 = yB
  }

  if (!pfade.length) {
    uebersprungen++
    continue
  }

  const schwerpunktLat = latSum / latAnzahl
  laender.push({
    iso,
    name,
    d: pfade.join(''),
    /** Umschließendes Rechteck in Kartenkoordinaten: x0 y0 x1 y1 */
    b: [bx0, by0, bx1, by1],
    // Der Gürtel: Erzeugerland und Schwerpunkt in den Tropen.
    ...(istErzeuger && Math.abs(schwerpunktLat) <= GUERTEL_LAT ? { belt: true } : {}),
  })
}

laender.sort((a, b) => a.iso.localeCompare(b.iso))

const ausgabe = {
  _generiert: 'scripts/make-worldmap.mjs — nicht von Hand bearbeiten',
  _quelle: 'Natural Earth 110m Admin 0 Countries (gemeinfrei)',
  _projektion: `Plate carrée, Ausschnitt ${LAT_OBEN}°N bis ${Math.abs(LAT_UNTEN)}°S`,
  viewBox: `0 0 ${BREITE} ${HOEHE}`,
  tropics: { cancer: rd(LAT_OBEN - KREBS), capricorn: rd(LAT_OBEN - STEINBOCK) },
  equator: rd(LAT_OBEN),
  countries: laender,
}

const ziel = join(hier, '..', 'data', 'worldmap.json')
await writeFile(ziel, JSON.stringify(ausgabe) + '\n')

const kb = (JSON.stringify(ausgabe).length / 1024).toFixed(0)
const guertel = laender.filter((l) => l.belt).length
console.log(
  `data/worldmap.json — ${laender.length} Länder, davon ${guertel} im Gürtel, ` +
    `${uebersprungen} außerhalb des Ausschnitts, ${kb} KB`,
)
