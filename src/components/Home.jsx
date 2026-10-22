import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO, startOfMonth } from 'date-fns'
import { tr } from 'date-fns/locale'
import Cover from './Cover'
import MonthCalendar from './MonthCalendar'
import EventCard from './EventCard'
import Sheet from './Sheet'
import EventForm from './EventForm'
import EventDetail from './EventDetail'
import { supabase } from '../lib/supabase'
import { deleteEvent, loadEverything, saveEvent, setCover } from '../lib/api'

const byDateTime = (a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`)

export default function Home({ userId }) {
  const [couple, setCouple] = useState(null)
  const [members, setMembers] = useState({})
  const [events, setEvents] = useState([])
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => new Date())
  const [sheet, setSheet] = useState(null) // { type: 'form' | 'detail', event? }
  const [toast, setToast] = useState(null)

  const reload = useCallback(async () => {
    try {
      const data = await loadEverything()
      setCouple(data.couple)
      setMembers(data.members)
      setEvents(data.events)
    } catch {
      setToast('Bağlantı sorunu, birazdan tekrar deneyeceğim')
    }
  }, [])

  useEffect(() => {
    reload()
    const channel = supabase
      .channel('events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, reload)
      .subscribe()
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])

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

  function selectDay(day) {
    setSelected(day)
    setMonth(startOfMonth(day))
  }

  async function handleSave(form) {
    await saveEvent(form, couple.id, sheet.event)
    setSheet(null)
    selectDay(parseISO(form.date))
    if (!sheet.event) {
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

  async function invite() {
    const url = window.location.origin
    const text = 'UsDay’de ortak takvimimizi açtım 💜 Kayıt olunca takvimlerimiz birleşiyor:'
    if (navigator.share) {
      navigator.share({ title: 'UsDay', text, url }).catch(() => {})
    } else {
      await navigator.clipboard?.writeText(`${text} ${url}`)
      setToast('🔗 Davet linki kopyalandı')
    }
  }

  const openDetail = (event) => setSheet({ type: 'detail', event })

  if (!couple) return <div className="splash">UsDay</div>

  return (
    <div className="app">
      <Cover photo={couple.coverUrl} onPhoto={handleCover} nextEvent={nextDate} onOpen={openDetail} />

      <main className="content">
        {!partner && (
          <button className="invite card" onClick={invite}>
            <span>💌</span>
            <span>
              <strong>Eşini davet et</strong>
              <small>UsDay linkini gönder. Kayıt olunca takviminiz birleşir.</small>
            </span>
          </button>
        )}

        <MonthCalendar month={month} onMonthChange={setMonth} selected={selected} onSelect={selectDay} events={events} />

        <section className="agenda">
          <h2 className="section-title">{format(selected, 'd MMMM, EEEE', { locale: tr })}</h2>
          {dayEvents.length ? (
            <div className="event-list">
              {dayEvents.map((e) => (
                <EventCard key={e.id} event={e} members={members} onClick={() => openDetail(e)} />
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
                <EventCard key={e.id} event={e} members={members} showDate onClick={() => openDetail(e)} />
              ))}
            </div>
          </section>
        )}

        <button className="signout" onClick={() => supabase.auth.signOut()}>
          {members[userId]?.name} olarak giriş yapıldı · Çıkış yap
        </button>
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
