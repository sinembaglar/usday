import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { checkInvite } from '../lib/api'

const MESSAGES = {
  invalid_credentials: 'E-posta ya da şifre hatalı.',
  user_already_exists: 'Bu e-posta zaten kayıtlı, giriş yapmayı dene.',
  signup_disabled: 'Yeni kayıtlar kapalı.',
  weak_password: 'Şifre en az 8 karakter olmalı.',
  email_address_invalid: 'Geçerli bir e-posta adresi yaz.',
}

const inviteFromUrl = new URLSearchParams(window.location.search).get('davet')?.toUpperCase() ?? ''

export default function AuthScreen() {
  const [mode, setMode] = useState(inviteFromUrl ? 'signup' : 'login')
  const [form, setForm] = useState({ name: '', email: '', password: '', invite: inviteFromUrl })
  const [inviter, setInviter] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const code = form.invite.trim().toUpperCase()

  useEffect(() => {
    if (code.length !== 6) return
    let active = true
    checkInvite(code)
      .then((name) => active && setInviter(name))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [code])

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const email = form.email.trim()

    if (mode === 'signup' && code) {
      const name = await checkInvite(code).catch(() => null)
      if (!name) {
        setError('Bu davet kodu geçersiz ya da kullanılmış. Kodu eşinden tekrar iste.')
        setBusy(false)
        return
      }
    }

    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password: form.password })
        : await supabase.auth.signUp({
            email,
            password: form.password,
            options: { data: { name: form.name.trim(), invite_code: code } },
          })
    if (error) setError(MESSAGES[error.code] ?? 'Bir şeyler ters gitti, tekrar dener misin?')
    else if (inviteFromUrl) window.history.replaceState(null, '', '/')
    setBusy(false)
  }

  const signup = mode === 'signup'
  const greeting = code.length === 6 && inviter

  return (
    <div className="auth">
      <div className="auth-hero">
        <img src="/icon-192.png" alt="" className="auth-logo" />
        <h1>UsDay</h1>
        <p>{greeting ? `💌 ${inviter} seni ortak takvimine davet etti` : 'Bizim günlerimiz, planlarımız ve sürprizlerimiz 💜'}</p>
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

        {signup && (
          <label className="field">
            <span>Davet kodu · eşin seni davet ettiyse</span>
            <input
              className="input code-input"
              placeholder="Örn. K7MP2X"
              maxLength={6}
              autoCapitalize="characters"
              value={form.invite}
              onChange={set('invite')}
            />
            <small className="hint">
              {greeting
                ? `✓ ${inviter} ile aynı takvime bağlanacaksın`
                : 'Kod yoksa boş bırak. Kendi takvimini açarsın, eşini sonra davet edersin.'}
            </small>
          </label>
        )}

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Bir saniye…' : signup ? 'Hesap oluştur' : 'Giriş yap'}
        </button>
      </form>
    </div>
  )
}
