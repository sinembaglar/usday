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
import PeopleBar from './PeopleBar'
import AddPersonSheet from './AddPersonSheet'
import { supabase } from '../lib/supabase'
import {
  addTemplate,
  cancelConnection,
  claimWish,
  deleteEvent,
  deleteTemplate,
  deleteWish,
  loadEverything,
  markSeen,
  saveEvent,
  saveWish,
  setCover,
  setRelation,
  setTogetherSince,
  skipOccurrence,
  isAdmin,
} from '../lib/api'
import { RELATIONS, UNKNOWN_PERSON, WISH_CATEGORIES, templatesFor } from '../lib/constants'
import TabBar from './TabBar'
import WishesView from './WishesView'
import WishForm from './WishForm'
import WishDetail from './WishDetail'
import { addDaysKey, dayNumber, expandEvents, milestones } from '../lib/recurrence'
import InviteCard from './InviteCard'
import ProposalCard from './ProposalCard'
import InvitationCard from './InvitationCard'
import NotificationsSheet from './NotificationsSheet'
import FeedbackSheet from './FeedbackSheet'
import ReportSheet from './ReportSheet'
import AdminPanel from './AdminPanel'
import { dative } from '../lib/format'
import NotificationCard from './NotificationCard'
import { notifyPartner, notifyWish } from '../lib/push'

// ?admin=feedback or ?admin=reports (from an admin notification) opens that part of the panel.
const adminFromUrl = (url) => new URL(url, window.location.origin).searchParams.get('admin')

const tabFromUrl = (url) =>
  new URL(url, window.location.origin).searchParams.get('tab') === 'dilekler' ? 'dilekler' : null

const byDateTime = (a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`)

// Small per-device memories: calendar view and which people are selected.
function remembered(key, fallback) {
  let raw = null
  try {
    raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return raw ?? fallback // older versions stored plain strings
  }
}

function remember(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // not remembered in private mode
  }
}

const VIEW_KEY = 'usday:view'
const PEOPLE_KEY = 'usday:people'

export default function Home({ userId }) {
  const [connections, setConnections] = useState(null)
  const [members, setMembers] = useState({})
  const [events, setEvents] = useState([])
  const [templates, setTemplates] = useState([])
  const [wishes, setWishes] = useState([])
  const [chosen, setChosen] = useState(() => remembered(PEOPLE_KEY, []))
  const [tab, setTab] = useState(() => tabFromUrl(window.location.href) ?? 'takvim')
  const [seenAt, setSeenAt] = useState(null) // last visit before this one: newer partner plans get a "yeni" pill
  const [view, setView] = useState(() => (remembered(VIEW_KEY, 'month') === 'week' ? 'week' : 'month'))
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => new Date())
  const [sheet, setSheet] = useState(null)
  const [toast, setToast] = useState(null)
  const [unread, setUnread] = useState(0)
  const [admin, setAdmin] = useState(false)

  useEffect(() => {
    isAdmin().then((yes) => {
      setAdmin(yes)
      const section = adminFromUrl(window.location.href)
      if (yes && section) setSheet({ type: 'admin', section })
    })
  }, [userId])

  // Opening the app (or coming back to it) counts as seeing everything: clears the icon badge.
  const reload = useCallback(
    async ({ markAsSeen = false } = {}) => {
      try {
        const data = await loadEverything(userId)
        setConnections(data.connections)
        setMembers(data.members)
        setEvents(data.events)
        setTemplates(data.templates)
        setWishes(data.wishes)
        setUnread(data.unreadNotifications)
        if (markAsSeen) {
          setSeenAt(data.members[userId]?.lastSeenAt ?? null)
          await markSeen()
          // The icon shows what is still unread in the app's inbox.
          const badge = data.unreadNotifications
            ? navigator.setAppBadge?.(data.unreadNotifications)
            : navigator.clearAppBadge?.()
          badge?.catch(() => {})
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wishes' }, () => reload())
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient=eq.${userId}` },
        () => reload(),
      )
      .subscribe()
    const onVisible = () => document.visibilityState === 'visible' && reload({ markAsSeen: true })
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload, userId])

  const inboxRead = useCallback(() => {
    setUnread(0)
    navigator.clearAppBadge?.().catch(() => {})
  }, [])

  // A tapped notification opens its plan, both on a cold start (?event=) and while the app is open.
  const [pendingOpen, setPendingOpen] = useState(() => new URLSearchParams(window.location.search).get('event'))

  useEffect(() => {
    const onMessage = (e) => {
      if (e.data?.type !== 'open') return
      const wantedTab = tabFromUrl(e.data.url)
      if (wantedTab) setTab(wantedTab)
      const section = adminFromUrl(e.data.url)
      if (section) setSheet({ type: 'admin', section })
      setPendingOpen(new URL(e.data.url, window.location.origin).searchParams.get('event'))
      reload({ markAsSeen: true })
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [reload])

  // People ---------------------------------------------------------------------

  const all = useMemo(() => connections ?? [], [connections])
  const byId = useMemo(() => Object.fromEntries(all.map((c) => [c.id, c])), [all])
  // The people bar's choice; nothing (or nothing still valid) means everyone.
  const selection = useMemo(() => {
    const valid = chosen.filter((id) => byId[id])
    return valid.length ? valid : all.map((c) => c.id)
  }, [chosen, byId, all])
  const single = selection.length === 1 ? byId[selection[0]] : null
  const linked = all.filter((c) => c.partnerId) // connections someone has joined
  const personOf = (c) => (c?.partnerId ? (members[c.partnerId] ?? UNKNOWN_PERSON) : null)
  const relationOf = (c) => RELATIONS[c?.relation] ?? RELATIONS.partner

  function choose(ids) {
    setChosen(ids)
    remember(PEOPLE_KEY, ids)
  }

  // Plans of the selected people, plus their anniversaries and day-count milestones.
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const monthKey = format(month, 'yyyy-MM-dd')
  const withPartner = useMemo(
    () =>
      events.map((e) => ({
        ...e,
        partnerId: byId[e.coupleId]?.partnerId ?? null,
        relation: e.guests ? 'friend' : (byId[e.coupleId]?.relation ?? 'partner'),
      })),
    [events, byId],
  )

  const shown = useMemo(() => {
    const from = addDaysKey(monthKey < todayKey ? monthKey : todayKey, -7)
    const to = addDaysKey(monthKey > todayKey ? monthKey : todayKey, 400)
    const picked = new Set(selection)
    // A group plan shows when anyone on it is one of the selected people.
    const pickedPeople = new Set(selection.map((id) => byId[id]?.partnerId).filter(Boolean))
    const onScreen = (e) =>
      e.guests
        ? [e.createdBy, ...e.guests.map((g) => g.id)].some((id) => pickedPeople.has(id))
        : picked.has(e.coupleId)
    const special = selection.flatMap((id) => {
      const c = byId[id]
      if (!c?.partnerId) return []
      const suffix = selection.length > 1 ? ` · ${members[c.partnerId]?.name ?? ''}` : ''
      return milestones(c.togetherSince, from, to, c.relation).map((m) => ({
        id: `milestone-${c.id}-${m.kind}-${m.count}`,
        seriesId: null,
        coupleId: c.id,
        milestone: m.kind,
        title: m.title + suffix,
        date: m.date,
        time: '',
        tag: 'ozel',
        photos: [],
      }))
    })
    return [...expandEvents(withPartner.filter(onScreen), from, to), ...special]
  }, [withPartner, selection, byId, members, monthKey, todayKey])

  // Opening a plan of someone who is not selected adds them to the selection first.
  useEffect(() => {
    if (!pendingOpen || !connections) return
    const raw = events.find((e) => e.id === pendingOpen)
    if (raw?.guests && !shown.some((e) => e.seriesId === raw.id)) {
      choose(all.map((c) => c.id)) // a group plan: show everyone
      return
    }
    if (raw && !raw.guests && !selection.includes(raw.coupleId)) {
      choose([...selection, raw.coupleId])
      return
    }
    const matches = shown.filter((e) => e.seriesId === pendingOpen)
    const event = matches.find((e) => e.date >= todayKey) ?? matches[0]
    if (!event) return
    setTab('takvim')
    setSheet({ type: 'detail', event })
    setSelected(parseISO(event.date))
    setMonth(startOfMonth(parseISO(event.date)))
    setPendingOpen(null)
    window.history.replaceState(null, '', '/')
    // choose is stable enough for this one-off jump
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOpen, shown, todayKey, events, selection, connections])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(id)
  }, [toast])

  // ?tab=dilekler (from a wish notification) is used once, then the address is cleaned.
  useEffect(() => {
    const url = window.location.href
    if ((tabFromUrl(url) || adminFromUrl(url)) && !pendingOpen) window.history.replaceState(null, '', '/')
  }, [pendingOpen])

  // What the screen shows -------------------------------------------------------

  const selectedKey = format(selected, 'yyyy-MM-dd')
  const sorted = useMemo(() => [...shown].sort(byDateTime), [shown])
  const dayEvents = sorted.filter((e) => e.date === selectedKey)
  // One line per plan in "Yaklaşanlar": a weekly plan shows only its next time.
  const upcoming = sorted
    .filter((e) => e.date >= todayKey && e.date !== selectedKey)
    .filter((e, i, list) => !e.seriesId || list.findIndex((o) => o.seriesId === e.seriesId) === i)
    .slice(0, 5)

  // Cover cards: the next confirmed plan of each kind that has not ended yet.
  const nowHM = format(new Date(), 'HH:mm')
  const iDeclined = (e) => e.guests?.some((g) => g.id === userId && g.status === 'declined')
  const stillAhead = (e) =>
    (e.status ?? 'confirmed') === 'confirmed' &&
    !iDeclined(e) &&
    (e.date > todayKey || (e.date === todayKey && (!e.time || (e.endTime || e.time) > nowHM)))
  const ahead = sorted.filter(stillAhead)
  const firstOf = (test) => ahead.find(test)
  const onlyPartners = selection.every((id) => byId[id]?.relation === 'partner')
  const highlights = [
    {
      kind: 'date',
      label: onlyPartners ? 'Sıradaki date' : 'Sıradaki buluşma',
      event: firstOf((e) => e.tag === 'date' && !e.surprise),
    },
    { kind: 'surprise', label: 'Sıradaki sürpriz', event: firstOf((e) => e.surprise) },
    { kind: 'special', label: 'Sıradaki özel gün', event: firstOf((e) => e.tag === 'ozel' || e.milestone) },
    { kind: 'trip', label: 'Sıradaki tatil', event: firstOf((e) => e.tag === 'tatil') },
    { kind: 'any', label: 'Sıradaki plan', event: ahead[0] },
  ]
    .filter((h) => h.event)
    .map((h) => ({ ...h, text: h.event.locked ? '🎁 Bir sürpriz yaklaşıyor' : h.event.title }))

  const waitingForMe = withPartner.filter((e) => e.status === 'proposed' && e.awaiting === userId)
  const invitedMe = withPartner.filter((e) => e.guests?.some((g) => g.id === userId && g.status === 'pending'))
  const pending = selection.map((id) => byId[id]).filter((c) => c && !c.partnerId)
  const counter =
    single?.partnerId && single.togetherSince && relationOf(single).counter
      ? relationOf(single).counter(dayNumber(single.togetherSince, todayKey).toLocaleString('tr-TR'))
      : null
  const isNew = (e) => Boolean(seenAt) && e.createdBy !== userId && new Date(e.createdAt) > new Date(seenAt)
  // With plans of several people on screen, each says who it is with.
  const withWhom = (e) => {
    if (e.guests) {
      const others = [e.createdBy, ...e.guests.map((g) => g.id)].filter((id) => id !== userId)
      return `👥 ${others.map((id) => (members[id] ?? UNKNOWN_PERSON).name).join(', ')}`
    }
    const c = byId[e.coupleId]
    return linked.length > 1 && c?.partnerId ? `${relationOf(c).emoji} ${personOf(c).name}` : null
  }
  const formConnections = all.map((c) => ({
    id: c.id,
    relation: c.relation,
    emoji: relationOf(c).emoji,
    partnerName: personOf(c)?.name,
    partnerId: c.partnerId,
  }))
  const defaultCoupleId = single?.id ?? selection.find((id) => byId[id]?.partnerId) ?? selection[0]

  function selectDay(day) {
    setSelected(day)
    setMonth(startOfMonth(day))
  }

  function changeView(next) {
    setView(next)
    remember(VIEW_KEY, next)
  }

  // Actions ------------------------------------------------------------------------

  async function handleSave(form) {
    // Several people picked: a group plan everyone is invited to.
    if (form.coupleIds.length > 1) {
      const guestIds = form.coupleIds.map((id) => byId[id]?.partnerId).filter(Boolean)
      const hiddenFrom = form.surprise ? form.hiddenFrom.filter((id) => guestIds.includes(id)) : []
      const id = await saveEvent(form, null, sheet.event, null, { guestIds, hiddenFrom })
      setSheet(null)
      if (!form.coupleIds.every((cid) => selection.includes(cid))) choose([...new Set([...selection, ...form.coupleIds])])
      selectDay(parseISO(form.date))
      if (!sheet.event) {
        notifyPartner(id)
        const targets = hiddenFrom.map((pid) => (members[pid] ?? UNKNOWN_PERSON).name).join(', ')
        setToast(hiddenFrom.length ? `🎁 Grup sürprizi hazır, ${targets} sadece ipucunu görecek` : `👥 ${guestIds.length} kişiye davet gitti`)
      }
      reload()
      return
    }

    const coupleId = form.coupleIds[0]
    const connection = byId[coupleId]
    const partner = personOf(connection)
    const id = await saveEvent(form, coupleId, sheet.event, connection?.partnerId)
    // A surprise made from someone's wish quietly claims that wish.
    if (sheet.fromWish && form.surprise) await claimWish(sheet.fromWish, id).catch(() => {})
    setSheet(null)
    if (sheet.fromWish) setTab('takvim')
    if (!selection.includes(coupleId)) choose([...selection, coupleId])
    selectDay(parseISO(form.date))
    const asking = form.propose && partner
    if (!sheet.event || asking) {
      if (partner) notifyPartner(id)
      setToast(
        asking
          ? `📨 ${dative(partner.name)} soruldu, yanıtını bildireceğiz`
          : form.surprise
            ? `🎁 Sürpriz eklendi, ${partner?.name ?? 'o'} sadece ipucunu görecek`
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

  async function handleCover(dataUrl) {
    try {
      await setCover(single, dataUrl)
      reload()
    } catch {
      setToast('Fotoğraf yüklenemedi')
    }
  }

  const connectionActions = {
    onRelation: async (c, relation) => {
      try {
        await setRelation(c.id, relation)
        reload()
      } catch {
        setToast('Kaydedilemedi, tekrar dener misin?')
      }
    },
    onSince: async (c, date) => {
      try {
        await setTogetherSince(c.id, date)
        setToast(date ? '💜 Tarih kaydedildi' : 'Tarih kaldırıldı')
        reload()
      } catch {
        setToast('Kaydedilemedi, tekrar dener misin?')
      }
    },
    onCancel: async (c) => {
      if (!window.confirm('Bu davet iptal edilsin mi? Kod artık çalışmayacak.')) return
      try {
        await cancelConnection(c.id)
        setToast('Davet iptal edildi')
        reload()
      } catch {
        setToast('İptal edilemedi. Bu bağlantıda plan varsa önce onları sil.')
      }
    },
    onReport: (person) => setSheet({ type: 'report', person }),
  }

  const openForm = (preset) => setSheet({ type: 'form', preset })

  // A wish becomes a plan: the owner plans it openly, others as a surprise (asking first).
  function planFromWish(wish, surprise) {
    const extra = [wish.note, wish.link, wish.price && `💸 ${wish.price}`].filter(Boolean).join('\n')
    const withOwner = all.find((c) => c.partnerId === wish.owner)
    setSheet({
      type: 'form',
      fromWish: wish.id,
      preset: {
        title: wish.title,
        tag: WISH_CATEGORIES[wish.category].planTag,
        note: extra,
        surprise,
        propose: surprise,
        date: todayKey,
        coupleId: wish.owner === userId ? defaultCoupleId : withOwner?.id,
      },
    })
  }

  async function handleWishSave(form) {
    const id = await saveWish(form, userId, sheet.wish)
    setSheet(null)
    if (!sheet.wish && linked.length) notifyWish(id)
    setToast(sheet.wish ? 'Dilek güncellendi' : '✨ Dilek listene eklendi')
    reload()
  }

  async function handleWishDelete() {
    if (!window.confirm('Bu dilek silinsin mi?')) return
    try {
      await deleteWish(sheet.wish)
      setSheet(null)
      reload()
    } catch {
      setToast('Silinemedi, tekrar dener misin?')
    }
  }

  function closeWith(message) {
    setSheet(null)
    setToast(message)
  }

  function connectionReady(id, message) {
    setSheet(null)
    choose([id])
    setToast(message)
    reload()
  }

  const headerButtons = (
    <span className="cover-actions">
      <button
        className="cover-photo-btn cover-icon bell"
        onClick={() => setSheet({ type: 'inbox' })}
        aria-label={unread ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'}
      >
        🔔
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <button className="cover-photo-btn cover-icon" onClick={() => setSheet({ type: 'settings' })} aria-label="Ayarlar">
        ⚙️
      </button>
    </span>
  )

  const peopleBar = (
    <PeopleBar
      connections={all}
      members={members}
      selected={selection}
      onChange={choose}
      onAdd={() => setSheet({ type: 'addPerson' })}
    />
  )

  const openDetail = (event) => setSheet({ type: 'detail', event })

  if (!connections) return <div className="splash">UsDay</div>

  const welcomeIdeas = templatesFor('date', single?.relation ?? 'partner').items.slice(0, 6)
  const visiblePeople = [...new Set(selection.map((id) => byId[id]?.partnerId).filter(Boolean))].map(
    (id) => members[id] ?? UNKNOWN_PERSON,
  )

  return (
    <div className="app has-tabbar">
      {tab === 'dilekler' ? (
        <WishesView
          wishes={wishes}
          me={userId}
          people={visiblePeople}
          onOpen={(wish) => setSheet({ type: 'wishDetail', wish })}
          onAdd={() => setSheet({ type: 'wishForm' })}
          header={
            <>
              <header className="page-head">
                <h1>🎁 Dilekler</h1>
                {headerButtons}
              </header>
              <div className="content people-wrap">{peopleBar}</div>
            </>
          }
        />
      ) : (
        <>
          <Cover
            photo={single?.coverUrl ?? null}
            onPhoto={single ? handleCover : null}
            highlights={highlights}
            onOpen={openDetail}
            onSettings={() => setSheet({ type: 'settings' })}
            onInbox={() => setSheet({ type: 'inbox' })}
            unread={unread}
            counter={counter}
          />

          <main className="content">
            {peopleBar}

            <NotificationCard partnerName={personOf(single)?.name} onToast={setToast} />

            {invitedMe.map((e) => (
              <InvitationCard
                key={e.id}
                event={e}
                me={userId}
                members={members}
                onOpen={openDetail}
                onAnswered={() => reload()}
                onToast={setToast}
              />
            ))}

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

            {pending.map((c) => (
              <InviteCard
                key={c.id}
                code={c.inviteCode}
                relation={c.relation}
                showJoin={all.length === 1}
                onToast={setToast}
                onJoined={(id) => connectionReady(id, '💜 Ortak takviminiz açıldı!')}
              />
            ))}

            {shown.filter((e) => !e.milestone).length === 0 && (
              <section className="welcome card">
                <strong>UsDay’e hoş geldin 💜</strong>
                <small>İlk planı ekle. Bir şablona dokunman yeterli:</small>
                <div className="templates">
                  {welcomeIdeas.map((t) => (
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
                    <EventCard
                      key={e.id}
                      event={e}
                      members={members}
                      isNew={isNew(e)}
                      withWhom={withWhom(e)}
                      me={userId}
                      onClick={() => openDetail(e)}
                    />
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
                      withWhom={withWhom(e)}
                      me={userId}
                      showDate
                      onClick={() => openDetail(e)}
                    />
                  ))}
                </div>
              </section>
            )}
          </main>
        </>
      )}

      <button
        className="fab"
        onClick={() => setSheet({ type: tab === 'dilekler' ? 'wishForm' : 'form' })}
        aria-label={tab === 'dilekler' ? 'Dilek ekle' : 'Plan ekle'}
      >
        +
      </button>

      <TabBar
        tab={tab}
        onChange={(next) => {
          setTab(next)
          window.scrollTo(0, 0)
        }}
      />

      {sheet && (
        <Sheet onClose={() => setSheet(null)}>
          {sheet.type === 'addPerson' ? (
            <AddPersonSheet
              onCreated={(id) => connectionReady(id, '💌 Davet kodun hazır, gönderebilirsin')}
              onJoined={(id) => connectionReady(id, '💜 Ortak takviminiz açıldı!')}
              onClose={() => setSheet(null)}
            />
          ) : sheet.type === 'wishForm' ? (
            <WishForm
              initial={sheet.wish}
              onSave={handleWishSave}
              onDelete={sheet.wish ? handleWishDelete : null}
              onCancel={() => setSheet(null)}
            />
          ) : sheet.type === 'wishDetail' ? (
            <WishDetail
              wish={sheet.wish}
              me={userId}
              members={members}
              onEdit={() => setSheet({ type: 'wishForm', wish: sheet.wish })}
              onPlan={() => planFromWish(sheet.wish, false)}
              onSurprise={() => planFromWish(sheet.wish, true)}
              onChanged={() => {
                setSheet(null)
                reload()
              }}
              onClose={() => setSheet(null)}
              onToast={setToast}
            />
          ) : sheet.type === 'inbox' ? (
            <NotificationsSheet
              onRead={inboxRead}
              onOpenEvent={(id) => {
                setSheet(null)
                setPendingOpen(id)
              }}
              onOpenAdmin={admin ? (section) => setSheet({ type: 'admin', section }) : null}
              onClose={() => setSheet(null)}
              onToast={setToast}
            />
          ) : sheet.type === 'feedback' ? (
            <FeedbackSheet
              userId={userId}
              onDone={closeWith}
              onCancel={() => setSheet({ type: 'settings' })}
              onToast={setToast}
            />
          ) : sheet.type === 'report' ? (
            <ReportSheet
              userId={userId}
              person={sheet.person}
              onDone={closeWith}
              onCancel={() => setSheet({ type: 'settings' })}
              onToast={setToast}
            />
          ) : sheet.type === 'admin' ? (
            <AdminPanel initialSection={sheet.section} onClose={() => setSheet(null)} onToast={setToast} />
          ) : sheet.type === 'settings' ? (
            <SettingsSheet
              me={members[userId]}
              admin={admin}
              onFeedback={() => setSheet({ type: 'feedback' })}
              onAdmin={() => setSheet({ type: 'admin', section: 'overview' })}
              connections={all}
              members={members}
              connectionActions={connectionActions}
              onClose={() => setSheet(null)}
              onToast={setToast}
            />
          ) : sheet.type === 'form' ? (
            <EventForm
              initial={sheet.event}
              preset={sheet.preset}
              defaultDate={selectedKey}
              templates={templates}
              connections={formConnections}
              defaultCoupleId={defaultCoupleId}
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
              withWhom={withWhom(sheet.event)}
              onEdit={() =>
                // The form edits the whole series from its first day; the opened day is kept for "sadece bu günü sil".
                setSheet({
                  type: 'form',
                  event: { ...sheet.event, date: sheet.event.seriesDate ?? sheet.event.date },
                  occurrence: sheet.event,
                })
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
