import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'

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
      setError(
        error.code === 'same_password'
          ? t('Yeni şifre eskisiyle aynı olamaz.', 'The new password can’t be the same as the old one.')
          : t('Şifre güncellenemedi, tekrar dener misin?', 'Couldn’t update the password. Try again?'),
      )
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
        <p>{t('Yeni şifreni belirle 🔐', 'Set a new password 🔐')}</p>
      </div>
      <form className="auth-card card" onSubmit={handleSubmit}>
        <input
          className="input"
          type="password"
          placeholder={t('Yeni şifre (en az 8 karakter)', 'New password (at least 8 characters)')}
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? t('Bir saniye…', 'One moment…') : t('Şifreyi kaydet', 'Save password')}
        </button>
        <small className="hint">
          {t(
            'Bağlantı Safari’de açıldıysa: şifreyi kaydettikten sonra ana ekrandaki UsDay’den yeni şifrenle giriş yapabilirsin.',
            'If the link opened in your browser: after saving, sign in to the UsDay app with your new password.',
          )}
        </small>
      </form>
    </div>
  )
}
