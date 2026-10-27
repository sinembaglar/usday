import { useEffect, useState } from 'react'
import { enablePush, isIos, isStandalone, pushSupported } from '../lib/push'

function initialState() {
  if (!pushSupported()) return isIos() && !isStandalone() ? 'install' : 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
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
      <section className="notice card">
        <span className="notice-emoji">🔕</span>
        <span>
          <strong>Bu tarayıcıda bildirim alamazsın</strong>
          <small>
            UsDay’i iPhone’da Safari’den, Android’de Chrome’dan aç ve ana ekrana ekle. WhatsApp ya da Instagram
            içinden açılan sayfalar bildirim alamaz.
          </small>
        </span>
      </section>
    )
  }

  if (state === 'failed') {
    return (
      <section className="notice card">
        <span className="notice-emoji">⚠️</span>
        <span>
          <strong>Bildirimler bu cihazda kaydedilemedi</strong>
          <small>İnternetin varken tekrar dene.</small>
        </span>
        <button className="btn btn-primary" onClick={turnOn} disabled={busy}>
          {busy ? '…' : 'Tekrar'}
        </button>
      </section>
    )
  }

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
          {partnerName ? `${partnerName} plan eklediğinde ya da yorum yazdığında` : 'Plan ve yorum geldiğinde'}, yaklaşan
          planlardan önce de haber verelim.
        </small>
      </span>
      <button className="btn btn-primary" onClick={turnOn} disabled={busy}>
        {busy ? '…' : 'Aç'}
      </button>
    </section>
  )
}
