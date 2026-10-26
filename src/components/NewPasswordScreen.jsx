import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Shown after opening the "şifremi unuttum" e-mail link.
export default function NewPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setError(error.code === 'same_password' ? 'Yeni şifre eskisiyle aynı olamaz.' : 'Şifre güncellenemedi, tekrar dener misin?')
      return
    }
    window.history.replaceState(null, '', '/')
    onDone()
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <img src="/icon-192.png" alt="" className="auth-logo" />
        <h1>UsDay</h1>
        <p>Yeni şifreni belirle 🔐</p>
      </div>
      <form className="auth-card card" onSubmit={handleSubmit}>
        <input
          className="input"
          type="password"
          placeholder="Yeni şifre (en az 8 karakter)"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Bir saniye…' : 'Şifreyi kaydet'}
        </button>
        <small className="hint">
          Bağlantı Safari’de açıldıysa: şifreyi kaydettikten sonra ana ekrandaki UsDay’den yeni şifrenle giriş yapabilirsin.
        </small>
      </form>
    </div>
  )
}
