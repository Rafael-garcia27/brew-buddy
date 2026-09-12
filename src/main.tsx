import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import { installFlushHandlers, requestPersistence } from './store/persist'

installFlushHandlers()
// Ohne dauerhaften Speicher räumt Safari nach 7 Tagen Inaktivität auf.
void requestPersistence()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Außen um alles: Was die Fehlergrenze nicht umschließt, kann sie
        nicht auffangen — und dann bleibt wieder die weiße Seite. */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
