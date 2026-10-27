import { useRef, useState } from 'react'
import { resizeImage } from '../lib/image'
import ImageCropper from './ImageCropper'
import Highlights from './Highlights'
import Sheet from './Sheet'

export const COVER_ASPECT = 5 / 4

// onPhoto is only given when one person is selected: each connection has its own cover.
export default function Cover({ photo, onPhoto, highlights, onOpen, onSettings, onInbox, unread, counter }) {
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
    <header className={`cover ${photo ? 'has-photo' : ''}`} style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
      {photo && <div className="cover-shade" />}
      <div className="cover-top">
        <span className="brand-block">
          <span className="brand">UsDay</span>
          {counter && (
            <button className="day-count" onClick={onSettings}>
              {counter}
            </button>
          )}
        </span>
        <span className="cover-actions">
          {onPhoto && (
            <button className="cover-photo-btn" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? 'Yükleniyor…' : photo ? '📷 Değiştir' : '📷 Fotoğrafınızı ekleyin'}
            </button>
          )}
          <button
            className="cover-photo-btn cover-icon bell"
            onClick={onInbox}
            aria-label={unread ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'}
          >
            🔔
            {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button className="cover-photo-btn cover-icon" onClick={onSettings} aria-label="Ayarlar">
            ⚙️
          </button>
        </span>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      </div>

      <Highlights key={highlights.map((h) => h.kind).join()} items={highlights} onOpen={onOpen} />

      {picked && (
        <Sheet onClose={() => setPicked(null)}>
          <ImageCropper src={picked} aspect={COVER_ASPECT} onCancel={() => setPicked(null)} onDone={handleCropped} />
        </Sheet>
      )}
    </header>
  )
}
