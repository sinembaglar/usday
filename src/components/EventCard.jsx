import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { SURPRISE_COLOR, TAGS, UNKNOWN_PERSON } from '../lib/constants'
import { timeSpan } from '../lib/format'

const US = { name: 'İkiniz', short: '💜', color: 'var(--blush)' }

export default function EventCard({ event, members, onClick, showDate, isNew }) {
  const hidden = event.locked
  const tag = TAGS[event.tag] ?? TAGS.plan
  const author = event.milestone ? US : (members[event.createdBy] ?? UNKNOWN_PERSON)
  const thumb = event.photos[0]
  const status =
    event.status === 'proposed' ? '⏳ yanıt bekleniyor' : event.status === 'declined' ? '❌ uygun değil' : null
  const meta = [
    status,
    showDate && format(parseISO(event.date), 'd MMMM EEE', { locale: tr }),
    timeSpan(event),
    !hidden && event.location && `📍 ${event.location}`,
    hidden && 'detaylar gizli',
  ].filter(Boolean)

  return (
    <button
      className={`event-card ${event.status && event.status !== 'confirmed' ? `is-${event.status}` : ''}`}
      onClick={onClick}
      style={{ '--tag': hidden ? SURPRISE_COLOR : tag.color }}
    >
      <span className="event-emoji">{hidden ? '🎁' : event.milestone ? '🥂' : tag.emoji}</span>
      <span className="event-body">
        <strong>
          {hidden ? 'Sürpriz!' : event.title}
          {isNew && <span className="new-pill">yeni</span>}
        </strong>
        {meta.length > 0 && <small>{meta.join(' · ')}</small>}
      </span>
      {thumb && (
        <span className={`card-thumb ${thumb.url ? '' : 'is-locked'}`}>{thumb.url && <img src={thumb.url} alt="" />}</span>
      )}
      <span className="card-badges">
        {event.repeat && event.repeat !== 'none' && <span title="Tekrarlanıyor">🔁</span>}
        {event.surprise && !hidden && <span title="Sürpriz">🎁</span>}
        {event.commentCount > 0 && <span className="comment-count">💬 {event.commentCount}</span>}
      </span>
      <span className="avatar" style={{ background: author.color }} title={author.name}>
        {author.short}
      </span>
    </button>
  )
}
