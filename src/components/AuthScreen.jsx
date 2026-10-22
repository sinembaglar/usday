import { useState } from 'react'
import { supabase } from '../lib/supabase'

const MESSAGES = {
  invalid_credentials: 'E-posta ya da şifre hatalı.',
  user_already_exists: 'Bu e-posta zaten kayıtlı, giriş yapmayı dene.',
  signup_disabled: 'Yeni kayıtlar kapalı.',
  weak_password: 'Şifre en az 8 karakter olmalı.',
  email_address_invalid: 'Geçerli bir e-posta adresi yaz.',
}

export default function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const email = form.email.trim()
    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password: form.password })
        : await supabase.auth.signUp({ email, password: form.password, options: { data: { name: form.name.trim() } } })
    if (error) setError(MESSAGES[error.code] ?? 'Bir şeyler ters gitti, tekrar dener misin?')
    setBusy(false)
  }

  const signup = mode === 'signup'

  return (
    <div className="auth">
      <div className="auth-hero">
        <img src="/icon-192.png" alt="" className="auth-logo" />
        <h1>UsDay</h1>
        <p>Bizim günlerimiz, planlarımız ve sürprizlerimiz 💜</p>
      </div>

      <form className="auth-card card" onSubmit={handleSubmit}>
        <div className="auth-tabs">
          <button type="button" className={!signup ? 'is-active' : ''} onClick={() => setMode('login')}>
            Giriş yap
          </button>
          <button type="button" className={signup ? 'is-active' : ''} onClick={() => setMode('signup')}>
            Kayıt ol
          </button>
        </div>

        {signup && <input className="input" placeholder="Adın" value={form.name} onChange={set('name')} required />}
        <input
          className="input"
          type="email"
          placeholder="E-posta"
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          required
        />
        <input
          className="input"
          type="password"
          placeholder={signup ? 'Şifre (en az 8 karakter)' : 'Şifre'}
          autoComplete={signup ? 'new-password' : 'current-password'}
          minLength={8}
          value={form.password}
          onChange={set('password')}
          required
        />

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Bir saniye…' : signup ? 'Hesap oluştur' : 'Giriş yap'}
        </button>
      </form>
    </div>
  )
}
