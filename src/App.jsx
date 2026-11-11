import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import AuthScreen from './components/AuthScreen'
import Landing from './components/Landing'
import NewPasswordScreen from './components/NewPasswordScreen'
import Home from './components/Home'
import { hideSplash, isNative, statusBarText } from './lib/native'
import { isDark } from './lib/theme'
import { syncLanguage } from './lib/api'
import { startPurchases } from './lib/purchases'

const RETURNING_KEY = 'usday:returning'

// A first visit in the browser starts on the introduction. An invitation link (?davet=), ?giris, the
// installed app and anyone who has signed in here before go straight to signing in.
function firstScreen() {
  const params = new URLSearchParams(window.location.search)
  let returning = false
  try {
    returning = localStorage.getItem(RETURNING_KEY) === '1'
  } catch {
    // private mode
  }
  const installed = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone
  // The phone app was found in a store: no need to introduce UsDay again.
  return isNative || params.has('davet') || params.has('giris') || installed || returning ? 'login' : 'landing'
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [recovering, setRecovering] = useState(false)
  const [screen, setScreen] = useState(firstScreen) // landing | login | signup

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    try {
      localStorage.setItem(RETURNING_KEY, '1')
    } catch {
      // private mode
    }
  }, [session])

  // Once per sign-in: tell the server which language and time zone this phone uses.
  const user = session?.user
  useEffect(() => {
    if (!user) return
    syncLanguage(user).catch(() => {})
    startPurchases(user.id).catch(() => {})
    // only when the signed-in person changes, not on every token refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // In the phone app: drop the launch screen once we know what to show; signed-out screens are light.
  useEffect(() => {
    if (session === undefined) return
    hideSplash()
    if (!session) statusBarText(isDark())
  }, [session])

  function go(next) {
    setScreen(next)
    window.scrollTo(0, 0)
  }

  if (session === undefined) return <div className="splash">UsDay</div>
  if (recovering) return <NewPasswordScreen onDone={() => setRecovering(false)} />
  if (!session && screen === 'landing') return <Landing onStart={() => go('signup')} onLogin={() => go('login')} />
  if (!session) return <AuthScreen key={screen} initialMode={screen} onBack={firstScreen() === 'landing' ? () => go('landing') : null} />
  return <Home userId={session.user.id} />
}
