import { useState } from 'react'

export default function PhotoGallery({ photos, locked }) {
  const [open, setOpen] = useState(null)

  return (
    <>
      <div className={`gallery ${locked ? 'is-locked' : ''}`}>
        {photos.map((src, i) => (
          <button key={i} className="gallery-item" onClick={() => !locked && setOpen(src)} disabled={locked}>
            <img src={src} alt="" />
            {locked && <span className="gallery-lock">🔒</span>}
          </button>
        ))}
      </div>

      {open && (
        <div className="lightbox" onClick={() => setOpen(null)}>
          <img src={open} alt="" />
        </div>
      )}
    </>
  )
}
