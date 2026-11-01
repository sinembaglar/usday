import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import { watchErrors } from './lib/errors'
import { registerServiceWorker } from './lib/push'
import { applyTheme, watchSystemTheme } from './lib/theme'
import { watchForUpdates } from './lib/updates'

watchErrors()
applyTheme()
watchSystemTheme()
registerServiceWorker()
watchForUpdates()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
