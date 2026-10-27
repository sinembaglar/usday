import { useState } from 'react'
import { Lock } from 'lucide-react'

export default function PhotoGallery({ photos }) {
  const [open, setOpen] = useState(null)

  return (
    <>
      <div className="gallery">
        {photos.map((photo) =>
          photo.url ? (
            <button key={photo.path} className="gallery-item" onClick={() => setOpen(photo.url)}>
              <img src={photo.url} alt="" />
            </button>
          ) : (
            <span key={photo.path} className="gallery-item is-locked">
              <span className="gallery-lock">
                <Lock size={24} aria-label="Açılınca görünür" />
              </span>
            </span>
          ),
        )}
      </div>

      {open && (
        <div className="lightbox" onClick={() => setOpen(null)}>
          <img src={open} alt="" />
        </div>
      )}
    </>
  )
}
