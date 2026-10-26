import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { TAGS, UNKNOWN_PERSON, tagEmoji, tagLabel } from '../lib/constants'
import { mapsUrl, repeatLabel, timeSpan } from '../lib/format'
import PhotoGallery from './PhotoGallery'
import Conversation from './Conversation'
import ProposalActions from './ProposalActions'
import { GuestList, InvitationActions } from './GuestList'

// Where a proposal stands, and the answer buttons when the question is mine.
function ProposalStatus({ event, me, members, onAnswered, onToast }) {
  if (event.status === 'proposed') {
    if (event.awaiting === me) {
      return (
        <div className="status-box is-asking">
          <strong>📨 Bu plan senin yanıtını bekliyor</strong>
          {event.responseNote && <em>“{event.responseNote}”</em>}
          <ProposalActions event={event} onAnswered={onAnswered} onToast={onToast} />
        </div>
      )
    }
    return (
      <div className="status-box">
        ⏳ {(members[event.awaiting] ?? UNKNOWN_PERSON).name} henüz yanıt vermedi.
        {event.responseNote && <em> “{event.responseNote}”</em>}
      </div>
    )
  }
  if (event.status === 'declined') {
    // The asked person is whoever did not make the plan.
    const by = (event.createdBy === me ? members[event.partnerId] : members[me]) ?? UNKNOWN_PERSON
    return (
      <div className="status-box is-declined">
        ❌ {by.name} o zaman uygun değil.{event.responseNote && <em> “{event.responseNote}”</em>}
        {event.createdBy === me && <small>“Düzenle”den başka bir zaman seçip tekrar sorabilirsin.</small>}
      </div>
    )
  }
  return null
}

export default function EventDetail({ event, me, members, withWhom, onEdit, onClose, onAnswered, onToast }) {
  const status = <ProposalStatus event={event} me={me} members={members} onAnswered={onAnswered} onToast={onToast} />
  const when = [format(parseISO(event.date), 'd MMMM yyyy, EEEE', { locale: tr }), timeSpan(event)]
    .filter(Boolean)
    .join(' · ')
  const author = members[event.createdBy] ?? UNKNOWN_PERSON
  // The other person in this plan's connection.
  const partner = event.partnerId ? members[event.partnerId] : Object.values(members).find((m) => m.id !== me)

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
        {status}
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
  // Group plans are edited by whoever made them; two-person plans by both (except surprises).
  const canEdit = event.guests ? event.createdBy === me : !event.surprise || event.createdBy === me

  return (
    <div className="detail">
      <span className="chip is-active" style={{ '--tag': tag.color }}>
        {tagEmoji(event.tag, event.relation)} {tagLabel(event.tag, event.relation)}
      </span>
      <h3>{event.title}</h3>
      <p className="when">{when}</p>
      {withWhom && !event.guests && <p className="meta-line">{withWhom} ile</p>}
      {status}
      {event.guests && (
        <div className="status-box">
          <strong>👥 Davetliler</strong>
          <GuestList event={event} members={members} />
          <InvitationActions event={event} me={me} onAnswered={onAnswered} onToast={onToast} />
        </div>
      )}
      {repeatLabel(event) &&<p className="meta-line">{repeatLabel(event)}</p>}
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
