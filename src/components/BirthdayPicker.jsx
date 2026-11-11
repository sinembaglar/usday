import { useState } from 'react'
import { MONTHS, daysInMonth } from '../lib/birthdays'
import { isEn, t } from '../lib/i18n'

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

  const daySelect = (
    <select
      key="day"
      id={`${id}-day`}
      className="input"
      aria-label={t('Gün', 'Day')}
      value={day || ''}
      onChange={(e) => choose(Number(e.target.value), month)}
      required
    >
      <option value="">{t('Gün', 'Day')}</option>
      {Array.from({ length: month ? daysInMonth(month) : 31 }, (_, i) => i + 1).map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
    </select>
  )

  const monthSelect = (
    <select
      key="month"
      id={`${id}-month`}
      className="input"
      aria-label={t('Ay', 'Month')}
      value={month || ''}
      onChange={(e) => choose(day, Number(e.target.value))}
      required
    >
      <option value="">{t('Ay', 'Month')}</option>
      {MONTHS.map((m, i) => (
        <option key={m} value={i + 1}>
          {m}
        </option>
      ))}
    </select>
  )

  // "21 Mayıs" in Turkish, "May 21" in English.
  return <div className="birthday-picker">{isEn ? [monthSelect, daySelect] : [daySelect, monthSelect]}</div>
}
