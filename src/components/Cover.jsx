import { useRef } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { isHiddenFor } from '../lib/surprise'
import { resizeImage } from '../lib/storage'

function countdownLabel(date) {
  const days = differenceInCalendarDays(parseISO(date), new Date())
  if (days === 0) return 'Bugün'
  if (days === 1) return 'Yarın'
  return `${days} gün sonra`
}

export default function Cover({ photo, onPhoto, nextEvent, viewer, onOpen }) {
  const inputRef = useRef(null)
  const hidden = nextEvent && isHiddenFor(nextEvent, viewer)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    onPhoto(await resizeImage(file))
    e.target.value = ''
  }

  return (
    <header className="cover" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
      {photo && <div className="cover-shade" />}
      <div className="cover-top">
        <span className="brand">UsDay</span>
        <button className="cover-photo-btn" onClick={() => inputRef.current?.click()}>
          {photo ? 'Fotoğrafı değiştir' : '📷 Fotoğrafınızı ekleyin'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      </div>

      {nextEvent ? (
        <button className="countdown" onClick={() => onOpen(nextEvent)}>
          <small>Sıradaki date</small>
          <strong>{countdownLabel(nextEvent.date)}</strong>
          <span>
            {hidden ? '🎁 Bir sürpriz yaklaşıyor' : nextEvent.title}
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
