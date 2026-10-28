import { useState } from 'react'
import { MONTHS, daysInMonth } from '../lib/birthdays'

// Day and month only. Reports "MM-DD" once both are chosen, '' until then.
export default function BirthdayPicker({ value, onChange, id = 'birthday' }) {
  const [day, setDay] = useState(value ? Number(value.slice(3)) : 0)
  const [month, setMonth] = useState(value ? Number(value.slice(0, 2)) : 0)

  function choose(nextDay, nextMonth) {
    const d = nextMonth ? Math.min(nextDay, daysInMonth(nextMonth)) : nextDay
    setDay(d)
    setMonth(nextMonth)
    onChange(d && nextMonth ? `${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '')
  }

  return (
    <div className="birthday-picker">
      <select
        id={`${id}-day`}
        className="input"
        aria-label="Gün"
        value={day || ''}
        onChange={(e) => choose(Number(e.target.value), month)}
        required
      >
        <option value="">Gün</option>
        {Array.from({ length: month ? daysInMonth(month) : 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        id={`${id}-month`}
        className="input"
        aria-label="Ay"
        value={month || ''}
        onChange={(e) => choose(day, Number(e.target.value))}
        required
      >
        <option value="">Ay</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
    </div>
  )
}
