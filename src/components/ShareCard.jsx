import { useEffect, useState } from 'react'
import { drawCard } from '../lib/shareCard'

// Preview of a story card, then the phone's share menu (Instagram, WhatsApp…) or a download.
export default function ShareCard({ card, onClose, onToast }) {
  const [withPhoto, setWithPhoto] = useState(Boolean(card.photoUrl))
  const [image, setImage] = useState(null) // { blob, url }

  useEffect(() => {
    let active = true
    let url = null
    drawCard({ ...card, photoUrl: withPhoto ? card.photoUrl : null })
      .then((blob) => {
        if (!active) return
        url = URL.createObjectURL(blob)
        setImage({ blob, url })
      })
      .catch(() => active && onToast('Kart hazırlanamadı'))
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [card, withPhoto, onToast])

  async function share() {
    const file = new File([image.blob], 'usday.png', { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
      } catch {
        // closed the share menu
      }
      return
    }
    const a = document.createElement('a')
    a.href = image.url
    a.download = 'usday.png'
    a.click()
    onToast('📥 Kart indirildi')
  }

  return (
    <div className="settings share-card">
      <h3>Hikâyende paylaş</h3>
      <div className="share-preview">{image ? <img src={image.url} alt="Paylaşılacak kart" /> : <span>Hazırlanıyor…</span>}</div>
      {card.photoUrl && (
        <div className="segmented">
          <button className={withPhoto ? 'is-active' : ''} onClick={() => setWithPhoto(true)}>
            Fotoğraflı
          </button>
          <button className={withPhoto ? '' : 'is-active'} onClick={() => setWithPhoto(false)}>
            Sade
          </button>
        </div>
      )}
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Geri
        </button>
        <button className="btn btn-primary" onClick={share} disabled={!image}>
          Paylaş
        </button>
      </div>
    </div>
  )
}
