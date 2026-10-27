import { useState } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { TAGS, UNKNOWN_PERSON, tagEmoji, tagLabel } from '../lib/constants'
import { mapsUrl, repeatLabel, timeSpan } from '../lib/format'
import PhotoGallery from './PhotoGallery'
import Conversation from './Conversation'
import ProposalActions from './ProposalActions'
import { GuestList, InvitationActions } from './GuestList'
import ShareCard from './ShareCard'

const names = (list) =>
  list.length > 1 ? `${list.slice(0, -1).join(', ')} & ${list.at(-1)}` : (list[0] ?? '')

// What the story card says about this plan, from my side of it.
function cardFor(event, me, members, partner) {
  const name = (id) => (members[id] ?? UNKNOWN_PERSON).name
  const when = format(parseISO(event.date), 'd MMMM yyyy', { locale: tr })
  const photoUrl = event.photos?.find((p) => p.url)?.url ?? null

  if (event.milestone) {
    const friends = event.title.includes('Arkadaşlığımızın')
    return {
      emoji: event.title.split(' ')[0],
      label: names([name(me), partner?.name].filter(Boolean)).toLocaleUpperCase('tr'),
      big: `${(event.count ?? '').toLocaleString('tr-TR')}.`,
      title:
        event.milestone === 'anniversary'
          ? friends
            ? 'arkadaşlık yılımız'
            : 'yıldönümümüz'
          : friends
            ? 'arkadaşlık günümüz'
            : 'günümüz',
      when,
    }
  }

  const people = event.guests
    ? [event.createdBy, ...event.guests.filter((g) => g.status !== 'declined').map((g) => g.id)]
    : [me, partner?.id].filter(Boolean)
  const base = { title: event.title, when: [when, timeSpan(event)].filter(Boolean).join(' · '), place: event.location, photoUrl }

  if (event.surprise) {
    const targets = event.guests ? (event.hiddenFrom ?? []) : [event.partnerId ?? partner?.id].filter((id) => id !== event.createdBy)
    const forMe = event.guests ? targets.includes(me) : event.createdBy !== me
    const headline = forMe
      ? `${name(event.createdBy)} bana sürpriz hazırladı`
      : `${names(targets.map(name))} için sürpriz ${event.createdBy === me ? 'hazırladım' : 'hazırladık'}`
    return { ...base, emoji: '🎁', label: 'SÜRPRİZ', headline }
  }

  return {
    ...base,
    emoji: tagEmoji(event.tag, event.relation),
    label: tagLabel(event.tag, event.relation).toLocaleUpperCase('tr'),
    headline: names(people.map(name)),
  }
}

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

// Who gets a notification when I comment: never someone the plan is still a surprise for.
function listenersOf(event, me, partner) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const secret = event.surprise && (event.revealOn || event.date) > today
  if (event.guests) {
    return [event.createdBy, ...event.guests.map((g) => g.id)].filter(
      (id) => id !== me && !(secret && event.hiddenFrom?.includes(id)),
    )
  }
  return partner && !secret ? [partner.id] : []
}

export default function EventDetail({ event, focusChat, me, members, withWhom, onEdit, onClose, onAnswered, onToast }) {
  const [sharing, setSharing] = useState(null)
  const status = <ProposalStatus event={event} me={me} members={members} onAnswered={onAnswered} onToast={onToast} />
  const when = [format(parseISO(event.date), 'd MMMM yyyy, EEEE', { locale: tr }), timeSpan(event)]
    .filter(Boolean)
    .join(' · ')
  const author = members[event.createdBy] ?? UNKNOWN_PERSON
  // The other person in this plan's connection.
  const partner = event.partnerId ? members[event.partnerId] : Object.values(members).find((m) => m.id !== me)

  if (sharing) return <ShareCard card={sharing} onClose={() => setSharing(null)} onToast={onToast} />
  const share = () => setSharing(cardFor(event, me, members, partner))

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
        <button className="link-btn share-link" onClick={share}>
          📸 Hikâyende paylaş
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
        {event.guests && (
          <div className="status-box">
            <strong>O gün boş musun?</strong>
            <InvitationActions event={event} me={me} onAnswered={onAnswered} onToast={onToast} />
          </div>
        )}
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

      {event.surprise && event.guests && event.hiddenFrom?.length > 0 && (
        <div className="surprise-info">
          🤫 {event.hiddenFrom.map((id) => (members[id] ?? UNKNOWN_PERSON).name).join(', ')} için sürpriz. Onlar şimdilik
          sadece şunu görüyor: “{event.teaser}”. Buradaki yorumları göremezler. Detaylar{' '}
          {format(parseISO(event.revealOn || event.date), 'd MMMM', { locale: tr })} günü açılacak.
        </div>
      )}

      {event.surprise && !event.guests && event.createdBy === me && (
        <div className="surprise-info">
          🎁 Bu bir sürpriz. {(partner ?? UNKNOWN_PERSON).name} şimdilik sadece şunu görüyor: “{event.teaser}”.
          Detaylar {format(parseISO(event.revealOn || event.date), 'd MMMM', { locale: tr })} günü açılacak.
        </div>
      )}

      <p className="author">{author.name} ekledi</p>
      <button className="link-btn share-link" onClick={share}>
        📸 Hikâyende paylaş
      </button>

      <Conversation
        eventId={event.seriesId ?? event.id}
        me={me}
        members={members}
        hasPartner={Boolean(partner)}
        listeners={listenersOf(event, me, partner)}
        focus={focusChat}
      />

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
