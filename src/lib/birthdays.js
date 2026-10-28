// Birthdays are kept as day and month ("MM-DD"); the year is never stored.

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

// The date a birthday falls on in a given year; 29 February moves to the 28th in other years.
export const birthdayIn = (mmdd, year) => `${year}-${mmdd === '02-29' && !isLeap(year) ? '02-28' : mmdd}`

// The next birthday on or after the given day.
export function nextBirthday(mmdd, todayKey) {
  const year = Number(todayKey.slice(0, 4))
  const thisYear = birthdayIn(mmdd, year)
  return thisYear >= todayKey ? thisYear : birthdayIn(mmdd, year + 1)
}

export const daysUntil = (fromKey, toKey) =>
  Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000)

// Every birthday between two days (both included).
export function birthdaysBetween(mmdd, from, to) {
  if (!mmdd) return []
  const list = []
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    const date = birthdayIn(mmdd, y)
    if (date >= from && date <= to) list.push(date)
  }
  return list
}

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

// 29 February is allowed (it exists in 2000, the year birthdays are stored with).
export const daysInMonth = (month) => [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]

export const formatBirthday = (mmdd) => `${Number(mmdd.slice(3))} ${MONTHS[Number(mmdd.slice(0, 2)) - 1]}`
