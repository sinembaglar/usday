import { expandEvents } from './recurrence'
import { genitive } from './format'
import { UNKNOWN_PERSON } from './constants'
import { t } from './i18n'

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
 * Returns short sentences in the app's language, without repeats.
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
  const label = (e) => (e.locked ? t('🎁 bir sürpriz', 'a 🎁 surprise') : e.busy ? null : `“${e.title}”`)
  const at = (e) => (e.time ? ` (${e.time}${e.endTime ? `–${e.endTime}` : ''})` : t(' (gün boyu)', ' (all day)'))
  const sameDayOnly = (e) => allDay || !e.time

  const out = []
  for (const e of sameDay) {
    if (!e.shared && involves(e, me)) {
      const what = label(e)
      out.push(
        sameDayOnly(e)
          ? t(`O gün ${what ?? 'başka bir'} planın var${at(e)}`, `You already have ${what ?? 'another plan'} that day${at(e)}`)
          : t(`O saatte ${what ?? 'başka bir'} planın var${at(e)}`, `You already have ${what ?? 'another plan'} at that time${at(e)}`),
      )
      continue
    }
    for (const id of inviteeIds) {
      if (id === me || !involves(e, id)) continue
      const name = (members[id] ?? UNKNOWN_PERSON).name
      const what = label(e)
      const when = sameDayOnly(e) ? t('o gün', 'that day') : t('o saatte', 'at that time')
      out.push(
        what
          ? t(`${genitive(name)} ${when} ${what} planı var${at(e)}`, `${name} has ${what} ${when}${at(e)}`)
          : t(`${name} ${when} dolu${at(e)}`, `${name} is busy ${when}${at(e)}`),
      )
    }
  }
  return [...new Set(out)]
}
