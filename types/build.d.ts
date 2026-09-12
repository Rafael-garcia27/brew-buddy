/**
 * Kennungen, die Vite beim Bauen einsetzt (siehe `define` in vite.config.ts).
 *
 * Kein Import aus `package.json`: Das zöge die ganze Datei in den Typraum
 * und wäre je nach Bundler auch im Bundle. Hier sind es drei Zeichenketten,
 * die zur Bauzeit textuell ersetzt werden.
 */
declare const __APP_VERSION__: string
/** Kurzer Commit-Hash, oder `lokal` außerhalb eines Git-Baums. */
declare const __APP_COMMIT__: string
/** Baudatum als `JJJJ-MM-TT`. */
declare const __APP_BUILT__: string
