/** Beispieldaten für das UI-Kit (erfunden, im Stil der App). */
export const METHODS = ['espresso', 'v60', 'aeropress', 'frenchpress', 'batchbrew']
export const METHOD_LABEL = { espresso: 'Espresso', v60: 'V60', aeropress: 'AeroPress', frenchpress: 'French Press', batchbrew: 'Filterkaffeemaschine' }
export const METHOD_SHORT = { espresso: 'Espresso', v60: 'V60', aeropress: 'AeroPress', frenchpress: 'French', batchbrew: 'Maschine' }
export const BEANS = [
  { id: 'haus', name: 'Hausmischung', score: 82, tage: 12, note: 'im Fenster · 60/40 Brasilien, Äthiopien', process: 'Natural' },
  { id: 'yirga', name: 'Yirgacheffe Konga', score: 64, tage: 21, note: 'Am besten als V60', process: 'Washed' },
  { id: 'huila', name: 'Huila Finca El Paraíso', score: 91, tage: 8, note: 'ruht noch 2 Tage für Espresso', process: 'Washed' },
  { id: 'sumatra', name: 'Sumatra Mandheling', score: 28, tage: 48, note: 'über dem Fenster · feiner mahlen', process: 'Wet-hulled' },
]
export const BREWS = [
  { id: 'b1', bean: 'Hausmischung', method: 'espresso', line: '18,0 g → 36,0 g · 28 s', when: '24.09., 07:12', stars: 4, best: true },
  { id: 'b2', bean: 'Hausmischung', method: 'espresso', line: '18,0 g → 38,5 g · 35 s', when: '23.09., 07:05', stars: 2, defects: 'bitter' },
  { id: 'b3', bean: 'Yirgacheffe Konga', method: 'v60', line: '15,0 g → 250 g · 3:05', when: '22.09., 08:40', stars: 5 },
  { id: 'b4', bean: 'Huila Finca El Paraíso', method: 'aeropress', line: '14,0 g → 220 g · 2:00', when: '21.09., 09:15', stars: 3 },
]
export const RATIO_TERM = { term: 'Ratio', aka: 'Brühverhältnis', short: 'Wie viel Getränk aus wie viel Kaffee.', long: 'Beim Espresso Ausbeute zu Dosis (1:2 = 18 g rein, 36 g raus), beim Filter Wasser zu Kaffee.' }
