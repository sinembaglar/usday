import { useEffect, useRef } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

// Android's back button closes whatever is on top (a photo, a menu, a sheet), then goes back to the
// calendar tab, and only then puts the app in the background. Each layer registers itself here while it
// is shown; the highest level wins, and among equals the one opened last.
const layers = []

export function useBackButton(active, onBack, level = 1) {
  const run = useRef(onBack)
  useEffect(() => {
    run.current = onBack
  })
  useEffect(() => {
    if (!active) return
    const layer = { level, run: () => run.current() }
    layers.push(layer)
    return () => {
      layers.splice(layers.indexOf(layer), 1)
    }
  }, [active, level])
}

export function installBackButton() {
  if (Capacitor.getPlatform() !== 'android') return
  App.addListener('backButton', () => {
    const top = layers.reduce((best, l) => (!best || l.level >= best.level ? l : best), null)
    if (top) top.run()
    else App.minimizeApp()
  })
}
