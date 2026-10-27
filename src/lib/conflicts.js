import { expandEvents } from './recurrence'
import { genitive } from './format'
import { UNKNOWN_PERSON } from './constants'

const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

// A plan without an end lasts two hours; one that ends "earlier" ends after midnight.
function span(e) {
  const start = minutes(e.time)
  let end = e.endTime ? minutes(e.endTime) : start + 120
  if (end <= start) end += 24 * 60
  return [start, end]
}

/**
 * Plans that clash with a plan being made: mine, and those I can see of the people I am inviting
 * (their calendars shared with me included). A plan without a time lasts all day.
 *
 * when: { date, time, endTime }; inviteeIds: the people on the new plan; editingId: the plan being
 * edited (not a clash with itself); events: everything I see (with coupleId / guests / createdBy);
 * sharedPlans: plans from calendars shared with me (owner, busy); partnerOf: coupleId → person id.
 * Returns short Turkish sentences, without repeats.
 */
export function findConflicts({ when, inviteeIds, editingId, events, sharedPlans, partnerOf, members, me }) {
  if (!when.date) return []
  const allDay = !when.time
  const overlaps = (e) => {
    if (allDay || !e.time) return true
    const [a1, a2] = span(when)
    const [b1, b2] = span(e)
    return a1 < b2 && b1 < a2
  }
  const involves = (e, id) =>
    e.shared
      ? e.owner === id
      : e.guests
        ? [e.createdBy, ...e.guests.filter((g) => g.status !== 'declined').map((g) => g.id)].includes(id)
        : id === me || partnerOf(e.coupleId) === id

  const sameDay = expandEvents([...events, ...sharedPlans], when.date, when.date).filter(
    (e) => e.seriesId !== editingId && e.status !== 'declined' && overlaps(e),
  )
  const label = (e) => (e.locked ? '🎁 bir sürpriz' : e.busy ? null : `“${e.title}”`)
  const at = (e) => (e.time ? ` (${e.time}${e.endTime ? `–${e.endTime}` : ''})` : ' (gün boyu)')
  const when_ = (e) => (allDay || !e.time ? 'o gün' : 'o saatte')

  const out = []
  for (const e of sameDay) {
    if (!e.shared && involves(e, me)) {
      const what = label(e)
      const text = `${what ?? 'başka bir'} planın var${at(e)}`
      out.push(`${when_(e) === 'o gün' ? 'O gün' : 'O saatte'} ${text}`)
      continue
    }
    for (const id of inviteeIds) {
      if (id === me || !involves(e, id)) continue
      const name = (members[id] ?? UNKNOWN_PERSON).name
      const what = label(e)
      out.push(what ? `${genitive(name)} ${when_(e)} ${what} planı var${at(e)}` : `${name} ${when_(e)} dolu${at(e)}`)
    }
  }
  return [...new Set(out)]
}
