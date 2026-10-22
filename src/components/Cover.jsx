import { useRef, useState } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { resizeImage } from '../lib/image'

function countdownLabel(date) {
  const days = differenceInCalendarDays(parseISO(date), new Date())
  if (days === 0) return 'Bugün'
  if (days === 1) return 'Yarın'
  return `${days} gün sonra`
}

export default function Cover({ photo, onPhoto, nextEvent, onOpen }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    await onPhoto(await resizeImage(file))
    setUploading(false)
  }

  return (
    <header className="cover" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
      {photo && <div className="cover-shade" />}
      <div className="cover-top">
        <span className="brand">UsDay</span>
        <button className="cover-photo-btn" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Yükleniyor…' : photo ? 'Fotoğrafı değiştir' : '📷 Fotoğrafınızı ekleyin'}
        </button>
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
    </header>
  )
}
