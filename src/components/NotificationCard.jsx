import { useEffect, useState } from 'react'
import { enablePush, isIos, isStandalone, pushSupported } from '../lib/push'

function initialState() {
  if (!pushSupported()) return isIos() && !isStandalone() ? 'install' : 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export default function NotificationCard({ partnerName, onToast }) {
  const [state, setState] = useState(initialState)
  const [busy, setBusy] = useState(false)

  // Keep this device's subscription fresh once permission was given.
  useEffect(() => {
    if (state === 'granted') enablePush().catch(() => {})
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

  if (state === 'granted' || state === 'unsupported') return null

  if (state === 'install') {
    return (
      <section className="notice card">
        <span className="notice-emoji">📲</span>
        <span>
          <strong>Bildirim almak için UsDay’i ana ekrana ekle</strong>
          <small>
            Safari’de <b>Paylaş</b> ⬆️ → <b>Ana Ekrana Ekle</b>, sonra UsDay’i ana ekrandaki ikondan aç.
          </small>
        </span>
      </section>
    )
  }

  if (state === 'denied') {
    return (
      <section className="notice card">
        <span className="notice-emoji">🔕</span>
        <span>
          <strong>Bildirimler kapalı</strong>
          <small>iPhone Ayarlar → Bildirimler → UsDay’den açabilirsin.</small>
        </span>
      </section>
    )
  }

  return (
    <section className="notice card">
      <span className="notice-emoji">🔔</span>
      <span>
        <strong>Bildirimleri aç</strong>
        <small>
          {partnerName ? `${partnerName} plan eklediğinde` : 'Eşin plan eklediğinde'} ve yaklaşan planlardan önce
          haber verelim.
        </small>
      </span>
      <button className="btn btn-primary" onClick={turnOn} disabled={busy}>
        {busy ? '…' : 'Aç'}
      </button>
    </section>
  )
}
