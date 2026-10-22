import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calendarToken } from '../lib/api'
import { getTheme, setTheme } from '../lib/theme'

const THEMES = [
  { id: 'system', label: '📱 Telefona göre' },
  { id: 'light', label: '☀️ Açık' },
  { id: 'dark', label: '🌙 Koyu' },
]

export default function SettingsSheet({ me, onClose, onToast }) {
  const [theme, setThemeState] = useState(getTheme)
  const [token, setToken] = useState(null)

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
        <button className="btn btn-ghost bordered" onClick={() => supabase.auth.signOut()}>
          Çıkış yap{me ? ` · ${me.name}` : ''}
        </button>
      </section>

      <div className="form-actions">
        <button className="btn btn-primary" onClick={onClose}>
          Tamam
        </button>
      </div>
    </div>
  )
}
