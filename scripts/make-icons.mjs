/**
 * App-Icons aus dem Design-System erzeugen.
 *
 *   npm run icons
 *
 * Quelle ist brew-buddy-ds/assets/app-icon/: die Bildmarke „Buddies im
 * Sefed" — zwei B aus Bohnenprofilen auf dem geflochtenen Tablett. Das
 * Design-System ist die Wahrheit; hier wird nur übertragen, nie gezeichnet.
 *
 * Gerastert wird mit Chrome ohne Fenster. Auf dem Rechner ist weder
 * ImageMagick noch rsvg-convert installiert, und `sips` kann kein SVG
 * rastern. Die Bildmarke besteht aus Bézierkurven, die sich — anders als
 * der alte Mahlring aus Kreisen — nicht sinnvoll von Hand rastern lassen.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const QUELLE = 'brew-buddy-ds/assets/app-icon'
const GRUND = '#4e3629' // Pantone 476 C — Grund des Standard-Icons

const CHROME = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].find((p) => p && existsSync(p))
if (!CHROME) {
  console.error('Kein Chrome gefunden. Pfad per CHROME=… angeben.')
  process.exit(1)
}

/**
 * Die Dateien aus Claude Design tragen ein Herkunftszertifikat (C2PA) als
 * <metadata>, rund 9 KB je Datei. Im Design-System bleibt es stehen; in
 * die App, wo jedes Byte beim ersten Laden gecacht wird, gehört es nicht.
 */
const ohneMetadaten = (svg) => svg.replace(/<metadata>[\s\S]*?<\/metadata>/, '')
const lies = (datei) => ohneMetadaten(readFileSync(join(QUELLE, datei), 'utf8'))

const icon = lies('app-icon-standard.svg')
writeFileSync('public/favicon.svg', lies('favicon.svg') + '\n')

const tmp = mkdtempSync(join(tmpdir(), 'bb-icons-'))

/**
 * @param anteil Anteil der Kantenlänge, den das Icon einnimmt. Unter 1
 *   liegt es auf vollflächigem Grund — für „maskable", wo Android bis
 *   auf den inneren Kreis (80 %) zuschneiden darf.
 */
function raster(ziel, size, anteil = 1) {
  const html = join(tmp, 'icon.html')
  const svg = 'data:image/svg+xml;base64,' + Buffer.from(icon).toString('base64')
  writeFileSync(
    html,
    `<!doctype html><html><body style="margin:0;background:${GRUND};` +
      `width:${size}px;height:${size}px;display:grid;place-items:center;overflow:hidden">` +
      `<img src="${svg}" style="width:${size * anteil}px;height:${size * anteil}px;display:block"></body></html>`,
  )
  execFileSync(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${size},${size}`,
    `--screenshot=${join(process.cwd(), ziel)}`,
    `file://${html}`,
  ], { stdio: 'ignore' })
}

try {
  raster('public/icon-192.png', 192)
  raster('public/icon-512.png', 512)
  raster('public/apple-touch-icon.png', 180)
  raster('public/icon-maskable-512.png', 512, 0.8)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
console.log('Icons erzeugt: favicon.svg, 192, 512, maskable-512, apple-touch-180')
