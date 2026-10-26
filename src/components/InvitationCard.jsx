import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { UNKNOWN_PERSON } from '../lib/constants'
import { timeSpan } from '../lib/format'
import { InvitationActions } from './GuestList'

// A group plan I have not answered yet, at the top of the home screen.
export default function InvitationCard({ event, me, members, onOpen, onAnswered, onToast }) {
  const maker = members[event.createdBy] ?? UNKNOWN_PERSON
  const others = event.guests.filter((g) => g.id !== me).map((g) => (members[g.id] ?? UNKNOWN_PERSON).name)
  const when = [format(parseISO(event.date), 'd MMMM EEEE', { locale: tr }), timeSpan(event)].filter(Boolean).join(' · ')

  return (
    <section className="proposal card">
      <button className="proposal-head" onClick={() => onOpen(event)}>
        <span className="notice-emoji">👥</span>
        <span>
          <small>{maker.name} seni bir plana davet ediyor</small>
          <strong>{event.title}</strong>
          <span className="proposal-when">{when}</span>
          {others.length > 0 && <span className="proposal-when">Diğer davetliler: {others.join(', ')}</span>}
        </span>
      </button>
      <InvitationActions event={event} me={me} onAnswered={onAnswered} onToast={onToast} />
    </section>
  )
}
