import { useRef, useState } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { resizeImage } from '../lib/image'
import ImageCropper from './ImageCropper'
import Sheet from './Sheet'

export const COVER_ASPECT = 5 / 4

function countdownLabel(date) {
  const days = differenceInCalendarDays(parseISO(date), new Date())
  if (days === 0) return 'Bugün'
  if (days === 1) return 'Yarın'
  return `${days} gün sonra`
}

export default function Cover({ photo, onPhoto, nextEvent, onOpen, onSettings, dayCount }) {
  const inputRef = useRef(null)
  const [picked, setPicked] = useState(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setPicked(await resizeImage(file, 2400))
  }

  async function handleCropped(dataUrl) {
    setPicked(null)
    setUploading(true)
    await onPhoto(dataUrl)
    setUploading(false)
  }

  return (
    <header className="cover" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
      {photo && <div className="cover-shade" />}
      <div className="cover-top">
        <span className="brand-block">
          <span className="brand">UsDay</span>
          {dayCount > 0 && (
            <button className="day-count" onClick={onSettings}>
              💜 {dayCount.toLocaleString('tr-TR')}. günümüz
            </button>
          )}
        </span>
        <span className="cover-actions">
          <button className="cover-photo-btn" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Yükleniyor…' : photo ? '📷 Değiştir' : '📷 Fotoğrafınızı ekleyin'}
          </button>
          <button className="cover-photo-btn cover-icon" onClick={onSettings} aria-label="Ayarlar">
            ⚙️
          </button>
        </span>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      </div>

      {nextEvent ? (
        <button className="countdown" onClick={() => onOpen(nextEvent)}>
          <small>Sıradaki date</small>
          <strong>{countdownLabel(nextEvent.date)}</strong>
          <span>
            {nextEvent.locked ? '🎁 Bir sürpriz yaklaşıyor' : nextEvent.title}
            {' · '}
            {format(parseISO(nextEvent.date), 'd MMMM', { locale: tr })}
          </span>
        </button>
      ) : (
        <div className="countdown">
          <small>Sıradaki date</small>
          <span>Henüz plan yok, bir tane ekleyelim mi? 💕</span>
        </div>
      )}

      {picked && (
        <Sheet onClose={() => setPicked(null)}>
          <ImageCropper src={picked} aspect={COVER_ASPECT} onCancel={() => setPicked(null)} onDone={handleCropped} />
        </Sheet>
      )}
    </header>
  )
}
