import { useEffect, useState } from 'react'
import { Bell, BellOff, Smartphone, TriangleAlert } from 'lucide-react'
import { enablePush, isIos, isStandalone, pushSupported } from '../lib/push'
import { isNative } from '../lib/native'
import { t } from '../lib/i18n'

function initialState() {
  if (isNative) return 'granted' // phone app: notifications come with the store version's push setup
  if (!pushSupported()) return isIos() && !isStandalone() ? 'install' : 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

function Notice({ Icon, title, text, children }) {
  return (
    <section className="notice card">
      <span className="notice-icon">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      {children}
    </section>
  )
}

export default function NotificationCard({ partnerName, onToast }) {
  const [state, setState] = useState(initialState)
  const [busy, setBusy] = useState(false)

  // Keep this device's subscription fresh once permission was given; say so if it fails. The phone app
  // has no web push, so there is nothing to renew there.
  useEffect(() => {
    if (state === 'granted' && !isNative) enablePush().catch(() => setState('failed'))
  }, [state])

  async function turnOn() {
    setBusy(true)
    try {
      const result = await enablePush()
      setState(result)
      if (result === 'granted') onToast(t('🔔 Bildirimler açık', '🔔 Notifications are on'))
    } catch {
      onToast(t('Bildirimler açılamadı, tekrar dener misin?', 'Couldn’t turn on notifications. Try again?'))
    }
    setBusy(false)
  }

  if (state === 'granted') return null

  if (state === 'unsupported') {
    return (
      <Notice
        Icon={BellOff}
        title={t('Bu tarayıcıda bildirim yok', 'No notifications in this browser')}
        text={t('UsDay’i Safari ya da Chrome’dan açıp ana ekrana ekle.', 'Open UsDay in Safari or Chrome and add it to your home screen.')}
      />
    )
  }

  if (state === 'failed') {
    return (
      <Notice
        Icon={TriangleAlert}
        title={t('Bildirimler kaydedilemedi', 'Couldn’t set up notifications')}
        text={t('İnternetin varken tekrar dene.', 'Try again when you’re online.')}
      >
        <button className="btn btn-primary btn-small" onClick={turnOn} disabled={busy}>
          {busy ? '…' : t('Tekrar', 'Retry')}
        </button>
      </Notice>
    )
  }

  if (state === 'install') {
    return (
      <Notice
        Icon={Smartphone}
        title={t('Bildirim için ana ekrana ekle', 'Add to your home screen for notifications')}
        text={t('Safari’de Paylaş → Ana Ekrana Ekle, sonra ikondan aç.', 'In Safari: Share → Add to Home Screen, then open it from the icon.')}
      />
    )
  }

  if (state === 'denied') {
    return (
      <Notice
        Icon={BellOff}
        title={t('Bildirimler kapalı', 'Notifications are off')}
        text={t('iPhone Ayarlar → Bildirimler → UsDay’den açabilirsin.', 'Turn them on in Settings → Notifications → UsDay.')}
      />
    )
  }

  return (
    <Notice
      Icon={Bell}
      title={t('Bildirimleri aç', 'Turn on notifications')}
      text={
        partnerName
          ? t(`${partnerName} plan ekleyince ya da yazınca haberin olsun.`, `Know when ${partnerName} adds a plan or writes.`)
          : t('Yeni plan ve yorumlardan haberin olsun.', 'Hear about new plans and comments.')
      }
    >
      <button className="btn btn-primary btn-small" onClick={turnOn} disabled={busy}>
        {busy ? '…' : t('Aç', 'Turn on')}
      </button>
    </Notice>
  )
}
