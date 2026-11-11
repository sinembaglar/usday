import { useEffect, useState } from 'react'
import { Bell, Cake, CalendarPlus, ChevronRight, Copy, KeyRound, LogOut, MessageSquare, RefreshCw, Wrench } from 'lucide-react'
import { formatBirthday } from '../lib/birthdays'
import { supabase } from '../lib/supabase'
import { calendarToken, deleteAccount, loadBlocks, unblock } from '../lib/api'
import { getTheme, setTheme } from '../lib/theme'
import { enablePush, pushSupported, sendTestPush } from '../lib/push'
import ConnectionSettings from './ConnectionSettings'
import { isNative, pageUrl } from '../lib/native'
import { langChoice, setLangChoice, t, upper } from '../lib/i18n'
import CalendarSharing from './CalendarSharing'
import SubscriptionSettings from './SubscriptionSettings'

const THEMES = [
  { id: 'system', label: t('Telefona göre', 'Automatic') },
  { id: 'light', label: t('Açık', 'Light') },
  { id: 'dark', label: t('Koyu', 'Dark') },
]

// Each language is named in itself, so it can be found whatever the app is showing now.
const LANGUAGES = [
  { id: 'auto', label: t('Telefona göre', 'Automatic') },
  { id: 'tr', label: 'Türkçe' },
  { id: 'en', label: 'English' },
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
  onBirthday,
  billing,
  onBillingChanged,
  onPaywall,
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
        onToast(
          t(
            '🔕 Bu tarayıcı bildirim alamıyor. Safari ya da Chrome’dan açıp ana ekrana ekle.',
            '🔕 This browser can’t get notifications. Open UsDay in Safari or Chrome and add it to your home screen.',
          ),
        )
      } else if ((await enablePush()) !== 'granted') {
        onToast(
          t(
            '🔕 Bildirim izni verilmedi. Telefon ayarlarından UsDay’e izin ver.',
            '🔕 Notifications weren’t allowed. Turn them on for UsDay in your phone’s settings.',
          ),
        )
      } else {
        const sent = await sendTestPush()
        onToast(
          sent
            ? t(`🔔 Test bildirimi ${sent} cihaza gönderildi`, `🔔 Test sent to ${sent} ${sent === 1 ? 'device' : 'devices'}`)
            : t('Bildirim hiçbir cihaza ulaşmadı', 'The notification didn’t reach any device'),
        )
      }
    } catch {
      onToast(t('Test bildirimi gönderilemedi, tekrar dener misin?', 'Couldn’t send the test. Try again?'))
    }
    setTesting(false)
  }

  useEffect(() => {
    loadBlocks()
      .then(setBlocks)
      .catch(() => {})
  }, [])

  async function lift(b) {
    const question = t(
      `${b.blocked_name} kişisinin engeli kaldırılsın mı? Sana tekrar bağlanabilir ve davet gönderebilir.`,
      `Unblock ${b.blocked_name}? They’ll be able to connect with you and send invitations again.`,
    )
    if (!window.confirm(question)) return
    try {
      await unblock(me.id, b.blocked)
      setBlocks((list) => list.filter((x) => x.blocked !== b.blocked))
      onToast(t('Engel kaldırıldı', 'Unblocked'))
    } catch {
      onToast(t('Kaldırılamadı, tekrar dener misin?', 'Couldn’t unblock. Try again?'))
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      onToast(
        error.code === 'same_password'
          ? t('Yeni şifre eskisiyle aynı olamaz', 'The new password can’t be the same as the old one')
          : t('Şifre değiştirilemedi', 'Couldn’t change the password'),
      )
      return
    }
    setChanging(false)
    setNewPassword('')
    onToast(t('🔐 Şifren değiştirildi', '🔐 Password changed'))
  }

  async function removeAccount() {
    const word = t('SİL', 'DELETE')
    const answer = window.prompt(
      t(
        `Hesabın, eklediğin tüm planlar, fotoğraflar ve şablonlar kalıcı olarak silinecek. Bağlı olduğun kişilerin eklediği planlar onlarda kalır. Bu işlem geri alınamaz.\n\nOnaylamak için ${word} yaz:`,
        `Your account and all the plans, photos and templates you added will be deleted for good. Plans added by the people you’re connected with stay with them. This can’t be undone.\n\nType ${word} to confirm:`,
      ),
    )
    if (!answer || upper(answer.trim()) !== word) return
    setDeleting(true)
    try {
      await deleteAccount()
    } catch {
      setDeleting(false)
      onToast(t('Hesap silinemedi, tekrar dener misin?', 'Couldn’t delete your account. Try again?'))
    }
  }

  useEffect(() => {
    calendarToken()
      .then(setToken)
      .catch(() => onToast(t('Takvim bağlantısı alınamadı', 'Couldn’t get the calendar link')))
  }, [onToast])

  const feed = token && `usday.app/cal/${token}.ics`

  function chooseTheme(id) {
    setTheme(id)
    setThemeState(id)
  }

  async function copyFeed() {
    await navigator.clipboard?.writeText(`https://${feed}`)
    onToast(t('🔗 Takvim linki kopyalandı', '🔗 Calendar link copied'))
  }

  async function renew() {
    const question = t(
      'Eski link çalışmayı bırakacak. Takvim aboneliğini yeni linkle tekrar eklemen gerekecek. Devam edilsin mi?',
      'The old link will stop working, and you’ll need to add the calendar again with the new one. Continue?',
    )
    if (!window.confirm(question)) return
    setToken(await calendarToken(true))
    onToast(t('🔐 Yeni takvim linki oluşturuldu', '🔐 New calendar link created'))
  }

  return (
    <div className="settings">
      <h3>{t('Ayarlar', 'Settings')}</h3>

      {billing?.enabled && me && (
        <SubscriptionSettings
          billing={billing}
          me={me}
          connections={connections}
          members={members}
          onPaywall={onPaywall}
          onChanged={onBillingChanged}
          onToast={onToast}
        />
      )}

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
          <h4>{t('Engellenenler', 'Blocked')}</h4>
          <div className="list-card">
            {blocks.map((b) => (
              <div key={b.blocked} className="list-row">
                <span className="row-text">{b.blocked_name}</span>
                <button className="link-btn" onClick={() => lift(b)}>
                  {t('Engeli kaldır', 'Unblock')}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="settings-group">
        <h4>{t('Görünüm', 'Appearance')}</h4>
        <div className="segmented">
          {THEMES.map((option) => (
            <button key={option.id} className={theme === option.id ? 'is-active' : ''} onClick={() => chooseTheme(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h4>{t('Dil', 'Language')}</h4>
        <div className="segmented">
          {LANGUAGES.map((option) => (
            <button
              key={option.id}
              className={langChoice() === option.id ? 'is-active' : ''}
              onClick={() => langChoice() !== option.id && setLangChoice(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h4>{t('Telefonunun takvimi', 'Your phone’s calendar')}</h4>
        <p className="hint">
          {t(
            'Planlar Apple ya da Google Takvim’inde de görünür; sürprizler orada da gizli kalır.',
            'Your plans show up in Apple or Google Calendar too; surprises stay hidden there as well.',
          )}
        </p>
        <div className="list-card">
          <a className={`list-row ${token ? '' : 'is-disabled'}`} href={token ? `webcal://${feed}` : undefined}>
            <span className="row-icon">
              <CalendarPlus size={18} aria-hidden="true" />
            </span>
            <span className="row-text">{t('Apple Takvim’e ekle', 'Add to Apple Calendar')}</span>
            <ChevronRight size={18} className="row-chevron" aria-hidden="true" />
          </a>
          <button className="list-row" onClick={copyFeed} disabled={!token}>
            <span className="row-icon">
              <Copy size={18} aria-hidden="true" />
            </span>
            <span className="row-text">
              {t('Google Takvim için linki kopyala', 'Copy the link for Google Calendar')}
              <small>{t('Bilgisayarda: Diğer takvimler → + → URL ile', 'On a computer: Other calendars → + → From URL')}</small>
            </span>
          </button>
          <button className="list-row" onClick={renew} disabled={!token}>
            <span className="row-icon">
              <RefreshCw size={18} aria-hidden="true" />
            </span>
            <span className="row-text">
              {t('Linki yenile', 'Renew the link')}
              <small>{t('Eskisi çalışmayı bırakır', 'The old one stops working')}</small>
            </span>
          </button>
        </div>
      </section>

      <section className="settings-group">
        <h4>{t('Bildirimler ve destek', 'Notifications and support')}</h4>
        <div className="list-card">
          {/* Phone notifications in the app come with the store version's push setup. */}
          {!isNative && (
            <button className="list-row" onClick={testPush} disabled={testing}>
              <span className="row-icon">
                <Bell size={18} aria-hidden="true" />
              </span>
              <span className="row-text">
                {testing ? t('Gönderiliyor…', 'Sending…') : t('Test bildirimi gönder', 'Send a test notification')}
                <small>{t('Bildirim gelmiyorsa buradan dene', 'Try this if notifications don’t arrive')}</small>
              </span>
            </button>
          )}
          <button className="list-row" onClick={onFeedback}>
            <span className="row-icon">
              <MessageSquare size={18} aria-hidden="true" />
            </span>
            <span className="row-text">{t('Geri bildirim gönder', 'Send feedback')}</span>
            <ChevronRight size={18} className="row-chevron" aria-hidden="true" />
          </button>
          {admin && (
            <button className="list-row" onClick={onAdmin}>
              <span className="row-icon">
                <Wrench size={18} aria-hidden="true" />
              </span>
              <span className="row-text">{t('Yönetim paneli', 'Admin panel')}</span>
              <ChevronRight size={18} className="row-chevron" aria-hidden="true" />
            </button>
          )}
        </div>
      </section>

      <section className="settings-group">
        <h4>
          {t('Hesap', 'Account')}
          {me ? ` · ${me.name}` : ''}
        </h4>
        <div className="list-card">
          <button className="list-row" onClick={onBirthday}>
            <span className="row-icon">
              <Cake size={18} aria-hidden="true" />
            </span>
            <span className="row-text">
              {t('Doğum günüm', 'My birthday')}
              <small>{me?.birthday ? formatBirthday(me.birthday) : t('Eklenmedi', 'Not added')}</small>
            </span>
            <ChevronRight size={18} className="row-chevron" aria-hidden="true" />
          </button>
          {changing ? (
            <form className="inline-form list-form" onSubmit={changePassword}>
              <input
                className="input"
                type="password"
                placeholder={t('Yeni şifre (en az 8 karakter)', 'New password (at least 8 characters)')}
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
              />
              <button className="btn btn-primary">{t('Kaydet', 'Save')}</button>
            </form>
          ) : (
            <button className="list-row" onClick={() => setChanging(true)}>
              <span className="row-icon">
                <KeyRound size={18} aria-hidden="true" />
              </span>
              <span className="row-text">{t('Şifreyi değiştir', 'Change password')}</span>
              <ChevronRight size={18} className="row-chevron" aria-hidden="true" />
            </button>
          )}
          <button className="list-row" onClick={() => supabase.auth.signOut()}>
            <span className="row-icon">
              <LogOut size={18} aria-hidden="true" />
            </span>
            <span className="row-text">{t('Çıkış yap', 'Sign out')}</span>
          </button>
        </div>
        <button className="link-btn danger-link" onClick={removeAccount} disabled={deleting}>
          {deleting ? t('Hesap siliniyor…', 'Deleting your account…') : t('Hesabımı kalıcı olarak sil', 'Delete my account permanently')}
        </button>
      </section>

      <p className="legal-links">
        <a href={pageUrl('gizlilik')} target="_blank" rel="noreferrer">
          {t('Gizlilik Politikası', 'Privacy Policy')}
        </a>{' '}
        ·{' '}
        <a href={pageUrl('kosullar')} target="_blank" rel="noreferrer">
          {t('Kullanım Koşulları', 'Terms of Use')}
        </a>{' '}
        ·{' '}
        <a href={pageUrl('destek')} target="_blank" rel="noreferrer">
          {t('Destek', 'Support')}
        </a>
      </p>

      <div className="form-actions">
        <button className="btn btn-primary" onClick={onClose}>
          {t('Tamam', 'Done')}
        </button>
      </div>
    </div>
  )
}
