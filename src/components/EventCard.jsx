import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { MessageCircle, Repeat, Gift } from 'lucide-react'
import { SURPRISE_COLOR, TAGS, UNKNOWN_PERSON } from '../lib/constants'
import { SPECIAL_ICONS, tagIcon } from '../lib/icons'
import { timeSpan } from '../lib/format'

const US = { name: 'İkiniz', short: '♥', color: 'var(--primary)' }

// What a group plan says about me and the group.
function groupLine(event, me) {
  const mine = event.guests.find((g) => g.id === me)
  const coming = event.guests.filter((g) => g.status === 'accepted').length + 1 // the maker counts
  if (mine?.status === 'pending') return 'yanıtını bekliyor'
  if (mine?.status === 'declined') return 'katılmıyorsun'
  if (mine?.status === 'maybe') return `belki dedin · ${coming} kişi geliyor`
  if (mine?.status === 'suggested') return 'başka zaman önerdin'
  const maybes = event.guests.filter((g) => g.status === 'maybe').length
  const ideas = event.guests.filter((g) => g.status === 'suggested').length
  return [`${coming}/${event.guests.length + 1} geliyor`, maybes && `${maybes} belki`, ideas && `${ideas} öneri`]
    .filter(Boolean)
    .join(' · ')
}

// The category's icon, or what matters more: a surprise, a milestone, busy time on a shared calendar.
function EventIcon({ event }) {
  const Icon = event.locked
    ? SPECIAL_ICONS.surprise
    : event.milestone
      ? SPECIAL_ICONS.milestone
      : event.busy
        ? SPECIAL_ICONS.busy
        : tagIcon(event.tag, event.relation)
  return <Icon size={18} strokeWidth={2} />
}

// withWhom: "Ayşe" when plans of several people are shown together.
export default function EventCard({ event, members, onClick, showDate, isNew, withWhom, me }) {
  const hidden = event.locked
  const tag = TAGS[event.tag] ?? TAGS.plan
  const author = event.milestone ? US : (members[event.createdBy] ?? UNKNOWN_PERSON)
  const thumb = event.photos[0]
  const status = event.guests
    ? groupLine(event, me)
    : event.status === 'proposed'
      ? 'yanıt bekleniyor'
      : event.status === 'declined'
        ? 'uygun değil'
        : null
  const iDeclined = event.guests?.some((g) => g.id === me && g.status === 'declined')
  const pendingForMe = event.guests?.some((g) => g.id === me && g.status === 'pending')
  const when = [showDate && format(parseISO(event.date), 'd MMMM EEE', { locale: tr }), timeSpan(event)]
    .filter(Boolean)
    .join(' · ')
  const about = [withWhom, status, !hidden && event.location, hidden && 'detaylar gizli'].filter(Boolean).join(' · ')

  return (
    <button
      className={`event-card ${event.shared ? 'is-shared' : ''} ${
        iDeclined ? 'is-declined' : pendingForMe ? 'is-proposed' : event.status && event.status !== 'confirmed' ? `is-${event.status}` : ''
      }`}
      onClick={onClick}
      style={{ '--tag': hidden ? SURPRISE_COLOR : tag.color }}
    >
      <span className="event-icon" aria-hidden="true">
        <EventIcon event={event} />
      </span>
      <span className="event-body">
        <strong>
          {hidden ? 'Sürpriz!' : event.title}
          {isNew && <span className="new-pill">yeni</span>}
        </strong>
        {when && <small className="event-when">{when}</small>}
        {about && <small>{about}</small>}
      </span>
      {thumb && (
        <span className={`card-thumb ${thumb.url ? '' : 'is-locked'}`}>{thumb.url && <img src={thumb.url} alt="" />}</span>
      )}
      <span className="card-badges">
        {event.repeat && event.repeat !== 'none' && <Repeat size={14} aria-label="Tekrarlanıyor" />}
        {event.surprise && !hidden && <Gift size={14} aria-label="Sürpriz" />}
        {event.commentCount > 0 && (
          <span className="comment-count" aria-label={`${event.commentCount} yorum`}>
            <MessageCircle size={14} aria-hidden="true" /> {event.commentCount}
          </span>
        )}
      </span>
      <span className="avatar" style={{ background: author.color }} title={author.name}>
        {author.short}
      </span>
    </button>
  )
}
