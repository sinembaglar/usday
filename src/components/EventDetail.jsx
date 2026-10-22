import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { TAGS, USERS, otherUser } from '../lib/constants'
import { isHiddenFor } from '../lib/surprise'
import PhotoGallery from './PhotoGallery'

export default function EventDetail({ event, viewer, onEdit, onClose }) {
  const when = [format(parseISO(event.date), 'd MMMM yyyy, EEEE', { locale: tr }), event.time].filter(Boolean).join(' · ')

  if (isHiddenFor(event, viewer)) {
    const days = differenceInCalendarDays(parseISO(event.revealOn || event.date), new Date())
    return (
      <div className="detail detail-surprise">
        <div className="gift">🎁</div>
        <h3>Sürpriz!</h3>
        <p className="teaser">“{event.teaser}”</p>
        <p className="when">{when}</p>
        {event.photos?.length > 0 && <PhotoGallery photos={event.photos} locked={event.blurPhotos} />}
        <p className="reveal">
          {USERS[event.createdBy].name} bir şeyler hazırlıyor… Açılmasına <strong>{days} gün</strong> var.
        </p>
        <button className="btn btn-primary" onClick={onClose}>
          Sabırsızlanıyorum 💕
        </button>
      </div>
    )
  }

  const tag = TAGS[event.tag]
  const canEdit = !event.surprise || event.createdBy === viewer

  return (
    <div className="detail">
      <span className="chip is-active" style={{ '--tag': tag.color }}>
        {tag.emoji} {tag.label}
      </span>
      <h3>{event.title}</h3>
      <p className="when">{when}</p>
      {event.note && <p className="note">{event.note}</p>}
      {event.photos?.length > 0 && <PhotoGallery photos={event.photos} />}

      {event.surprise && event.createdBy === viewer && (
        <div className="surprise-info">
          🎁 Bu bir sürpriz. {otherUser(viewer).name} şimdilik sadece şunu görüyor: “{event.teaser}”. Detaylar{' '}
          {format(parseISO(event.revealOn || event.date), 'd MMMM', { locale: tr })} günü açılacak.
        </div>
      )}

      <p className="author">{USERS[event.createdBy].name} ekledi</p>

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
