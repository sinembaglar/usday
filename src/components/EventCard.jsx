import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { SURPRISE_COLOR, TAGS, USERS } from '../lib/constants'
import { isHiddenFor } from '../lib/surprise'

export default function EventCard({ event, viewer, onClick, showDate }) {
  const hidden = isHiddenFor(event, viewer)
  const tag = TAGS[event.tag]
  const author = USERS[event.createdBy]
  const meta = [
    showDate && format(parseISO(event.date), 'd MMMM EEE', { locale: tr }),
    event.time,
    hidden && 'detaylar gizli',
  ].filter(Boolean)

  return (
    <button className="event-card" onClick={onClick} style={{ '--tag': hidden ? SURPRISE_COLOR : tag.color }}>
      <span className="event-emoji">{hidden ? '🎁' : tag.emoji}</span>
      <span className="event-body">
        <strong>{hidden ? 'Sürpriz!' : event.title}</strong>
        {meta.length > 0 && <small>{meta.join(' · ')}</small>}
      </span>
      {event.photos?.length > 0 && (
        <span className={`card-thumb ${hidden && event.blurPhotos ? 'is-locked' : ''}`}>
          <img src={event.photos[0]} alt="" />
        </span>
      )}
      {event.surprise && !hidden && <span className="badge">🎁</span>}
      <span className="avatar" style={{ background: author.color }} title={author.name}>
        {author.short}
      </span>
    </button>
  )
}
