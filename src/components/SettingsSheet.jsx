import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calendarToken, deleteAccount } from '../lib/api'
import { getTheme, setTheme } from '../lib/theme'

const THEMES = [
  { id: 'system', label: '📱 Telefona göre' },
  { id: 'light', label: '☀️ Açık' },
  { id: 'dark', label: '🌙 Koyu' },
]

export default function SettingsSheet({ me, couple, onTogetherSince, onClose, onToast }) {
  const [theme, setThemeState] = useState(getTheme)
  const [since, setSince] = useState(couple.togetherSince)
  const [token, setToken] = useState(null)
  const [changing, setChanging] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function changePassword(e) {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      onToast(error.code === 'same_password' ? 'Yeni şifre eskisiyle aynı olamaz' : 'Şifre değiştirilemedi')
      return
    }
    setChanging(false)
    setNewPassword('')
    onToast('🔐 Şifren değiştirildi')
  }

  async function removeAccount() {
    const answer = window.prompt(
      'Hesabın, eklediğin tüm planlar, fotoğraflar ve şablonlar kalıcı olarak silinecek. Eşinin eklediği planlar onda kalır. Bu işlem geri alınamaz.\n\nOnaylamak için SİL yaz:',
    )
    if (answer?.trim().toLocaleUpperCase('tr') !== 'SİL') return
    setDeleting(true)
    try {
      await deleteAccount()
    } catch {
      setDeleting(false)
      onToast('Hesap silinemedi, tekrar dener misin?')
    }
  }

  useEffect(() => {
    calendarToken()
      .then(setToken)
      .catch(() => onToast('Takvim bağlantısı alınamadı'))
  }, [onToast])

  const feed = token && `usday.app/cal/${token}.ics`

  function chooseTheme(id) {
    setTheme(id)
    setThemeState(id)
  }

  async function copyFeed() {
    await navigator.clipboard?.writeText(`https://${feed}`)
    onToast('🔗 Takvim linki kopyalandı')
  }

  async function renew() {
    if (!window.confirm('Eski link çalışmayı bırakacak. Takvim aboneliğini yeni linkle tekrar eklemen gerekecek. Devam edilsin mi?')) return
    setToken(await calendarToken(true))
    onToast('🔐 Yeni takvim linki oluşturuldu')
  }

  return (
    <div className="settings">
      <h3>Ayarlar</h3>

      <section className="settings-group">
        <h4>💜 Birlikte olduğumuz gün</h4>
        <p className="hint">Kapakta kaçıncı gününüz olduğu görünür. Yıldönümleriniz ve özel günleriniz (100., 1000. gün…) takvime kendiliğinden eklenir, sabah bildirim gelir.</p>
        <div className="inline-form">
          <input
            className="input"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={since}
            onChange={(e) => setSince(e.target.value)}
            aria-label="Birlikte olduğumuz gün"
          />
          <button className="btn btn-primary" disabled={since === couple.togetherSince} onClick={() => onTogetherSince(since)}>
            Kaydet
          </button>
        </div>
      </section>

      <section className="settings-group">
        <h4>Tema</h4>
        <div className="segmented">
          {THEMES.map((t) => (
            <button key={t.id} className={theme === t.id ? 'is-active' : ''} onClick={() => chooseTheme(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h4>Telefonunun takviminde gör</h4>
        <p className="hint">
          UsDay planları Apple ya da Google Takvim’inde de görünür ve kendiliğinden güncellenir. Sürprizler orada da
          gizli kalır.
        </p>
        <a className={`btn btn-primary ${token ? '' : 'is-disabled'}`} href={token ? `webcal://${feed}` : undefined}>
          🍎 Apple Takvim’e ekle
        </a>
        <button className="btn btn-ghost bordered" onClick={copyFeed} disabled={!token}>
          🔗 Google Takvim için linki kopyala
        </button>
        <p className="hint">
          Google Takvim: bilgisayarda <b>Diğer takvimler → + → URL ile</b> seçip linki yapıştır.
        </p>
        <button className="link-btn" onClick={renew} disabled={!token}>
          Linki yenile (eskisini geçersiz kıl)
        </button>
      </section>

      <section className="settings-group">
        <h4>Hesap</h4>
        {changing ? (
          <form className="inline-form" onSubmit={changePassword}>
            <input
              className="input"
              type="password"
              placeholder="Yeni şifre (en az 8 karakter)"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoFocus
            />
            <button className="btn btn-primary">Kaydet</button>
          </form>
        ) : (
          <button className="btn btn-ghost bordered" onClick={() => setChanging(true)}>
            🔐 Şifreyi değiştir
          </button>
        )}
        <button className="btn btn-ghost bordered" onClick={() => supabase.auth.signOut()}>
          Çıkış yap{me ? ` · ${me.name}` : ''}
        </button>
        <button className="link-btn danger-link" onClick={removeAccount} disabled={deleting}>
          {deleting ? 'Hesap siliniyor…' : 'Hesabımı kalıcı olarak sil'}
        </button>
      </section>

      <p className="legal-links">
        <a href="/gizlilik" target="_blank" rel="noreferrer">
          Gizlilik Politikası
        </a>{' '}
        ·{' '}
        <a href="/kosullar" target="_blank" rel="noreferrer">
          Kullanım Koşulları
        </a>
      </p>

      <div className="form-actions">
        <button className="btn btn-primary" onClick={onClose}>
          Tamam
        </button>
      </div>
    </div>
  )
}
