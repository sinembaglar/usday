import { useEffect, useState } from 'react'
import { Bell, BellOff, Smartphone, TriangleAlert } from 'lucide-react'
import { enablePush, isIos, isStandalone, pushSupported } from '../lib/push'

function initialState() {
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

  // Keep this device's subscription fresh once permission was given; say so if it fails.
  useEffect(() => {
    if (state === 'granted') enablePush().catch(() => setState('failed'))
  }, [state])

  async function turnOn() {
    setBusy(true)
    try {
      const result = await enablePush()
      setState(result)
      if (result === 'granted') onToast('🔔 Bildirimler açık')
    } catch {
      onToast('Bildirimler açılamadı, tekrar dener misin?')
    }
    setBusy(false)
  }

  if (state === 'granted') return null

  if (state === 'unsupported') {
    return (
      <Notice
        Icon={BellOff}
        title="Bu tarayıcıda bildirim yok"
        text="UsDay’i Safari ya da Chrome’dan açıp ana ekrana ekle."
      />
    )
  }

  if (state === 'failed') {
    return (
      <Notice Icon={TriangleAlert} title="Bildirimler kaydedilemedi" text="İnternetin varken tekrar dene.">
        <button className="btn btn-primary btn-small" onClick={turnOn} disabled={busy}>
          {busy ? '…' : 'Tekrar'}
        </button>
      </Notice>
    )
  }

  if (state === 'install') {
    return (
      <Notice Icon={Smartphone} title="Bildirim için ana ekrana ekle" text="Safari’de Paylaş → Ana Ekrana Ekle, sonra ikondan aç." />
    )
  }

  if (state === 'denied') {
    return <Notice Icon={BellOff} title="Bildirimler kapalı" text="iPhone Ayarlar → Bildirimler → UsDay’den açabilirsin." />
  }

  return (
    <Notice
      Icon={Bell}
      title="Bildirimleri aç"
      text={partnerName ? `${partnerName} plan ekleyince ya da yazınca haberin olsun.` : 'Yeni plan ve yorumlardan haberin olsun.'}
    >
      <button className="btn btn-primary btn-small" onClick={turnOn} disabled={busy}>
        {busy ? '…' : 'Aç'}
      </button>
    </Notice>
  )
}
