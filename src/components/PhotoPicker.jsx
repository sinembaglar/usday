import { useRef } from 'react'
import { resizeImage } from '../lib/storage'

export default function PhotoPicker({ photos, onChange }) {
  const inputRef = useRef(null)

  async function handleFiles(e) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!files.length) return
    const resized = await Promise.all(files.map((f) => resizeImage(f, 1200)))
    onChange([...photos, ...resized])
  }

  return (
    <div className="photo-picker">
      {photos.map((src, i) => (
        <div key={i} className="photo-thumb">
          <img src={src} alt="" />
          <button type="button" aria-label="Kaldır" onClick={() => onChange(photos.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="photo-add" onClick={() => inputRef.current?.click()}>
        <span>🎟️</span>
        Bilet / fotoğraf
      </button>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
    </div>
  )
}
