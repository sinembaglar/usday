import { useEffect, useRef } from 'react'
import { useBackButton } from '../lib/back'

const CLOSE_AFTER = 110 // px pulled down

// A bottom sheet. Pulling it down from the top closes it, like on iPhone; parts that use dragging
// themselves (the photo cropper) are marked with data-no-swipe. A locked sheet (a required answer)
// cannot be pulled away or closed by tapping outside.
//
// For screen readers and keyboards: the sheet is a dialog named after its first heading, focus moves
// into it when it opens and back where it was when it closes, Tab stays inside, and Escape closes it.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
let nextId = 0

export default function Sheet({ onClose, locked = false, children }) {
  const ref = useRef(null)
  const drag = useRef(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  })

  // Android back button: closes the sheet like Escape does; a locked sheet stays.
  useBackButton(true, () => {
    if (!locked) closeRef.current()
  })

  useEffect(() => {
    const sheet = ref.current
    const before = document.activeElement
    const heading = sheet.querySelector('h1, h2, h3, h4')
    if (heading) {
      heading.id ||= `sheet-title-${++nextId}`
      sheet.setAttribute('aria-labelledby', heading.id)
    }
    // A field that asks for focus itself (autoFocus) keeps it.
    if (!sheet.contains(document.activeElement)) sheet.focus({ preventScroll: true })

    function onKey(e) {
      if (e.key === 'Escape' && !locked) {
        e.stopPropagation()
        closeRef.current()
      } else if (e.key === 'Tab') {
        const items = [...sheet.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
        if (!items.length) return
        const first = items[0], last = items.at(-1)
        if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (before instanceof HTMLElement && before.isConnected) before.focus({ preventScroll: true })
    }
  }, [locked])

  function onTouchStart(e) {
    const sheet = ref.current
    if (locked || sheet.scrollTop > 0 || e.target.closest('[data-no-swipe]')) return
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
    <div className="sheet-backdrop" onClick={locked ? undefined : onClose}>
      <div
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {!locked && <span className="sheet-handle" aria-hidden="true" />}
        {children}
      </div>
    </div>
  )
}
