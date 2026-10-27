import { useEffect, useRef, useState } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Pin } from 'lucide-react'
import { timeSpan } from '../lib/format'

const STORAGE_KEY = 'usday:highlight'
const ROTATE_MS = 6000

function savedKind() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function countdownLabel(date) {
  const days = differenceInCalendarDays(parseISO(date), new Date())
  if (days === 0) return 'Bugün'
  if (days === 1) return 'Yarın'
  return `${days} gün sonra`
}

// Swipeable cards on the cover: next date, surprise, special day, trip, plan.
// They turn by themselves until the person swipes; then the chosen card stays, also next time.
export default function Highlights({ items, onOpen }) {
  const trackRef = useRef(null)
  const [index, setIndex] = useState(() => Math.max(0, items.findIndex((i) => i.kind === savedKind())))
  const [pinned, setPinned] = useState(() => items.some((i) => i.kind === savedKind()))

  // Turn automatically until the person takes over.
  useEffect(() => {
    if (pinned || items.length < 2) return
    const id = setInterval(() => {
      const track = trackRef.current
      if (!track) return
      const next = (Math.round(track.scrollLeft / track.clientWidth) + 1) % items.length
      track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' })
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [pinned, items.length])

  // Start on the saved card.
  useEffect(() => {
    const track = trackRef.current
    if (track && index > 0) track.scrollTo({ left: index * track.clientWidth })
    // only on first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onScroll() {
    const track = trackRef.current
    setIndex(Math.round(track.scrollLeft / track.clientWidth))
  }

  // A swipe or tap on the dots pins the current card.
  function pin(i = index) {
    setPinned(true)
    try {
      localStorage.setItem(STORAGE_KEY, items[i].kind)
    } catch {
      // not remembered in private mode
    }
  }

  function goTo(i) {
    trackRef.current.scrollTo({ left: i * trackRef.current.clientWidth, behavior: 'smooth' })
    pin(i)
  }

  if (!items.length) {
    return (
      <div className="highlights">
        <div className="countdown">
          <small>Sıradaki buluşma</small>
          <span>Henüz plan yok, bir tane ekleyelim mi? 💕</span>
        </div>
      </div>
    )
  }

  return (
    <div className="highlights">
      <div
        ref={trackRef}
        className="highlight-track"
        onScroll={onScroll}
        onTouchEnd={() => pin()}
        onPointerUp={(e) => e.pointerType === 'mouse' || pin()}
      >
        {items.map((item) => (
          <div key={item.kind} className="highlight-slide">
            <button className="countdown" onClick={() => item.event && onOpen(item.event)}>
              <small>{item.label}</small>
              <strong>{countdownLabel(item.event.date)}</strong>
              <span>
                {item.text}
                {' · '}
                {format(parseISO(item.event.date), 'd MMMM', { locale: tr })}
                {timeSpan(item.event) && ` · ${timeSpan(item.event)}`}
              </span>
            </button>
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="highlight-dots" role="tablist" aria-label="Öne çıkanlar">
          {items.map((item, i) => (
            <button
              key={item.kind}
              role="tab"
              aria-selected={i === index}
              aria-label={item.label}
              className={i === index ? 'is-active' : ''}
              onClick={() => goTo(i)}
            />
          ))}
          {pinned && <Pin className="pin-mark" size={12} aria-label="Seçimin sabit" />}
        </div>
      )}
    </div>
  )
}
