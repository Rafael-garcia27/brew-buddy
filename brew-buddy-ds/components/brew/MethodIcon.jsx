import React from 'react'

/** Strichzeichnungen je Methode — 24er Raster, Strich 1,8, currentColor, keine Füllung. Quelle: methodicons.tsx */
export const METHOD_ICONS = {
  "espresso": "<g fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.8 10.2h5.7\"/><path d=\"M8.5 7h11l-1.5 5.1a2.5 2.5 0 01-2.4 1.8h-3.2a2.5 2.5 0 01-2.4-1.8z\"/><path d=\"M12.4 13.9l-.7 3M15.6 13.9l.7 3\"/><path d=\"M11.5 19.6v1.6M16.5 19.6v1.6\" stroke-width=\"1.2\" stroke-opacity=\"0.65\"/></g>",
  "v60": "<g fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3.5 6.5h17\"/><path d=\"M5.2 6.5l5 11.4h3.6l5-11.4\"/><path d=\"M10.2 17.9h3.6l-.7 2.7h-2.2z\"/><path d=\"M9 8.6v7.4M12 8.6v9.1M15 8.6v7.4\" stroke-width=\"1.2\" stroke-opacity=\"0.65\"/></g>",
  "aeropress": "<g fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8.6 2.6h6.8\"/><path d=\"M12 2.6v3\"/><path d=\"M7 5.6h10v10.8a2.2 2.2 0 01-2.2 2.2H9.2A2.2 2.2 0 017 16.4z\"/><path d=\"M9.2 18.6h5.6l-.4 2.4H9.6z\"/><path d=\"M7 9.2h10\" stroke-width=\"1.2\" stroke-opacity=\"0.65\"/></g>",
  "frenchpress": "<g fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 1.6v1.9\"/><path d=\"M6.6 3.5h10.8v2H6.6z\"/><path d=\"M8 5.5h8v13.4a2.1 2.1 0 01-2.1 2.1h-3.8A2.1 2.1 0 018 18.9z\"/><path d=\"M16 9.4h1.8a1.7 1.7 0 010 3.4H16\"/><path d=\"M8.4 11.4h7.2\" stroke-width=\"1.2\" stroke-opacity=\"0.65\"/></g>",
  "batchbrew": "<g fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3.6 2.8h16.8v3H3.6z\"/><path d=\"M12 5.8v1.6\" stroke-width=\"1.2\" stroke-opacity=\"0.65\"/><path d=\"M7.6 7.4h8.8l-1.3 3.8H8.9z\"/><path d=\"M8.1 12.2h7.4v5.1a2.7 2.7 0 01-2.7 2.7h-2a2.7 2.7 0 01-2.7-2.7z\"/><path d=\"M15.5 13.9h1.6a1.7 1.7 0 010 3.4h-1.6\"/></g>",
  "chemex": "<g fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6.2 3.6h11.6l-4.4 8.2v.7l3.5 3.9a3.3 3.3 0 01-2.5 5.2h-4.8a3.3 3.3 0 01-2.5-5.2l3.5-3.9v-.7z\"/><path d=\"M8 12.8h8M7.6 14.4h8.8\"/><path d=\"M17.8 3.6l2 1.1\" stroke-width=\"1.2\" stroke-opacity=\"0.65\"/></g>",
  "kalita": "<g fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3.5 6.5h17\"/><path d=\"M5.2 6.5l3.1 9.9h7.4l3.1-9.9\"/><path d=\"M8.3 16.4h7.4\"/><path d=\"M9.4 16.4v3.4M12 16.4v3.4M14.6 16.4v3.4\"/></g>",
  "mokapot": "<g fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11 3.4h2\"/><path d=\"M12 3.4v1.2\" stroke-width=\"1.2\" stroke-opacity=\"0.65\"/><path d=\"M9.4 4.6h5.2l1.3 8.1H8.1z\"/><path d=\"M7.4 12.7h9.2\"/><path d=\"M8.4 12.7l-.9 6a1.8 1.8 0 001.8 2.1h5.4a1.8 1.8 0 001.8-2.1l-.9-6\"/><path d=\"M17 9.6l3.4 1.6-1.6 3.2\"/></g>",
  "cezve": "<g fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4.6 6.4h8.8\"/><path d=\"M5.6 6.4l1.4 10.4a2.6 2.6 0 002.6 2.2h1.2a2.6 2.6 0 002.6-2.2l1-7.4\"/><path d=\"M13.4 7.2l2.2-1\" stroke-width=\"1.2\" stroke-opacity=\"0.65\"/><path d=\"M13.9 9.6l6.5-2.6\"/></g>"
}

export function MethodIcon({ icon, size = 28, style }) {
  const inner = METHOD_ICONS[icon] || '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/>'
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={style} dangerouslySetInnerHTML={{ __html: inner }} />
}
