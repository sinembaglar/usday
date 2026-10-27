import { useState } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Clock, Lock, MapPin, Pencil, Repeat, Share2, Users, X } from 'lucide-react'
import { TAGS, UNKNOWN_PERSON, tagEmoji, tagLabel } from '../lib/constants'
import { RELATION_ICONS } from '../lib/icons'
import { genitive, mapsUrl, repeatLabel, timeSpan } from '../lib/format'
import { ShareThread, ThreadsOnMyPlan } from './ShareThread'
import PhotoGallery from './PhotoGallery'
import Conversation from './Conversation'
import ProposalActions from './ProposalActions'
import { GuestList, InvitationActions } from './GuestList'
import ShareCard from './ShareCard'

const names = (list) =>
  list.length > 1 ? `${list.slice(0, -1).join(', ')} & ${list.at(-1)}` : (list[0] ?? '')

// "3/5 geliyor · 1 belki" above the guest list.
function guestSummary(event) {
  const coming = event.guests.filter((g) => g.status === 'accepted').length + 1 // the maker counts
  const maybes = event.guests.filter((g) => g.status === 'maybe').length
  return [`${coming}/${event.guests.length + 1} geliyor`, maybes && `${maybes} belki`].filter(Boolean).join(' · ')
}

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
          <strong>Bu plan senin yanıtını bekliyor</strong>
          {event.responseNote && <em>“{event.responseNote}”</em>}
          <ProposalActions event={event} onAnswered={onAnswered} onToast={onToast} />
        </div>
      )
    }
    return (
      <div className="status-box">
        {(members[event.awaiting] ?? UNKNOWN_PERSON).name} henüz yanıt vermedi.
        {event.responseNote && <em> “{event.responseNote}”</em>}
      </div>
    )
  }
  if (event.status === 'declined') {
    // The asked person is whoever did not make the plan.
    const by = (event.createdBy === me ? members[event.partnerId] : members[me]) ?? UNKNOWN_PERSON
    return (
      <div className="status-box is-declined">
        <span>
          {by.name} o zaman uygun değil.{event.responseNote && <em> “{event.responseNote}”</em>}
        </span>
        {event.createdBy === me && <small>Düzenleyip başka bir zaman sorabilirsin.</small>}
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

// The top of a plan: its category, and what can be done with it (share, edit, close).
function DetailHead({ label, color, Icon, onShare, onEdit, onClose }) {
  return (
    <div className="detail-head">
      <span className="tag-label" style={{ '--tag': color }}>
        {Icon ? <Icon size={14} aria-hidden="true" /> : <i aria-hidden="true" />}
        {label}
      </span>
      <span className="detail-actions">
        {onShare && (
          <button className="icon-btn" onClick={onShare} aria-label="Hikâyende paylaş">
            <Share2 size={17} aria-hidden="true" />
          </button>
        )}
        {onEdit && (
          <button className="icon-btn" onClick={onEdit} aria-label="Düzenle">
            <Pencil size={17} aria-hidden="true" />
          </button>
        )}
        <button className="icon-btn" onClick={onClose} aria-label="Kapat">
          <X size={18} aria-hidden="true" />
        </button>
      </span>
    </div>
  )
}

export default function EventDetail({
  event,
  focusChat,
  focusAbout, // opened from "X planın hakkında yazdı": that person's side conversation
  me,
  members,
  onEdit,
  onClose,
  onAnswered,
  onToast,
}) {
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

  // A plan from a calendar someone shared with me: only when they are busy (and its name, if shared).
  if (event.shared) {
    const owner = members[event.owner] ?? UNKNOWN_PERSON
    return (
      <div className="detail">
        <DetailHead label={`${genitive(owner.name)} takvimi`} color="var(--muted)" Icon={Lock} onClose={onClose} />
        <h3>{event.busy ? `${owner.name} dolu` : event.title}</h3>
        <ul className="info-rows">
          <li>
            <Clock size={17} aria-hidden="true" />
            <span>{when}</span>
          </li>
        </ul>
        <p className="hint">{event.busy ? 'Sadece dolu olduğu görünür.' : 'Sadece plan adı ve saati görünür.'}</p>
        <ShareThread
          eventId={event.eventId}
          owner={event.owner}
          viewer={me}
          seenAs={event.busy ? me : event.owner}
          mode="viewer"
          me={me}
          members={members}
          focus={focusChat}
          onToast={onToast}
          {...(event.busy
            ? {
                title: `${genitive(owner.name)} ile`,
                hint: `Sadece ${owner.name} okur.`,
                placeholder: `${owner.name} için yaz…`,
              }
            : {
                title: 'Bu plan hakkında',
                hint: `${owner.name} ve takvimini görenler okur.`,
                placeholder: 'Bir şey yaz…',
              })}
        />
      </div>
    )
  }

  if (event.milestone) {
    return (
      <div className="detail detail-surprise">
        <div className="gift">{event.milestone === 'anniversary' ? '💍' : '💜'}</div>
        <h3>{event.title.replace(/^\S+\s/, '')}</h3>
        <p className="when">{when}</p>
        <p className="reveal">Birlikte olduğunuz günden hesaplandı. Ayarlar’dan değiştirebilirsin.</p>
        <button className="btn btn-primary" onClick={onClose}>
          Nice nicelerine
        </button>
        <button className="btn btn-secondary" onClick={share}>
          <Share2 size={16} aria-hidden="true" /> Hikâyende paylaş
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
          Sabırsızlanıyorum
        </button>
      </div>
    )
  }

  const tag = TAGS[event.tag] ?? TAGS.plan
  // Group plans are edited by whoever made them; two-person plans by both (except surprises).
  const canEdit = event.guests ? event.createdBy === me : !event.surprise || event.createdBy === me
  const WithIcon = RELATION_ICONS[event.relation] ?? Users

  return (
    <div className="detail">
      <DetailHead
        label={tagLabel(event.tag, event.relation)}
        color={tag.color}
        onShare={share}
        onEdit={canEdit ? onEdit : null}
        onClose={onClose}
      />
      <h3>{event.title}</h3>
      <ul className="info-rows">
        <li>
          <Clock size={17} aria-hidden="true" />
          <span>{when}</span>
        </li>
        {!event.guests && partner && (
          <li>
            <WithIcon size={17} aria-hidden="true" />
            <span>{partner.name} ile</span>
          </li>
        )}
        {event.location && (
          <li>
            <MapPin size={17} aria-hidden="true" />
            <a className="place" href={mapsUrl(event.location)} target="_blank" rel="noreferrer">
              {event.location} <span>Haritada aç</span>
            </a>
          </li>
        )}
        {repeatLabel(event) && (
          <li>
            <Repeat size={17} aria-hidden="true" />
            <span>{repeatLabel(event)}</span>
          </li>
        )}
      </ul>
      {!event.guests && <p className="author">{author.name} ekledi</p>}
      {status}
      {event.guests && (
        <div className="status-box guests-box">
          <div className="box-head">
            <strong>Davetliler</strong>
            <span>{guestSummary(event)}</span>
          </div>
          <GuestList event={event} members={members} me={me} onMoved={onAnswered} onToast={onToast} />
          <InvitationActions event={event} me={me} onAnswered={onAnswered} onToast={onToast} />
        </div>
      )}
      {event.note && <p className="note">{event.note}</p>}
      {event.photos.length > 0 && <PhotoGallery photos={event.photos} />}

      {event.surprise && event.guests && event.hiddenFrom?.length > 0 && (
        <div className="surprise-info">
          {event.hiddenFrom.map((id) => (members[id] ?? UNKNOWN_PERSON).name).join(', ')} için sürpriz. Şimdilik sadece
          “{event.teaser}” ipucunu görüyorlar; bu sohbeti göremezler. Detaylar{' '}
          {format(parseISO(event.revealOn || event.date), 'd MMMM', { locale: tr })} günü açılacak.
        </div>
      )}

      {event.surprise && !event.guests && event.createdBy === me && (
        <div className="surprise-info">
          Bu bir sürpriz. {(partner ?? UNKNOWN_PERSON).name} şimdilik sadece “{event.teaser}” ipucunu görüyor. Detaylar{' '}
          {format(parseISO(event.revealOn || event.date), 'd MMMM', { locale: tr })} günü açılacak.
        </div>
      )}

      <ThreadsOnMyPlan
        eventId={event.seriesId ?? event.id}
        me={me}
        members={members}
        focusViewer={focusAbout}
        onToast={onToast}
      />

      <Conversation
        eventId={event.seriesId ?? event.id}
        me={me}
        members={members}
        hasPartner={Boolean(partner)}
        listeners={listenersOf(event, me, partner)}
        focus={focusChat}
        onToast={onToast}
      />
    </div>
  )
}
