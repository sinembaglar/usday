import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
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
      ? `${other.name} bir sürpriz için seni ayırtmak istiyor`
      : `${other.name} bir plan teklif ediyor`

  return (
    <section className="proposal card">
      <button className="proposal-head" onClick={() => onOpen(event)}>
        <span className="notice-emoji">{event.locked ? '🎁' : '📨'}</span>
        <span>
          <small>{heading}</small>
          <strong>{event.locked ? `“${event.teaser}”` : event.title}</strong>
          <span className="proposal-when">{when} — uygun musun?</span>
          {event.responseNote && <em className="proposal-note">“{event.responseNote}”</em>}
        </span>
      </button>
      <ProposalActions event={event} onAnswered={onAnswered} onToast={onToast} />
    </section>
  )
}
