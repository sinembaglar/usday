import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { tr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SURPRISE_COLOR, TAGS } from '../lib/constants'

const WEEKDAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']

export default function MonthCalendar({ month, onMonthChange, selected, onSelect, events }) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })

  const byDate = {}
  for (const event of events) (byDate[event.date] ??= []).push(event)

  return (
    <section className="card calendar">
      <div className="calendar-head">
        <button className="icon-btn" onClick={() => onMonthChange(addMonths(month, -1))} aria-label="Önceki ay">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h2>{format(month, 'LLLL yyyy', { locale: tr })}</h2>
        <button className="icon-btn" onClick={() => onMonthChange(addMonths(month, 1))} aria-label="Sonraki ay">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="days">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const dayEvents = byDate[key] ?? []
          const classes = [
            'day',
            !isSameMonth(day, month) && 'is-outside',
            isToday(day) && 'is-today',
            isSameDay(day, selected) && 'is-selected',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button key={key} className={classes} onClick={() => onSelect(day)}>
              <span className="num">{format(day, 'd')}</span>
              <span className="dots">
                {dayEvents.slice(0, 3).map((e) => (
                  <i key={e.id} style={{ background: e.locked ? SURPRISE_COLOR : (TAGS[e.tag] ?? TAGS.plan).color }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
