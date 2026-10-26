// Shared rules for repeating plans and couple milestones.
// The server keeps an identical copy in supabase/functions/_shared/recurrence.ts.

export const REPEATS = {
  none: 'Tekrarlanmaz',
  daily: 'Her gün',
  weekly: 'Her hafta',
  monthly: 'Her ay',
  yearly: 'Her yıl',
}

const MS_DAY = 86_400_000
const parse = (key) => new Date(`${key}T00:00:00Z`)
const keyOf = (d) => d.toISOString().slice(0, 10)
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

export const addDaysKey = (key, n) => keyOf(new Date(parse(key).getTime() + n * MS_DAY))

// Same day-of-month (or the month's last day when it is shorter), k months later.
function addMonthsKey(key, k) {
  const d = parse(key)
  const total = d.getUTCMonth() + k
  const y = d.getUTCFullYear() + Math.floor(total / 12)
  const m = ((total % 12) + 12) % 12
  return keyOf(new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), daysInMonth(y, m)))))
}

function step(key, repeat, k) {
  if (repeat === 'daily') return addDaysKey(key, k)
  if (repeat === 'weekly') return addDaysKey(key, 7 * k)
  if (repeat === 'monthly') return addMonthsKey(key, k)
  return addMonthsKey(key, 12 * k)
}

// Every date (YYYY-MM-DD) in [from, to] on which the plan takes place.
export function occurrences(event, from, to) {
  if (!event.repeat || event.repeat === 'none') {
    return event.date >= from && event.date <= to ? [event.date] : []
  }
  const last = event.repeatUntil && event.repeatUntil < to ? event.repeatUntil : to
  const skip = new Set(event.skipDates ?? [])
  const dates = []
  for (let k = 0; k < 4000; k++) {
    const date = step(event.date, event.repeat, k)
    if (date > last) break
    if (date >= from && !skip.has(date)) dates.push(date)
  }
  return dates
}

// One entry per occurrence. id is unique per day; seriesId is the row in the database.
export function expandEvents(events, from, to) {
  return events.flatMap((e) =>
    occurrences(e, from, to).map((date) => ({
      ...e,
      id: e.repeat && e.repeat !== 'none' ? `${e.id}@${date}` : e.id,
      seriesId: e.id,
      seriesDate: e.date,
      date,
    })),
  )
}

const DAY_MILESTONES = [100, 200, 300, 400, 500]
for (let n = 1000; n <= 20000; n += 500) DAY_MILESTONES.push(n)

// "Together since" turns into anniversaries and day-count milestones (day 1 is the first day).
export function milestones(since, from, to) {
  if (!since) return []
  const list = []
  for (let years = 1; years <= 80; years++) {
    const date = addMonthsKey(since, 12 * years)
    if (date > to) break
    if (date >= from) list.push({ date, kind: 'anniversary', count: years, title: `💍 ${years}. yıldönümümüz` })
  }
  for (const n of DAY_MILESTONES) {
    const date = addDaysKey(since, n - 1)
    if (date > to) break
    if (date >= from) list.push({ date, kind: 'days', count: n, title: `💜 Birlikte ${n.toLocaleString('tr-TR')}. günümüz` })
  }
  return list
}

export function dayNumber(since, todayKey) {
  return Math.round((parse(todayKey) - parse(since)) / MS_DAY) + 1
}
