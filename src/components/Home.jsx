import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO, startOfMonth } from 'date-fns'
import { tr } from 'date-fns/locale'
import Cover from './Cover'
import MonthCalendar from './MonthCalendar'
import WeekView from './WeekView'
import EventCard from './EventCard'
import Sheet from './Sheet'
import EventForm from './EventForm'
import EventDetail from './EventDetail'
import SettingsSheet from './SettingsSheet'
import { supabase } from '../lib/supabase'
import { deleteEvent, loadEverything, markSeen, saveEvent, setCover } from '../lib/api'
import { TEMPLATES } from '../lib/constants'
import InviteCard from './InviteCard'
import NotificationCard from './NotificationCard'
import { notifyPartner } from '../lib/push'

const byDateTime = (a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`)

const VIEW_KEY = 'usday:view'
function savedView() {
  try {
    return localStorage.getItem(VIEW_KEY) ?? 'month'
  } catch {
    return 'month'
  }
}

export default function Home({ userId }) {
  const [couple, setCouple] = useState(null)
  const [members, setMembers] = useState({})
  const [events, setEvents] = useState([])
  const [seenAt, setSeenAt] = useState(null) // last visit before this one: newer partner plans get a "yeni" pill
  const [view, setView] = useState(savedView)
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => new Date())
  const [sheet, setSheet] = useState(null) // { type: 'form' | 'detail' | 'settings', event?, preset? }
  const [toast, setToast] = useState(null)

  // Opening the app (or coming back to it) counts as seeing everything: clears the icon badge.
  const reload = useCallback(
    async ({ markAsSeen = false } = {}) => {
      try {
        const data = await loadEverything()
        setCouple(data.couple)
        setMembers(data.members)
        setEvents(data.events)
        if (markAsSeen) {
          setSeenAt(data.members[userId]?.lastSeenAt ?? null)
          await markSeen()
          navigator.clearAppBadge?.().catch(() => {})
        }
      } catch {
        setToast('Bağlantı sorunu, birazdan tekrar deneyeceğim')
      }
    },
    [userId],
  )

  useEffect(() => {
    reload({ markAsSeen: true })
    const channel = supabase
      .channel('events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => reload())
      .subscribe()
    const onVisible = () => document.visibilityState === 'visible' && reload({ markAsSeen: true })
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])

  // A tapped notification opens its plan, both on a cold start (?event=) and while the app is open.
  const [pendingOpen, setPendingOpen] = useState(() => new URLSearchParams(window.location.search).get('event'))

  useEffect(() => {
    const onMessage = (e) => {
      if (e.data?.type !== 'open') return
      setPendingOpen(new URL(e.data.url, window.location.origin).searchParams.get('event'))
      reload({ markAsSeen: true })
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [reload])

  useEffect(() => {
    const event = pendingOpen && events.find((e) => e.id === pendingOpen)
    if (!event) return
    setSheet({ type: 'detail', event })
    setSelected(parseISO(event.date))
    setMonth(startOfMonth(parseISO(event.date)))
    setPendingOpen(null)
    window.history.replaceState(null, '', '/')
  }, [pendingOpen, events])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(id)
  }, [toast])

  const partner = Object.values(members).find((m) => m.id !== userId)
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const selectedKey = format(selected, 'yyyy-MM-dd')
  const sorted = useMemo(() => [...events].sort(byDateTime), [events])
  const dayEvents = sorted.filter((e) => e.date === selectedKey)
  const upcoming = sorted.filter((e) => e.date >= todayKey && e.date !== selectedKey).slice(0, 4)
  const nextDate = sorted.find((e) => e.date >= todayKey && (e.tag === 'date' || e.surprise))
  const isNew = (e) => Boolean(seenAt) && e.createdBy !== userId && new Date(e.createdAt) > new Date(seenAt)

  function selectDay(day) {
    setSelected(day)
    setMonth(startOfMonth(day))
  }

  function changeView(next) {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // not remembered in private mode
    }
  }

  async function handleSave(form) {
    const id = await saveEvent(form, couple.id, sheet.event)
    setSheet(null)
    selectDay(parseISO(form.date))
    if (!sheet.event) {
      if (partner) notifyPartner(id)
      setToast(
        form.surprise
          ? `🎁 Sürpriz eklendi, ${partner?.name ?? 'eşin'} sadece ipucunu görecek`
          : '✨ Ortak takvime eklendi',
      )
    }
    reload()
  }

  async function handleDelete(event) {
    try {
      await deleteEvent(event)
      setSheet(null)
      reload()
    } catch {
      setToast('Silinemedi, tekrar dener misin?')
    }
  }

  async function handleCover(dataUrl) {
    try {
      await setCover(couple, dataUrl)
      reload()
    } catch {
      setToast('Fotoğraf yüklenemedi')
    }
  }

  const openForm = (preset) => setSheet({ type: 'form', preset })
  const openDetail = (event) => setSheet({ type: 'detail', event })

  if (!couple) return <div className="splash">UsDay</div>

  return (
    <div className="app">
      <Cover
        photo={couple.coverUrl}
        onPhoto={handleCover}
        nextEvent={nextDate}
        onOpen={openDetail}
        onSettings={() => setSheet({ type: 'settings' })}
      />

      <main className="content">
        <NotificationCard partnerName={partner?.name} onToast={setToast} />

        {!partner && (
          <InviteCard
            code={couple.inviteCode}
            onToast={setToast}
            onJoined={() => {
              setToast('💜 Takvimleriniz birleşti!')
              reload()
            }}
          />
        )}

        {events.length === 0 && (
          <section className="welcome card">
            <strong>UsDay’e hoş geldiniz 💜</strong>
            <small>İlk planınızı ekleyin. Bir şablona dokunmanız yeterli:</small>
            <div className="templates">
              {TEMPLATES.date.items.slice(0, 6).map((t) => (
                <button key={t.title} className="chip" onClick={() => openForm({ ...t, tag: 'date' })}>
                  {t.title}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="segmented view-switch" role="tablist" aria-label="Takvim görünümü">
          <button className={view === 'month' ? 'is-active' : ''} onClick={() => changeView('month')}>
            Ay
          </button>
          <button className={view === 'week' ? 'is-active' : ''} onClick={() => changeView('week')}>
            Hafta
          </button>
        </div>

        {view === 'week' ? (
          <WeekView
            selected={selected}
            onSelect={selectDay}
            events={events}
            onOpen={openDetail}
            onCreate={(date, time) => openForm({ date, time })}
          />
        ) : (
          <MonthCalendar month={month} onMonthChange={setMonth} selected={selected} onSelect={selectDay} events={events} />
        )}

        <section className="agenda">
          <h2 className="section-title">{format(selected, 'd MMMM, EEEE', { locale: tr })}</h2>
          {dayEvents.length ? (
            <div className="event-list">
              {dayEvents.map((e) => (
                <EventCard key={e.id} event={e} members={members} isNew={isNew(e)} onClick={() => openDetail(e)} />
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
                <EventCard
                  key={e.id}
                  event={e}
                  members={members}
                  isNew={isNew(e)}
                  showDate
                  onClick={() => openDetail(e)}
                />
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
          {sheet.type === 'settings' ? (
            <SettingsSheet me={members[userId]} onClose={() => setSheet(null)} onToast={setToast} />
          ) : sheet.type === 'form' ? (
            <EventForm
              initial={sheet.event}
              preset={sheet.preset}
              defaultDate={selectedKey}
              onSave={handleSave}
              onDelete={sheet.event ? () => handleDelete(sheet.event) : null}
              onCancel={() => setSheet(null)}
            />
          ) : (
            <EventDetail
              event={sheet.event}
              me={userId}
              members={members}
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
