import { useRef } from 'react'
import { Ticket, X } from 'lucide-react'
import { resizeImage } from '../lib/image'

// photos: [{ path, url }] already uploaded, or [{ dataUrl }] picked now
export default function PhotoPicker({ photos, onChange }) {
  const inputRef = useRef(null)

  async function handleFiles(e) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!files.length) return
    const resized = await Promise.all(files.map((f) => resizeImage(f, 1200)))
    onChange([...photos, ...resized.map((dataUrl) => ({ dataUrl }))])
  }

  return (
    <div className="photo-picker">
      {photos.map((photo, i) => (
        <div key={photo.path ?? i} className="photo-thumb">
          <img src={photo.dataUrl ?? photo.url} alt="" />
          <button type="button" aria-label="Kaldır" onClick={() => onChange(photos.filter((_, j) => j !== i))}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
      <button type="button" className="photo-add" onClick={() => inputRef.current?.click()}>
        <Ticket size={22} aria-hidden="true" />
        Bilet / fotoğraf
      </button>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
    </div>
  )
}
