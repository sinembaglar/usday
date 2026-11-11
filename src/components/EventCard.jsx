import { MessageCircle, Repeat, Gift } from 'lucide-react'
import { SURPRISE_COLOR, TAGS, UNKNOWN_PERSON } from '../lib/constants'
import { SPECIAL_ICONS, tagIcon } from '../lib/icons'
import { timeSpan } from '../lib/format'
import { dateText, t } from '../lib/i18n'

const US = { name: t('İkiniz', 'You two'), short: '♥', color: 'var(--primary)' }

// What a group plan says about me and the group.
function groupLine(event, me) {
  const mine = event.guests.find((g) => g.id === me)
  const coming = event.guests.filter((g) => g.status === 'accepted').length + 1 // the maker counts
  if (mine?.status === 'pending') return t('yanıtını bekliyor', 'waiting for your answer')
  if (mine?.status === 'declined') return t('katılmıyorsun', 'you’re not going')
  if (mine?.status === 'maybe') return t(`belki dedin · ${coming} kişi geliyor`, `you said maybe · ${coming} going`)
  if (mine?.status === 'suggested') return t('başka zaman önerdin', 'you suggested another time')
  const maybes = event.guests.filter((g) => g.status === 'maybe').length
  const ideas = event.guests.filter((g) => g.status === 'suggested').length
  return [
    t(`${coming}/${event.guests.length + 1} geliyor`, `${coming}/${event.guests.length + 1} going`),
    maybes && t(`${maybes} belki`, `${maybes} maybe`),
    ideas && t(`${ideas} öneri`, ideas === 1 ? '1 new time' : `${ideas} new times`),
  ]
    .filter(Boolean)
    .join(' · ')
}

// The category's icon, or what matters more: a surprise, a birthday, a milestone, busy time on a
// shared calendar.
function EventIcon({ event }) {
  const special = event.locked
    ? 'surprise'
    : event.birthday
      ? 'birthday'
      : event.milestone
        ? 'milestone'
        : event.busy
          ? 'busy'
          : null
  const Icon = special ? SPECIAL_ICONS[special] : tagIcon(event.tag, event.relation)
  return <Icon size={18} strokeWidth={2} />
}

// withWhom: "Ayşe" when plans of several people are shown together.
export default function EventCard({ event, members, onClick, showDate, isNew, withWhom, me }) {
  const hidden = event.locked
  const tag = TAGS[event.tag] ?? TAGS.plan
  const author = event.milestone ? US : (members[event.birthday ?? event.createdBy] ?? UNKNOWN_PERSON)
  const thumb = event.photos[0]
  const status = event.guests
    ? groupLine(event, me)
    : event.status === 'proposed'
      ? t('yanıt bekleniyor', 'waiting for an answer')
      : event.status === 'declined'
        ? t('uygun değil', 'not available')
        : null
  const iDeclined = event.guests?.some((g) => g.id === me && g.status === 'declined')
  const pendingForMe = event.guests?.some((g) => g.id === me && g.status === 'pending')
  const when = [showDate && dateText(event.date, 'd MMMM EEE', 'EEE, MMMM d'), timeSpan(event)]
    .filter(Boolean)
    .join(' · ')
  const about = [withWhom, status, !hidden && event.location, hidden && t('detaylar gizli', 'details hidden')].filter(Boolean).join(' · ')

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
          {hidden ? t('Sürpriz!', 'Surprise!') : event.title}
          {isNew && <span className="new-pill">{t('yeni', 'new')}</span>}
        </strong>
        {when && <small className="event-when">{when}</small>}
        {about && <small>{about}</small>}
      </span>
      {thumb && (
        <span className={`card-thumb ${thumb.url ? '' : 'is-locked'}`}>{thumb.url && <img src={thumb.url} alt="" />}</span>
      )}
      <span className="card-badges">
        {event.repeat && event.repeat !== 'none' && <Repeat size={14} aria-label={t('Tekrarlanıyor', 'Repeats')} />}
        {event.surprise && !hidden && <Gift size={14} aria-label={t('Sürpriz', 'Surprise')} />}
        {event.commentCount > 0 && (
          <span className="comment-count" aria-label={t(`${event.commentCount} yorum`, event.commentCount === 1 ? '1 comment' : `${event.commentCount} comments`)}>
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
