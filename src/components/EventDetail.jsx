import { useState } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { Clock, Gift, Lock, MapPin, Pencil, Repeat, Share2, Users, X } from 'lucide-react'
import { TAGS, UNKNOWN_PERSON, tagEmoji, tagLabel } from '../lib/constants'
import { RELATION_ICONS } from '../lib/icons'
import { genitive, mapsUrl, possessive, repeatLabel, timeSpan } from '../lib/format'
import { dateText, ordinal, t, upper } from '../lib/i18n'
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
  return [
    t(`${coming}/${event.guests.length + 1} geliyor`, `${coming}/${event.guests.length + 1} going`),
    maybes && t(`${maybes} belki`, `${maybes} maybe`),
  ]
    .filter(Boolean)
    .join(' · ')
}

// What the story card says about this plan, from my side of it.
function cardFor(event, me, members, partner) {
  const name = (id) => (members[id] ?? UNKNOWN_PERSON).name
  const when = dateText(event.date, 'd MMMM yyyy', 'MMMM d, yyyy')
  const photoUrl = event.photos?.find((p) => p.url)?.url ?? null

  if (event.milestone) {
    const friends = event.relation === 'friend'
    return {
      emoji: event.title.split(' ')[0],
      label: upper(names([name(me), partner?.name].filter(Boolean))),
      big: ordinal(event.count ?? 0),
      title:
        event.milestone === 'anniversary'
          ? friends
            ? t('arkadaşlık yılımız', 'year of friendship')
            : t('yıldönümümüz', 'anniversary')
          : friends
            ? t('arkadaşlık günümüz', 'day of friendship')
            : t('günümüz', 'day together'),
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
    const forWhom = names(targets.map(name))
    const headline = forMe
      ? t(`${name(event.createdBy)} bana sürpriz hazırladı`, `${name(event.createdBy)} made me a surprise`)
      : event.createdBy === me
        ? t(`${forWhom} için sürpriz hazırladım`, `I made a surprise for ${forWhom}`)
        : t(`${forWhom} için sürpriz hazırladık`, `We made a surprise for ${forWhom}`)
    return { ...base, emoji: '🎁', label: t('SÜRPRİZ', 'SURPRISE'), headline }
  }

  return {
    ...base,
    emoji: tagEmoji(event.tag, event.relation),
    label: upper(tagLabel(event.tag, event.relation)),
    headline: names(people.map(name)),
  }
}

// Where a proposal stands, and the answer buttons when the question is mine.
function ProposalStatus({ event, me, members, onAnswered, onToast }) {
  if (event.status === 'proposed') {
    if (event.awaiting === me) {
      return (
        <div className="status-box is-asking">
          <strong>{t('Bu plan senin yanıtını bekliyor', 'This plan is waiting for your answer')}</strong>
          {event.responseNote && <em>“{event.responseNote}”</em>}
          <ProposalActions event={event} onAnswered={onAnswered} onToast={onToast} />
        </div>
      )
    }
    return (
      <div className="status-box">
        {t(
          `${(members[event.awaiting] ?? UNKNOWN_PERSON).name} henüz yanıt vermedi.`,
          `${(members[event.awaiting] ?? UNKNOWN_PERSON).name} hasn’t answered yet.`,
        )}
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
          {t(`${by.name} o zaman uygun değil.`, `${by.name} isn’t free then.`)}
          {event.responseNote && <em> “{event.responseNote}”</em>}
        </span>
        {event.createdBy === me && <small>{t('Düzenleyip başka bir zaman sorabilirsin.', 'You can edit it and ask about another time.')}</small>}
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
          <button className="icon-btn" onClick={onShare} aria-label={t('Hikâyende paylaş', 'Share to your story')}>
            <Share2 size={17} aria-hidden="true" />
          </button>
        )}
        {onEdit && (
          <button className="icon-btn" onClick={onEdit} aria-label={t('Düzenle', 'Edit')}>
            <Pencil size={17} aria-hidden="true" />
          </button>
        )}
        <button className="icon-btn" onClick={onClose} aria-label={t('Kapat', 'Close')}>
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
  onPlanBirthday, // (personId, date) => opens a surprise plan for that birthday
  onShowWishes, // (personId) => their wish list
  readOnly = false, // nobody pays for this connection: plans stay, nothing new can be added
  onPaywall,
}) {
  const [sharing, setSharing] = useState(null)
  const status = <ProposalStatus event={event} me={me} members={members} onAnswered={onAnswered} onToast={onToast} />
  const when = [dateText(event.date, 'd MMMM yyyy, EEEE', 'EEEE, MMMM d, yyyy'), timeSpan(event)]
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
        <DetailHead label={`${possessive(owner.name)} ${t('takvimi', 'calendar')}`} color="var(--muted)" Icon={Lock} onClose={onClose} />
        <h3>{event.busy ? t(`${owner.name} dolu`, `${owner.name} is busy`) : event.title}</h3>
        <ul className="info-rows">
          <li>
            <Clock size={17} aria-hidden="true" />
            <span>{when}</span>
          </li>
        </ul>
        <p className="hint">
          {event.busy
            ? t('Sadece dolu olduğu görünür.', 'You only see that they’re busy.')
            : t('Sadece plan adı ve saati görünür.', 'You only see the plan’s name and time.')}
        </p>
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
                title: t(`${genitive(owner.name)} ile`, `With ${owner.name}`),
                hint: t(`Sadece ${owner.name} okur.`, `Only ${owner.name} can read this.`),
                placeholder: t(`${owner.name} için yaz…`, `Write to ${owner.name}…`),
              }
            : {
                title: t('Bu plan hakkında', 'About this plan'),
                hint: t(`${owner.name} ve takvimini görenler okur.`, `${owner.name} and the people who see their calendar can read this.`),
                placeholder: t('Bir şey yaz…', 'Write something…'),
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
        <p className="reveal">
          {t(
            'Birlikte olduğunuz günden hesaplandı. Ayarlar’dan değiştirebilirsin.',
            'Counted from the day you got together. You can change it in Settings.',
          )}
        </p>
        <button className="btn btn-primary" onClick={onClose}>
          {t('Nice nicelerine', 'Here’s to many more')}
        </button>
        <button className="btn btn-secondary" onClick={share}>
          <Share2 size={16} aria-hidden="true" /> {t('Hikâyende paylaş', 'Share to your story')}
        </button>
      </div>
    )
  }

  // Someone's birthday (or mine): time to plan something, or to look at their wish list.
  if (event.birthday) {
    const mine = event.birthday === me
    const person = members[event.birthday] ?? UNKNOWN_PERSON
    const days = differenceInCalendarDays(parseISO(event.date), new Date())
    return (
      <div className="detail detail-surprise">
        <div className="gift">🎂</div>
        <h3>{mine ? t('Doğum günün', 'Your birthday') : `${possessive(person.name)} ${t('doğum günü', 'birthday')}`}</h3>
        <p className="when">{dateText(event.date, 'd MMMM yyyy, EEEE', 'EEEE, MMMM d, yyyy')}</p>
        <p className="reveal">
          {days === 0
            ? t('Bugün!', 'Today!')
            : days > 0
              ? t(`${days} gün kaldı.`, days === 1 ? '1 day to go.' : `${days} days to go.`)
              : t('Geçti.', 'It’s passed.')}
          {!mine && t(' Sana bir ay önceden hatırlatırız, ona söylemeyiz.', ' We’ll remind you a month before and never tell them.')}
        </p>
        {mine ? (
          <button className="btn btn-primary" onClick={() => onShowWishes(me)}>
            {t('Dilek listeni güncelle', 'Update your wish list')}
          </button>
        ) : (
          <>
            <button className="btn btn-primary" onClick={() => onPlanBirthday(person.id, event.date)}>
              <Gift size={17} aria-hidden="true" /> {t('Sürpriz planla', 'Plan a surprise')}
            </button>
            <button className="btn btn-secondary" onClick={() => onShowWishes(person.id)}>
              {t('Dileklerine bak', 'See their wishes')}
            </button>
          </>
        )}
        <button className="link-btn" onClick={onClose}>
          {t('Kapat', 'Close')}
        </button>
      </div>
    )
  }

  if (event.locked) {
    const days = differenceInCalendarDays(parseISO(event.revealOn || event.date), new Date())
    return (
      <div className="detail detail-surprise">
        <div className="gift">🎁</div>
        <h3>{t('Sürpriz!', 'Surprise!')}</h3>
        <p className="teaser">“{event.teaser}”</p>
        <p className="when">{when}</p>
        {status}
        {event.photos.length > 0 && <PhotoGallery photos={event.photos} />}
        <p className="reveal">
          {t(
            <>
              {author.name} bir şeyler hazırlıyor… Açılmasına <strong>{days} gün</strong> var.
            </>,
            <>
              {author.name} is up to something… It opens in <strong>{days === 1 ? '1 day' : `${days} days`}</strong>.
            </>,
          )}
        </p>
        {event.guests && (
          <div className="status-box">
            <strong>{t('O gün boş musun?', 'Are you free that day?')}</strong>
            <InvitationActions event={event} me={me} onAnswered={onAnswered} onToast={onToast} />
          </div>
        )}
        <button className="btn btn-primary" onClick={onClose}>
          {t('Sabırsızlanıyorum', 'Can’t wait!')}
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
            <span>{t(`${partner.name} ile`, `With ${partner.name}`)}</span>
          </li>
        )}
        {event.location && (
          <li>
            <MapPin size={17} aria-hidden="true" />
            <a className="place" href={mapsUrl(event.location)} target="_blank" rel="noreferrer">
              {event.location} <span>{t('Haritada aç', 'Open in Maps')}</span>
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
      {!event.guests && <p className="author">{t(`${author.name} ekledi`, `Added by ${author.name}`)}</p>}
      {status}
      {event.guests && (
        <div className="status-box guests-box">
          <div className="box-head">
            <strong>{t('Davetliler', 'Guests')}</strong>
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
          {t(
            `${event.hiddenFrom.map((id) => (members[id] ?? UNKNOWN_PERSON).name).join(', ')} için sürpriz. Şimdilik sadece “${event.teaser}” ipucunu görüyorlar; bu sohbeti göremezler. Detaylar ${dateText(event.revealOn || event.date, 'd MMMM', 'MMMM d')} günü açılacak.`,
            `A surprise for ${event.hiddenFrom.map((id) => (members[id] ?? UNKNOWN_PERSON).name).join(', ')}. For now they only see the hint “${event.teaser}” and can’t see this conversation. The details open on ${dateText(event.revealOn || event.date, 'd MMMM', 'MMMM d')}.`,
          )}
        </div>
      )}

      {event.surprise && !event.guests && event.createdBy === me && (
        <div className="surprise-info">
          {t(
            `Bu bir sürpriz. ${(partner ?? UNKNOWN_PERSON).name} şimdilik sadece “${event.teaser}” ipucunu görüyor. Detaylar ${dateText(event.revealOn || event.date, 'd MMMM', 'MMMM d')} günü açılacak.`,
            `This is a surprise. For now ${(partner ?? UNKNOWN_PERSON).name} only sees the hint “${event.teaser}”. The details open on ${dateText(event.revealOn || event.date, 'd MMMM', 'MMMM d')}.`,
          )}
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
        readOnly={readOnly}
        onPaywall={onPaywall}
        onToast={onToast}
      />
    </div>
  )
}
