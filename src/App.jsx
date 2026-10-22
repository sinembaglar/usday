import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, startOfMonth } from 'date-fns'
import { tr } from 'date-fns/locale'
import Cover from './components/Cover'
import MonthCalendar from './components/MonthCalendar'
import EventCard from './components/EventCard'
import Sheet from './components/Sheet'
import EventForm from './components/EventForm'
import EventDetail from './components/EventDetail'
import { USERS, otherUser } from './lib/constants'
import { usePersistentState } from './lib/storage'
import { seedEvents } from './data/seed'

const byDateTime = (a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`)

export default function App() {
  const [events, setEvents] = usePersistentState('usday:events', seedEvents)
  const [cover, setCover] = usePersistentState('usday:cover', null)
  const [viewer, setViewer] = useState('me')
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => new Date())
  const [sheet, setSheet] = useState(null) // { type: 'form' | 'detail', event? }
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(id)
  }, [toast])

  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const selectedKey = format(selected, 'yyyy-MM-dd')
  const sorted = useMemo(() => [...events].sort(byDateTime), [events])
  const dayEvents = sorted.filter((e) => e.date === selectedKey)
  const upcoming = sorted.filter((e) => e.date >= todayKey && e.date !== selectedKey).slice(0, 4)
  const nextDate = sorted.find((e) => e.date >= todayKey && (e.tag === 'date' || e.surprise))

  function selectDay(day) {
    setSelected(day)
    setMonth(startOfMonth(day))
  }

  function handleSave(data) {
    if (data.id) {
      setEvents((list) => list.map((e) => (e.id === data.id ? data : e)))
    } else {
      const event = { ...data, id: crypto.randomUUID(), createdBy: viewer }
      setEvents((list) => [...list, event])
      const to = otherUser(viewer).dative
      setToast(event.surprise ? `🎁 ${to} sadece ipucu gitti` : `💌 ${to} bildirim gönderildi`)
    }
    setSheet(null)
    selectDay(parseISO(data.date))
  }

  function handleDelete(id) {
    setEvents((list) => list.filter((e) => e.id !== id))
    setSheet(null)
  }

  const openDetail = (event) => setSheet({ type: 'detail', event })

  return (
    <div className="app">
      <Cover photo={cover} onPhoto={setCover} nextEvent={nextDate} viewer={viewer} onOpen={openDetail} />

      <div className="viewer-switch" role="group" aria-label="Kimin gözünden">
        <span>Prototip · kimin gözünden:</span>
        {Object.values(USERS).map((u) => (
          <button key={u.id} className={viewer === u.id ? 'is-active' : ''} onClick={() => setViewer(u.id)}>
            {u.name}
          </button>
        ))}
      </div>

      <main className="content">
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          selected={selected}
          onSelect={selectDay}
          events={events}
          viewer={viewer}
        />

        <section className="agenda">
          <h2 className="section-title">{format(selected, 'd MMMM, EEEE', { locale: tr })}</h2>
          {dayEvents.length ? (
            <div className="event-list">
              {dayEvents.map((e) => (
                <EventCard key={e.id} event={e} viewer={viewer} onClick={() => openDetail(e)} />
              ))}
            </div>
          ) : (
            <button className="empty" onClick={() => setSheet({ type: 'form' })}>
              Bu gün boş. Bir plan ekleyelim mi? ✨
            </button>
          )}
        </section>

        {upcoming.length > 0 && (
          <section className="agenda">
            <h2 className="section-title">Yaklaşanlar</h2>
            <div className="event-list">
              {upcoming.map((e) => (
                <EventCard key={e.id} event={e} viewer={viewer} showDate onClick={() => openDetail(e)} />
              ))}
            </div>
          </section>
        )}
      </main>

      <button className="fab" onClick={() => setSheet({ type: 'form' })} aria-label="Plan ekle">
        +
      </button>

      {sheet && (
        <Sheet onClose={() => setSheet(null)}>
          {sheet.type === 'form' ? (
            <EventForm
              initial={sheet.event}
              defaultDate={selectedKey}
              onSave={handleSave}
              onDelete={sheet.event ? () => handleDelete(sheet.event.id) : null}
              onCancel={() => setSheet(null)}
            />
          ) : (
            <EventDetail
              event={sheet.event}
              viewer={viewer}
              onEdit={() => setSheet({ type: 'form', event: sheet.event })}
              onClose={() => setSheet(null)}
            />
          )}
        </Sheet>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
