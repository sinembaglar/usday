import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calendarToken, deleteAccount, loadBlocks, unblock } from '../lib/api'
import { getTheme, setTheme } from '../lib/theme'
import { enablePush, pushSupported, sendTestPush } from '../lib/push'
import ConnectionSettings from './ConnectionSettings'
import CalendarSharing from './CalendarSharing'

const THEMES = [
  { id: 'system', label: '📱 Telefona göre' },
  { id: 'light', label: '☀️ Açık' },
  { id: 'dark', label: '🌙 Koyu' },
]

export default function SettingsSheet({
  me,
  admin,
  connections,
  members,
  connectionActions,
  shares,
  onSharesChanged,
  onFeedback,
  onAdmin,
  onClose,
  onToast,
}) {
  const [theme, setThemeState] = useState(getTheme)
  const [token, setToken] = useState(null)
  const [changing, setChanging] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [blocks, setBlocks] = useState([])
  const [testing, setTesting] = useState(false)

  // Turns notifications on for this device if needed, then sends a test to all my devices.
  async function testPush() {
    setTesting(true)
    try {
      if (!pushSupported()) {
        onToast('🔕 Bu tarayıcı bildirim alamıyor. Safari ya da Chrome’dan açıp ana ekrana ekle.')
      } else if ((await enablePush()) !== 'granted') {
        onToast('🔕 Bildirim izni verilmedi. Telefon ayarlarından UsDay’e izin ver.')
      } else {
        const sent = await sendTestPush()
        onToast(sent ? `🔔 Test bildirimi ${sent} cihaza gönderildi` : 'Bildirim hiçbir cihaza ulaşmadı')
      }
    } catch {
      onToast('Test bildirimi gönderilemedi, tekrar dener misin?')
    }
    setTesting(false)
  }

  useEffect(() => {
    loadBlocks()
      .then(setBlocks)
      .catch(() => {})
  }, [])

  async function lift(b) {
    if (!window.confirm(`${b.blocked_name} kişisinin engeli kaldırılsın mı? Sana tekrar bağlanabilir ve davet gönderebilir.`)) return
    try {
      await unblock(me.id, b.blocked)
      setBlocks((list) => list.filter((x) => x.blocked !== b.blocked))
      onToast('Engel kaldırıldı')
    } catch {
      onToast('Kaldırılamadı, tekrar dener misin?')
    }
  }

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

      <ConnectionSettings connections={connections} members={members} {...connectionActions} />

      {me && (
        <CalendarSharing
          me={me.id}
          people={[...new Set(connections.map((c) => c.partnerId).filter(Boolean))]}
          members={members}
          shares={shares}
          onChanged={onSharesChanged}
          onToast={onToast}
        />
      )}

      {blocks.length > 0 && (
        <section className="settings-group">
          <h4>🚫 Engellenenler</h4>
          {blocks.map((b) => (
            <div key={b.blocked} className="blocked-row">
              <span>{b.blocked_name}</span>
              <button className="link-btn" onClick={() => lift(b)}>
                Engeli kaldır
              </button>
            </div>
          ))}
        </section>
      )}

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
        <h4>Bildirimler</h4>
        <p className="hint">
          Bildirim gelmiyorsa buradan deneyebilirsin. iPhone’da UsDay’i ana ekrana ekleyip oradan açman gerekir.
        </p>
        <button className="btn btn-ghost bordered" onClick={testPush} disabled={testing}>
          {testing ? 'Gönderiliyor…' : '🔔 Test bildirimi gönder'}
        </button>
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
        <h4>Destek</h4>
        <button className="btn btn-ghost bordered" onClick={onFeedback}>
          💬 Geri bildirim gönder
        </button>
        {admin && (
          <button className="btn btn-ghost bordered" onClick={onAdmin}>
            🛠 Yönetim paneli
          </button>
        )}
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
