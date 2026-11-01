import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import { watchErrors } from './lib/errors'
import { registerServiceWorker } from './lib/push'
import { applyTheme, watchSystemTheme } from './lib/theme'
import { watchForUpdates } from './lib/updates'
import { isNative } from './lib/native'

watchErrors()
applyTheme()
watchSystemTheme()
// The phone app ships its own copy of the site and gets new versions from the store; web push and the
// update check are for the browser and home-screen version.
if (!isNative) {
  registerServiceWorker()
  watchForUpdates()
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
