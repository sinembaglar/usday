import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { SURPRISE_COLOR, TAGS, UNKNOWN_PERSON } from '../lib/constants'

export default function EventCard({ event, members, onClick, showDate, isNew }) {
  const hidden = event.locked
  const tag = TAGS[event.tag] ?? TAGS.plan
  const author = members[event.createdBy] ?? UNKNOWN_PERSON
  const thumb = event.photos[0]
  const meta = [
    showDate && format(parseISO(event.date), 'd MMMM EEE', { locale: tr }),
    event.time,
    hidden && 'detaylar gizli',
  ].filter(Boolean)

  return (
    <button className="event-card" onClick={onClick} style={{ '--tag': hidden ? SURPRISE_COLOR : tag.color }}>
      <span className="event-emoji">{hidden ? '🎁' : tag.emoji}</span>
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
      {event.surprise && !hidden && <span className="badge">🎁</span>}
      <span className="avatar" style={{ background: author.color }} title={author.name}>
        {author.short}
      </span>
    </button>
  )
}
