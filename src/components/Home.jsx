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
import {
  addTemplate,
  deleteEvent,
  deleteTemplate,
  loadEverything,
  markSeen,
  saveEvent,
  setCover,
  setTogetherSince,
  skipOccurrence,
} from '../lib/api'
import { TEMPLATES } from '../lib/constants'
import { addDaysKey, dayNumber, expandEvents, milestones } from '../lib/recurrence'
import InviteCard from './InviteCard'
import ProposalCard from './ProposalCard'
import { dative } from '../lib/format'
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
  const [templates, setTemplates] = useState([])
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
        setTemplates(data.templates)
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

  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const monthKey = format(month, 'yyyy-MM-dd')

  // Repeating plans become one entry per day, plus anniversaries and day-count milestones,
  // over a window that covers both today's surroundings and the month being viewed.
  const togetherSince = couple?.togetherSince
  const shown = useMemo(() => {
    const from = addDaysKey(monthKey < todayKey ? monthKey : todayKey, -7)
    const to = addDaysKey(monthKey > todayKey ? monthKey : todayKey, 400)
    const special = milestones(togetherSince, from, to).map((m) => ({
      id: `milestone-${m.kind}-${m.count}`,
      seriesId: null,
      milestone: m.kind,
      title: m.title,
      date: m.date,
      time: '',
      tag: 'ozel',
      photos: [],
    }))
    return [...expandEvents(events, from, to), ...special]
  }, [events, togetherSince, monthKey, todayKey])

  useEffect(() => {
    if (!pendingOpen) return
    const matches = shown.filter((e) => e.seriesId === pendingOpen)
    const event = matches.find((e) => e.date >= todayKey) ?? matches[0]
    if (!event) return
    setSheet({ type: 'detail', event })
    setSelected(parseISO(event.date))
    setMonth(startOfMonth(parseISO(event.date)))
    setPendingOpen(null)
    window.history.replaceState(null, '', '/')
  }, [pendingOpen, shown, todayKey])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(id)
  }, [toast])

  const partner = Object.values(members).find((m) => m.id !== userId)
  const selectedKey = format(selected, 'yyyy-MM-dd')
  const sorted = useMemo(() => [...shown].sort(byDateTime), [shown])
  const dayEvents = sorted.filter((e) => e.date === selectedKey)
  // One line per plan in "Yaklaşanlar": a weekly plan shows only its next time.
  const upcoming = sorted
    .filter((e) => e.date >= todayKey && e.date !== selectedKey)
    .filter((e, i, list) => !e.seriesId || list.findIndex((o) => o.seriesId === e.seriesId) === i)
    .slice(0, 5)
  const nextDate = sorted.find(
    (e) => e.date >= todayKey && (e.tag === 'date' || e.surprise) && (e.status ?? 'confirmed') === 'confirmed',
  )
  const waitingForMe = events.filter((e) => e.status === 'proposed' && e.awaiting === userId)
  const dayCount = couple?.togetherSince ? dayNumber(couple.togetherSince, todayKey) : 0
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
    const id = await saveEvent(form, couple.id, sheet.event, partner?.id)
    setSheet(null)
    selectDay(parseISO(form.date))
    const asking = form.propose && partner
    if (!sheet.event || asking) {
      if (partner) notifyPartner(id)
      setToast(
        asking
          ? `📨 ${dative(partner.name)} soruldu, yanıtını bildireceğiz`
          : form.surprise
            ? `🎁 Sürpriz eklendi, ${partner?.name ?? 'eşin'} sadece ipucunu görecek`
            : '✨ Ortak takvime eklendi',
      )
    }
    reload()
  }

  // scope 'one' drops just the opened day of a repeating plan.
  async function handleDelete(scope) {
    try {
      if (scope === 'one') {
        await skipOccurrence(sheet.occurrence)
        setToast('🗓️ Sadece o gün silindi')
      } else {
        await deleteEvent(sheet.event)
      }
      setSheet(null)
      reload()
    } catch {
      setToast('Silinemedi, tekrar dener misin?')
    }
  }

  async function handleTogetherSince(date) {
    try {
      await setTogetherSince(couple.id, date)
      setToast(date ? '💜 Birlikte olduğunuz gün kaydedildi' : 'Tarih kaldırıldı')
      reload()
    } catch {
      setToast('Kaydedilemedi, tekrar dener misin?')
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
        dayCount={dayCount}
      />

      <main className="content">
        <NotificationCard partnerName={partner?.name} onToast={setToast} />

        {waitingForMe.map((e) => (
          <ProposalCard
            key={e.id}
            event={{ ...e, seriesId: e.id, seriesDate: e.date }}
            me={userId}
            members={members}
            onOpen={openDetail}
            onAnswered={() => reload()}
            onToast={setToast}
          />
        ))}

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
            events={shown}
            onOpen={openDetail}
            onCreate={(date, time) => openForm({ date, time })}
          />
        ) : (
          <MonthCalendar month={month} onMonthChange={setMonth} selected={selected} onSelect={selectDay} events={shown} />
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
            <SettingsSheet
              me={members[userId]}
              couple={couple}
              onTogetherSince={handleTogetherSince}
              onClose={() => setSheet(null)}
              onToast={setToast}
            />
          ) : sheet.type === 'form' ? (
            <EventForm
              initial={sheet.event}
              preset={sheet.preset}
              defaultDate={selectedKey}
              templates={templates}
              partnerName={partner?.name}
              onAddTemplate={async (t) => {
                await addTemplate(t)
                setToast('✨ Şablon eklendi')
                reload()
              }}
              onDeleteTemplate={async (id) => {
                await deleteTemplate(id)
                reload()
              }}
              onSave={handleSave}
              onDelete={sheet.event ? handleDelete : null}
              onCancel={() => setSheet(null)}
            />
          ) : (
            <EventDetail
              event={sheet.event}
              me={userId}
              members={members}
              onEdit={() =>
                // The form edits the whole series from its first day; the opened day is kept for "sadece bu günü sil".
                setSheet({ type: 'form', event: { ...sheet.event, date: sheet.event.seriesDate ?? sheet.event.date }, occurrence: sheet.event })
              }
              onClose={() => setSheet(null)}
              onAnswered={() => {
                setSheet(null)
                reload()
              }}
              onToast={setToast}
            />
          )}
        </Sheet>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
