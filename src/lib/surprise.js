import { format } from 'date-fns'

// A surprise stays hidden from the partner until its reveal day.
// The person who created it always sees the full details.
export function isHiddenFor(event, viewer, today = new Date()) {
  if (!event.surprise || event.createdBy === viewer) return false
  return format(today, 'yyyy-MM-dd') < (event.revealOn || event.date)
}
