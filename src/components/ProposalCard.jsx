import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { CalendarClock, Gift } from 'lucide-react'
import { UNKNOWN_PERSON } from '../lib/constants'
import { timeSpan } from '../lib/format'
import ProposalActions from './ProposalActions'

// A plan waiting for my answer, shown at the top of the home screen.
export default function ProposalCard({ event, me, members, onOpen, onAnswered, onToast }) {
  const other = members[event.partnerId] ?? UNKNOWN_PERSON
  // If I made the plan, the question is back with me because my partner suggested another time.
  const counter = event.createdBy === me
  const when = [format(parseISO(event.seriesDate ?? event.date), 'd MMMM EEEE', { locale: tr }), timeSpan(event)]
    .filter(Boolean)
    .join(' · ')
  const heading = counter
    ? `${other.name} başka bir zaman önerdi`
    : event.locked
      ? `${other.name} seni bir sürpriz için ayırtıyor`
      : `${other.name} soruyor: uygun musun?`
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
