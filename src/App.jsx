import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import AuthScreen from './components/AuthScreen'
import Home from './components/Home'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="splash">UsDay</div>
  if (!session) return <AuthScreen />
  return <Home userId={session.user.id} />
}
