import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { pageUrl, publicOrigin } from '../lib/native'
import { lang, t, timeZone } from '../lib/i18n'
import { checkInvite } from '../lib/api'
import BirthdayPicker from './BirthdayPicker'

const MESSAGES = {
  invalid_credentials: t('E-posta ya da şifre hatalı.', 'Wrong email or password.'),
  user_already_exists: t('Bu e-posta zaten kayıtlı, giriş yapmayı dene.', 'This email is already registered. Try signing in.'),
  signup_disabled: t('Yeni kayıtlar kapalı.', 'New sign-ups are closed.'),
  weak_password: t('Şifre en az 8 karakter olmalı.', 'The password must be at least 8 characters.'),
  email_address_invalid: t('Geçerli bir e-posta adresi yaz.', 'Enter a valid email address.'),
  over_email_send_rate_limit: t('Çok sık denendi. Birkaç dakika sonra tekrar dene.', 'Too many tries. Try again in a few minutes.'),
}

const inviteFromUrl = new URLSearchParams(window.location.search).get('davet')?.toUpperCase() ?? ''

export default function AuthScreen({ initialMode = 'login', onBack = null }) {
  const [mode, setMode] = useState(inviteFromUrl ? 'signup' : initialMode) // login | signup | forgot
  const [form, setForm] = useState({ name: '', email: '', password: '', invite: inviteFromUrl, birthday: '' })
  const [inviter, setInviter] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
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

  function switchMode(next) {
    setMode(next)
    setError('')
    setNotice('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const email = form.email.trim()

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${publicOrigin()}/` })
      if (error) setError(MESSAGES[error.code] ?? t('E-posta gönderilemedi, tekrar dener misin?', 'Couldn’t send the email. Try again?'))
      else
        setNotice(
          t(
            '📬 Şifre yenileme bağlantısını e-postana gönderdik. Gelen kutunu (ve gereksiz klasörünü) kontrol et.',
            '📬 We sent a password reset link to your email. Check your inbox (and your spam folder).',
          ),
        )
      setBusy(false)
      return
    }

    if (mode === 'signup' && !form.birthday) {
      setError(t('Doğum gününü seç; sevdiklerin hatırlasın diye.', 'Pick your birthday so your people remember it.'))
      setBusy(false)
      return
    }

    if (mode === 'signup' && code) {
      const name = await checkInvite(code).catch(() => null)
      if (!name) {
        setError(
          t(
            'Bu davet kodu geçersiz ya da kullanılmış. Kodu seni davet eden kişiden tekrar iste.',
            'This invite code is invalid or already used. Ask the person who invited you to send it again.',
          ),
        )
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
            // The language and time zone also choose the language of the e-mails UsDay sends.
            options: {
              data: { name: form.name.trim(), invite_code: code, birthday: `2000-${form.birthday}`, lang, time_zone: timeZone() },
            },
          })
    if (error) setError(MESSAGES[error.code] ?? t('Bir şeyler ters gitti, tekrar dener misin?', 'Something went wrong. Try again?'))
    else if (inviteFromUrl) window.history.replaceState(null, '', '/')
    setBusy(false)
  }

  const signup = mode === 'signup'
  const forgot = mode === 'forgot'
  const greeting = code.length === 6 && inviter

  return (
    <div className="auth">
      {onBack && (
        <button className="link-btn auth-back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> {t('UsDay nedir?', 'What is UsDay?')}
        </button>
      )}
      <div className="auth-hero">
        <img src="/icon-192.png" alt="" className="auth-logo" />
        <h1>UsDay</h1>
        <p>
          {greeting
            ? t(`💌 ${inviter} seni ortak takvimine davet etti`, `💌 ${inviter} invited you to a shared calendar`)
            : t('Bizim günlerimiz, planlarımız ve sürprizlerimiz', 'Our days, our plans, our surprises')}
        </p>
      </div>

      <form className="auth-card card" onSubmit={handleSubmit}>
        {forgot ? (
          <div className="auth-heading">
            <strong>{t('Şifreni mi unuttun?', 'Forgot your password?')}</strong>
            <small>{t('E-postanı yaz, yeni şifre belirleme bağlantısı gönderelim.', 'Enter your email and we’ll send you a link to set a new one.')}</small>
          </div>
        ) : (
          <div className="auth-tabs">
            <button type="button" className={!signup ? 'is-active' : ''} onClick={() => switchMode('login')}>
              {t('Giriş yap', 'Sign in')}
            </button>
            <button type="button" className={signup ? 'is-active' : ''} onClick={() => switchMode('signup')}>
              {t('Kayıt ol', 'Sign up')}
            </button>
          </div>
        )}

        {signup && <input className="input" placeholder={t('Adın', 'Your name')} value={form.name} onChange={set('name')} required />}
        {signup && (
          <label className="field">
            <span>{t('Doğum günün (yıl sorulmaz)', 'Your birthday (no year needed)')}</span>
            <BirthdayPicker value={form.birthday} onChange={(birthday) => setForm((f) => ({ ...f, birthday }))} id="signup-birthday" />
          </label>
        )}
        <input
          className="input"
          type="email"
          placeholder={t('E-posta', 'Email')}
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          required
        />
        {!forgot && (
          <input
            className="input"
            type="password"
            placeholder={signup ? t('Şifre (en az 8 karakter)', 'Password (at least 8 characters)') : t('Şifre', 'Password')}
            autoComplete={signup ? 'new-password' : 'current-password'}
            minLength={8}
            value={form.password}
            onChange={set('password')}
            required
          />
        )}

        {signup && (
          <label className="field">
            <span>{t('Davet kodu · biri seni davet ettiyse', 'Invite code · if someone invited you')}</span>
            <input
              className="input code-input"
              placeholder={t('Örn. K7MP2X', 'E.g. K7MP2X')}
              maxLength={6}
              autoCapitalize="characters"
              value={form.invite}
              onChange={set('invite')}
            />
            <small className="hint">
              {greeting
                ? t(`✓ ${inviter} ile aynı takvime bağlanacaksın`, `✓ You’ll share a calendar with ${inviter}`)
                : t(
                    'Kod yoksa boş bırak. Takvimini açarsın, sevdiklerini sonra davet edersin.',
                    'No code? Leave it empty. You’ll set up your calendar and invite your people later.',
                  )}
            </small>
          </label>
        )}

        {error && <p className="form-error">{error}</p>}
        {notice && <p className="form-notice">{notice}</p>}

        <button className="btn btn-primary" disabled={busy}>
          {busy
            ? t('Bir saniye…', 'One moment…')
            : forgot
              ? t('Bağlantı gönder', 'Send link')
              : signup
                ? t('Hesap oluştur', 'Create account')
                : t('Giriş yap', 'Sign in')}
        </button>

        {mode === 'login' && (
          <button type="button" className="link-btn" onClick={() => switchMode('forgot')}>
            {t('Şifremi unuttum', 'Forgot password')}
          </button>
        )}
        {forgot && (
          <button type="button" className="link-btn" onClick={() => switchMode('login')}>
            {t('Girişe dön', 'Back to sign in')}
          </button>
        )}
      </form>

      <p className="legal-links">
        {t(
          <>
            {signup && 'Kayıt olarak '}
            <a href={pageUrl('kosullar')}>Kullanım Koşulları</a> · <a href={pageUrl('gizlilik')}>Gizlilik Politikası</a>
            {signup && '’nı kabul etmiş olursun.'}
          </>,
          signup ? (
            <>
              By signing up you accept the <a href={pageUrl('kosullar')}>Terms of Use</a> and the{' '}
              <a href={pageUrl('gizlilik')}>Privacy Policy</a>.
            </>
          ) : (
            <>
              <a href={pageUrl('kosullar')}>Terms of Use</a> · <a href={pageUrl('gizlilik')}>Privacy Policy</a>
            </>
          ),
        )}
      </p>
    </div>
  )
}
