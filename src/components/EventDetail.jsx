import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { TAGS, UNKNOWN_PERSON } from '../lib/constants'
import { mapsUrl, repeatLabel, timeSpan } from '../lib/format'
import PhotoGallery from './PhotoGallery'
import Conversation from './Conversation'

export default function EventDetail({ event, me, members, onEdit, onClose }) {
  const when = [format(parseISO(event.date), 'd MMMM yyyy, EEEE', { locale: tr }), timeSpan(event)]
    .filter(Boolean)
    .join(' · ')
  const author = members[event.createdBy] ?? UNKNOWN_PERSON
  const partner = Object.values(members).find((m) => m.id !== me)

  if (event.milestone) {
    return (
      <div className="detail detail-surprise">
        <div className="gift">{event.milestone === 'anniversary' ? '💍' : '💜'}</div>
        <h3>{event.title.replace(/^\S+\s/, '')}</h3>
        <p className="when">{when}</p>
        <p className="reveal">Birlikte olduğunuz günden hesaplandı. Ayarlar’dan değiştirebilirsin.</p>
        <button className="btn btn-primary" onClick={onClose}>
          Nice nicelerine 🥂
        </button>
      </div>
    )
  }

  if (event.locked) {
    const days = differenceInCalendarDays(parseISO(event.revealOn || event.date), new Date())
    return (
      <div className="detail detail-surprise">
        <div className="gift">🎁</div>
        <h3>Sürpriz!</h3>
        <p className="teaser">“{event.teaser}”</p>
        <p className="when">{when}</p>
        {event.photos.length > 0 && <PhotoGallery photos={event.photos} />}
        <p className="reveal">
          {author.name} bir şeyler hazırlıyor… Açılmasına <strong>{days} gün</strong> var.
        </p>
        <button className="btn btn-primary" onClick={onClose}>
          Sabırsızlanıyorum 💕
        </button>
      </div>
    )
  }

  const tag = TAGS[event.tag] ?? TAGS.plan
  const canEdit = !event.surprise || event.createdBy === me

  return (
    <div className="detail">
      <span className="chip is-active" style={{ '--tag': tag.color }}>
        {tag.emoji} {tag.label}
      </span>
      <h3>{event.title}</h3>
      <p className="when">{when}</p>
      {repeatLabel(event) && <p className="meta-line">{repeatLabel(event)}</p>}
      {event.location && (
        <a className="meta-line place" href={mapsUrl(event.location)} target="_blank" rel="noreferrer">
          📍 {event.location} <span>Haritada aç ›</span>
        </a>
      )}
      {event.note && <p className="note">{event.note}</p>}
      {event.photos.length > 0 && <PhotoGallery photos={event.photos} />}

      {event.surprise && event.createdBy === me && (
        <div className="surprise-info">
          🎁 Bu bir sürpriz. {(partner ?? UNKNOWN_PERSON).name} şimdilik sadece şunu görüyor: “{event.teaser}”.
          Detaylar {format(parseISO(event.revealOn || event.date), 'd MMMM', { locale: tr })} günü açılacak.
        </div>
      )}

      <p className="author">{author.name} ekledi</p>

      <Conversation eventId={event.seriesId ?? event.id} me={me} members={members} hasPartner={Boolean(partner)} />

      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Kapat
        </button>
        {canEdit && (
          <button className="btn btn-primary" onClick={onEdit}>
            Düzenle
          </button>
        )}
      </div>
    </div>
  )
}
