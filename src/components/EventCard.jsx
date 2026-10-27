import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { SURPRISE_COLOR, TAGS, UNKNOWN_PERSON, tagEmoji } from '../lib/constants'
import { timeSpan } from '../lib/format'

const US = { name: 'İkiniz', short: '💜', color: 'var(--blush)' }

// What a group plan says about me and the group.
function groupLine(event, me) {
  const mine = event.guests.find((g) => g.id === me)
  const coming = event.guests.filter((g) => g.status === 'accepted').length + 1 // the maker counts
  if (mine?.status === 'pending') return '📨 davet · yanıtını bekliyor'
  if (mine?.status === 'declined') return '❌ katılmıyorsun'
  return `✅ ${coming}/${event.guests.length + 1} geliyor`
}

// withWhom: "👯 Ayşe" when plans of several people are shown together.
export default function EventCard({ event, members, onClick, showDate, isNew, withWhom, me }) {
  const hidden = event.locked
  const tag = TAGS[event.tag] ?? TAGS.plan
  const author = event.milestone ? US : (members[event.createdBy] ?? UNKNOWN_PERSON)
  const thumb = event.photos[0]
  const status = event.guests
    ? groupLine(event, me)
    : event.status === 'proposed'
      ? '⏳ yanıt bekleniyor'
      : event.status === 'declined'
        ? '❌ uygun değil'
        : null
  const iDeclined = event.guests?.some((g) => g.id === me && g.status === 'declined')
  const pendingForMe = event.guests?.some((g) => g.id === me && g.status === 'pending')
  const meta = [
    withWhom,
    status,
    showDate && format(parseISO(event.date), 'd MMMM EEE', { locale: tr }),
    timeSpan(event),
    !hidden && event.location && `📍 ${event.location}`,
    hidden && 'detaylar gizli',
  ].filter(Boolean)

  return (
    <button
      className={`event-card ${event.shared ? 'is-shared' : ''} ${
        iDeclined ? 'is-declined' : pendingForMe ? 'is-proposed' : event.status && event.status !== 'confirmed' ? `is-${event.status}` : ''
      }`}
      onClick={onClick}
      style={{ '--tag': hidden ? SURPRISE_COLOR : tag.color }}
    >
      <span className="event-emoji">
        {hidden ? '🎁' : event.milestone ? '🥂' : event.busy ? '🔒' : tagEmoji(event.tag, event.relation)}
      </span>
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
