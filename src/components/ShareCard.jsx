import { useEffect, useState } from 'react'
import { isNative, shareImage } from '../lib/native'
import { drawCard } from '../lib/shareCard'
import { t } from '../lib/i18n'

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
      .catch(() => active && onToast(t('Kart hazırlanamadı', 'Couldn’t make the card')))
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [card, withPhoto, onToast])

  async function share() {
    if (isNative) {
      await shareImage(image.blob, 'usday.png').catch(() => onToast(t('Kart paylaşılamadı', 'Couldn’t share the card')))
      return
    }
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
    onToast(t('📥 Kart indirildi', '📥 Card downloaded'))
  }

  return (
    <div className="settings share-card">
      <h3>{t('Hikâyende paylaş', 'Share to your story')}</h3>
      <div className="share-preview">{image ? <img src={image.url} alt={t('Paylaşılacak kart', 'Card to share')} /> : <span>{t('Hazırlanıyor…', 'Getting it ready…')}</span>}</div>
      {card.photoUrl && (
        <div className="segmented">
          <button className={withPhoto ? 'is-active' : ''} onClick={() => setWithPhoto(true)}>
            {t('Fotoğraflı', 'With photo')}
          </button>
          <button className={withPhoto ? '' : 'is-active'} onClick={() => setWithPhoto(false)}>
            {t('Sade', 'Plain')}
          </button>
        </div>
      )}
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          {t('Geri', 'Back')}
        </button>
        <button className="btn btn-primary" onClick={share} disabled={!image}>
          {t('Paylaş', 'Share')}
        </button>
      </div>
    </div>
  )
}
