import { useEffect, useRef } from 'react'
import { addDays, format, isSameDay, isToday, startOfWeek } from 'date-fns'
import { tr } from 'date-fns/locale'
import { SURPRISE_COLOR, TAGS } from '../lib/constants'

const HOUR = 44 // px per hour
const HOURS = Array.from({ length: 24 }, (_, h) => h)
const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

// A plan without an end time fills an hour; one that ends after midnight is cut at 24:00.
function minutesOf(event) {
  const start = toMinutes(event.time)
  const end = event.endTime ? toMinutes(event.endTime) : start + 60
  return { start, end: end > start ? Math.min(end, 24 * 60) : 24 * 60 }
}

// Overlapping plans share the column side by side.
function layout(dayEvents) {
  const timed = dayEvents.filter((e) => e.time).sort((a, b) => a.time.localeCompare(b.time))
  const lanes = []
  const placed = timed.map((event) => {
    const { start, end } = minutesOf(event)
    let lane = lanes.findIndex((laneEnd) => laneEnd <= start)
    if (lane === -1) lane = lanes.push(0) - 1
    lanes[lane] = end
    return { event, start, end, lane }
  })
  return placed.map((p) => {
    const overlapping = placed.filter((o) => o.start < p.end && p.start < o.end)
    const columns = Math.max(...overlapping.map((o) => o.lane)) + 1
    return { ...p, columns }
  })
}

const colorOf = (e) => (e.locked ? SURPRISE_COLOR : (TAGS[e.tag] ?? TAGS.plan).color)

export default function WeekView({ selected, onSelect, events, onOpen, onCreate }) {
  const scrollRef = useRef(null)
  const start = startOfWeek(selected, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const keys = days.map((d) => format(d, 'yyyy-MM-dd'))
  const now = new Date()
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR

  // Open the grid at the week's first timed plan (or 08:00 on an empty week).
  const weekKey = keys[0]
  const weekTimes = events.filter((e) => e.time && keys.includes(e.date)).map((e) => toMinutes(e.time))
  const firstMinute = weekTimes.length ? Math.min(...weekTimes) : 8 * 60
  useEffect(() => {
    scrollRef.current.scrollTop = Math.max(0, (firstMinute / 60 - 0.5) * HOUR)
  }, [weekKey, firstMinute])

  const title = `${format(days[0], 'd MMM', { locale: tr })} – ${format(days[6], 'd MMM yyyy', { locale: tr })}`

  function createAt(e, key) {
    if (e.target !== e.currentTarget) return
    const hour = Math.min(23, Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top) / HOUR))
    onCreate(key, `${String(hour).padStart(2, '0')}:00`)
  }

  return (
    <section className="card week">
      <div className="calendar-head">
        <button className="icon-btn" onClick={() => onSelect(addDays(selected, -7))} aria-label="Önceki hafta">
          ‹
        </button>
        <h2 className="week-title">{title}</h2>
        <button className="icon-btn" onClick={() => onSelect(addDays(selected, 7))} aria-label="Sonraki hafta">
          ›
        </button>
      </div>

      <div className="week-row week-days">
        <span />
        {days.map((d) => (
          <button
            key={d}
            className={`week-day ${isToday(d) ? 'is-today' : ''} ${isSameDay(d, selected) ? 'is-selected' : ''}`}
            onClick={() => onSelect(d)}
          >
            <small>{format(d, 'EEEEEE', { locale: tr })}</small>
            <span>{format(d, 'd')}</span>
          </button>
        ))}
      </div>

      <div className="week-row week-allday">
        <small>gün</small>
        {keys.map((key) => (
          <div key={key} className="allday-cell">
            {events
              .filter((e) => e.date === key && !e.time)
              .map((e) => (
                <button key={e.id} className="allday-chip" style={{ '--tag': colorOf(e) }} onClick={() => onOpen(e)}>
                  {e.locked ? '🎁' : e.title}
                </button>
              ))}
          </div>
        ))}
      </div>

      <div className="week-scroll" ref={scrollRef}>
        <div className="week-row week-grid" style={{ height: 24 * HOUR }}>
          <div className="week-hours">
            {HOURS.map((h) => (
              <small key={h} style={{ top: h * HOUR }}>
                {h ? `${String(h).padStart(2, '0')}:00` : ''}
              </small>
            ))}
          </div>
          {keys.map((key, i) => (
            <div key={key} className="week-col" style={{ '--hour': `${HOUR}px` }} onClick={(e) => createAt(e, key)}>
              {isToday(days[i]) && <span className="now-line" style={{ top: nowTop }} />}
              {layout(events.filter((e) => e.date === key)).map(({ event, start, end, lane, columns }) => (
                <button
                  key={event.id}
                  className="week-event"
                  style={{
                    '--tag': colorOf(event),
                    top: (start / 60) * HOUR,
                    height: Math.max(((end - start) / 60) * HOUR - 3, 22),
                    left: `${(lane / columns) * 100}%`,
                    width: `calc(${100 / columns}% - 2px)`,
                  }}
                  onClick={() => onOpen(event)}
                >
                  <b>{event.time}</b>
                  <span>{event.locked ? '🎁 Sürpriz' : event.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
