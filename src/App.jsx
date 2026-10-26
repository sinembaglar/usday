import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import AuthScreen from './components/AuthScreen'
import NewPasswordScreen from './components/NewPasswordScreen'
import Home from './components/Home'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="splash">UsDay</div>
  if (recovering) return <NewPasswordScreen onDone={() => setRecovering(false)} />
  if (!session) return <AuthScreen />
  return <Home userId={session.user.id} />
}
