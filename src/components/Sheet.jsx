import { useRef } from 'react'

const CLOSE_AFTER = 110 // px pulled down

// A bottom sheet. Pulling it down from the top closes it, like on iPhone; parts that use dragging
// themselves (the photo cropper) are marked with data-no-swipe.
export default function Sheet({ onClose, children }) {
  const ref = useRef(null)
  const drag = useRef(null)

  function onTouchStart(e) {
    const sheet = ref.current
    if (sheet.scrollTop > 0 || e.target.closest('[data-no-swipe]')) return
    drag.current = { y: e.touches[0].clientY, dy: 0 }
  }

  function onTouchMove(e) {
    if (!drag.current) return
    const sheet = ref.current
    const dy = e.touches[0].clientY - drag.current.y
    // Scrolling up inside the sheet is normal scrolling, not closing.
    if (dy <= 0 || sheet.scrollTop > 0) {
      drag.current.dy = 0
      sheet.style.transform = ''
      return
    }
    drag.current.dy = dy
    sheet.style.transition = 'none'
    sheet.style.transform = `translateY(${dy}px)`
  }

  function onTouchEnd() {
    if (!drag.current) return
    const { dy } = drag.current
    drag.current = null
    const sheet = ref.current
    sheet.style.transition = 'transform 0.2s ease'
    if (dy > CLOSE_AFTER) {
      sheet.style.transform = 'translateY(100%)'
      setTimeout(onClose, 180)
    } else {
      sheet.style.transform = ''
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <span className="sheet-handle" />
        {children}
      </div>
    </div>
  )
}
