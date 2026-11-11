import { CalendarClock, Gift } from 'lucide-react'
import { UNKNOWN_PERSON } from '../lib/constants'
import { timeSpan } from '../lib/format'
import { dateText, t } from '../lib/i18n'
import ProposalActions from './ProposalActions'

// A plan waiting for my answer, shown at the top of the home screen.
export default function ProposalCard({ event, me, members, onOpen, onAnswered, onToast }) {
  const other = members[event.partnerId] ?? UNKNOWN_PERSON
  // If I made the plan, the question is back with me because my partner suggested another time.
  const counter = event.createdBy === me
  const when = [dateText(event.seriesDate ?? event.date, 'd MMMM EEEE', 'EEEE, MMMM d'), timeSpan(event)]
    .filter(Boolean)
    .join(' · ')
  const heading = counter
    ? t(`${other.name} başka bir zaman önerdi`, `${other.name} suggested another time`)
    : event.locked
      ? t(`${other.name} seni bir sürpriz için ayırtıyor`, `${other.name} wants to book you for a surprise`)
      : t(`${other.name} soruyor: uygun musun?`, `${other.name} asks: are you free?`)
  const Icon = event.locked ? Gift : CalendarClock

  return (
    <section className="proposal card">
      <button className="proposal-head" onClick={() => onOpen(event)}>
        <span className="notice-icon">
          <Icon size={20} aria-hidden="true" />
        </span>
        <span>
          <small>{heading}</small>
          <strong>{event.locked ? `“${event.teaser}”` : event.title}</strong>
          <span className="proposal-when">{when}</span>
          {event.responseNote && <em className="proposal-note">“{event.responseNote}”</em>}
        </span>
      </button>
      <ProposalActions event={event} onAnswered={onAnswered} onToast={onToast} />
    </section>
  )
}
