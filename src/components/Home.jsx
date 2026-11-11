import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO, startOfMonth } from 'date-fns'
import { Bell, Cake, Lock, Settings } from 'lucide-react'
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
import BirthdaySheet from './BirthdaySheet'
import PaywallSheet from './PaywallSheet'
import { supabase } from '../lib/supabase'
import { reportError } from '../lib/errors'
import { statusBarText } from '../lib/native'
import { useBackButton } from '../lib/back'
import { isDark } from '../lib/theme'
import {
  addTemplate,
  cancelConnection,
  claimWish,
  deleteEvent,
  deleteTemplate,
  deleteWish,
  loadBilling,
  loadEverything,
  markSeen,
  setBirthday,
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
import { birthdaysBetween, daysUntil, nextBirthday } from '../lib/birthdays'
import InviteCard from './InviteCard'
import StartGuide from './StartGuide'
import ProposalCard from './ProposalCard'
import InvitationCard from './InvitationCard'
import NotificationsSheet from './NotificationsSheet'
import FeedbackSheet from './FeedbackSheet'
import ReportSheet from './ReportSheet'
import RemoveConnectionSheet from './RemoveConnectionSheet'
import AdminPanel from './AdminPanel'
import { dative, genitive, possessive } from '../lib/format'
import { dateText, listNames, t } from '../lib/i18n'
import { findConflicts } from '../lib/conflicts'
import { forgetLink, rememberLink, startLink } from '../lib/updates'
import NotificationCard from './NotificationCard'
import { notifyPartner, notifyWish } from '../lib/push'

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
const INVITE_SENT_KEY = 'usday:invite-sent'

export default function Home({ userId }) {
  const [connections, setConnections] = useState(null)
  const [members, setMembers] = useState({})
  const [events, setEvents] = useState([])
  const [templates, setTemplates] = useState([])
  const [wishes, setWishes] = useState([])
  const [sharedPlans, setSharedPlans] = useState([]) // from calendars others share with me
  const [shares, setShares] = useState({ byMe: {}, withMe: {} })
  const [chosen, setChosen] = useState(() => remembered(PEOPLE_KEY, []))
  const [tab, setTab] = useState(() => tabFromUrl(window.location.href) ?? 'takvim')
  const [seenAt, setSeenAt] = useState(null) // last visit before this one: newer partner plans get a "yeni" pill
  const [view, setView] = useState(() => (remembered(VIEW_KEY, 'month') === 'week' ? 'week' : 'month'))
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => new Date())
  const [sheet, setSheet] = useState(null)
  // Android back button on the wishes tab, with nothing open: back to the calendar.
  useBackButton(tab !== 'takvim', () => {
    setTab('takvim')
    window.scrollTo(0, 0)
  }, 0)
  const [toast, setToast] = useState(null)
  const [unread, setUnread] = useState(0)
  const [admin, setAdmin] = useState(false)
  const [inviteSent, setInviteSent] = useState(() => remembered(INVITE_SENT_KEY, false) === true)
  const [billing, setBilling] = useState(null) // subscriptions: off until launch, then who can add plans

  // The address is cleaned on start, so the admin link is read from where the app was opened.
  useEffect(() => {
    isAdmin().then((yes) => {
      setAdmin(yes)
      const section = new URLSearchParams(startLink()).get('admin')
      if (yes && section) setSheet({ type: 'admin', section })
    })
  }, [userId])

  // Opening the app (or coming back to it) counts as seeing everything: clears the icon badge.
  const reload = useCallback(
    async ({ markAsSeen = false } = {}) => {
      try {
        const [data, bill] = await Promise.all([loadEverything(userId), loadBilling().catch(() => null)])
        if (bill) setBilling(bill)
        setConnections(data.connections)
        setMembers(data.members)
        setEvents(data.events)
        setTemplates(data.templates)
        setWishes(data.wishes)
        setSharedPlans(data.sharedPlans)
        setShares({ byMe: data.sharesByMe, withMe: data.sharesWithMe })
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
      } catch (err) {
        reportError('load', err)
        setToast(t('Bağlantı sorunu, birazdan tekrar deneyeceğim', 'Connection problem, trying again in a moment'))
      }
    },
    [userId],
  )

  // Live updates: the database pings my own private channel when something of mine changes. A burst of
  // changes (a plan with its guests) becomes one reload, and reloads are spread over a second or two so the
  // apps of everyone a change concerns do not all ask the server at the same moment.
  useEffect(() => {
    reload({ markAsSeen: true })
    let timer = null
    const reloadSoon = () => {
      clearTimeout(timer)
      timer = setTimeout(() => reload(), 300 + Math.random() * 1500)
    }
    const channel = supabase.channel(`user:${userId}`, { config: { private: true } })
    supabase.realtime
      .setAuth()
      .catch(() => {})
      .then(() => channel.on('broadcast', { event: 'changed' }, reloadSoon).subscribe())
    const onVisible = () => document.visibilityState === 'visible' && reload({ markAsSeen: true })
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload, userId])

  const refreshBilling = useCallback(async () => {
    try {
      setBilling(await loadBilling())
    } catch {
      // the next reload tries again
    }
  }, [])

  // Phone app status bar: light text over the dark cover of the calendar and in the dark theme.
  useEffect(() => {
    statusBarText(tab === 'takvim' || isDark())
  }, [tab])

  const inboxRead = useCallback(() => {
    setUnread(0)
    navigator.clearAppBadge?.().catch(() => {})
  }, [])

  // A tapped notification opens what it is about: a plan (?event=, &chat=1 for a comment), a wish
  // (?wish=), an anniversary (?milestone=) or the admin panel (?admin=). Works on a cold start, from
  // the phone while the app is open, and from the in-app inbox.
  const startParams = useMemo(() => new URLSearchParams(startLink()), [])
  const [pendingOpen, setPendingOpen] = useState(() => (startParams.get('shared') ? null : startParams.get('event')))
  const [focusChat, setFocusChat] = useState(() => startParams.has('chat'))
  const [focusAbout, setFocusAbout] = useState(() => startParams.get('about'))
  // A plan on someone's shared calendar (?shared=owner&event=id), e.g. their answer to my comment.
  const [pendingShared, setPendingShared] = useState(() =>
    startParams.get('shared') ? { owner: startParams.get('shared'), eventId: startParams.get('event') } : null,
  )
  const [pendingWish, setPendingWish] = useState(() => startParams.get('wish'))
  const [pendingPerson, setPendingPerson] = useState(() => startParams.get('person'))
  const [pendingBirthday, setPendingBirthday] = useState(() => startParams.get('birthday'))
  const [wishFocus, setWishFocus] = useState(null) // whose wish list the wishes tab opens on
  const [pendingMilestone, setPendingMilestone] = useState(() =>
    startParams.get('milestone')
      ? { id: startParams.get('milestone'), coupleId: startParams.get('with'), day: startParams.get('day') }
      : null,
  )

  const openLink = useCallback(
    (url) => {
      const p = new URL(url, window.location.origin).searchParams
      if (p.get('admin')) {
        if (admin) setSheet({ type: 'admin', section: p.get('admin') })
        return
      }
      if (p.get('tab') === 'dilekler') setTab('dilekler')
      if (p.get('person')) setPendingPerson(p.get('person'))
      if (p.get('birthday')) setPendingBirthday(p.get('birthday'))
      if (p.get('wish')) setPendingWish(p.get('wish'))
      if (p.get('shared')) {
        setPendingShared({ owner: p.get('shared'), eventId: p.get('event') })
      } else if (p.get('event')) {
        setFocusChat(p.has('chat'))
        setFocusAbout(p.get('about'))
        setPendingOpen(p.get('event'))
      }
      if (p.get('milestone')) setPendingMilestone({ id: p.get('milestone'), coupleId: p.get('with'), day: p.get('day') })
    },
    [admin],
  )

  useEffect(() => {
    const onMessage = async (e) => {
      if (e.data?.type !== 'open') return
      rememberLink(e.data.url) // in case the app reloads for a new version first
      setSheet(null)
      await reload({ markAsSeen: true }) // so a brand-new plan or wish is there to open
      openLink(e.data.url)
      forgetLink()
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [reload, openLink])

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
  // Connections nobody pays for while billing is on: their plans stay, but nothing new can be added.
  const closed = useMemo(
    () => new Set(billing?.enabled ? billing.connections.filter((c) => !c.open).map((c) => c.couple_id) : []),
    [billing],
  )

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
        partnerId: c.partnerId,
        relation: c.relation,
        count: m.count,
        milestone: m.kind,
        title: m.title + suffix,
        date: m.date,
        time: '',
        tag: 'ozel',
        photos: [],
      }))
    })
    // Birthdays of the selected people, and mine.
    const birthdays = [...pickedPeople, userId].flatMap((pid) => {
      const person = members[pid]
      return birthdaysBetween(person?.birthday, from, to).map((date) => ({
        id: `birthday-${pid}-${date}`,
        seriesId: null,
        birthday: pid,
        coupleId: Object.values(byId).find((c) => c.partnerId === pid)?.id ?? null,
        title: pid === userId ? t('🎂 Doğum günün', '🎂 Your birthday') : `🎂 ${possessive(person.name)} ${t('doğum günü', 'birthday')}`,
        date,
        time: '',
        tag: 'ozel',
        photos: [],
      }))
    })
    // Calendars the selected people share with me: their other plans, as busy time or by name.
    const sharedOnScreen = sharedPlans.filter((p) => pickedPeople.has(p.owner))
    return [...expandEvents([...withPartner.filter(onScreen), ...sharedOnScreen], from, to), ...special, ...birthdays]
  }, [withPartner, sharedPlans, selection, byId, members, monthKey, todayKey, userId])

  // Opening a plan of someone who is not selected adds them to the selection first.
  useEffect(() => {
    if (!pendingOpen || !connections) return
    const raw = events.find((e) => e.id === pendingOpen)
    if (!raw) {
      setToast(t('Bu plan artık yok', 'This plan no longer exists'))
      setPendingOpen(null)
      return
    }
    if (raw.guests && !shown.some((e) => e.seriesId === raw.id)) {
      choose(all.map((c) => c.id)) // a group plan: show everyone
      return
    }
    if (raw && !raw.guests && !selection.includes(raw.coupleId)) {
      choose([...selection, raw.coupleId])
      return
    }
    const matches = shown.filter((e) => e.seriesId === pendingOpen)
    const event = matches.find((e) => e.date >= todayKey) ?? matches[0]
    if (!event) {
      // An older plan is outside the loaded months: go to its month first, then open it.
      const target = startOfMonth(parseISO(raw.date))
      if (+target !== +month) setMonth(target)
      else setPendingOpen(null)
      return
    }
    setTab('takvim')
    setSheet({ type: 'detail', event, focusChat, focusAbout })
    setSelected(parseISO(event.date))
    setMonth(startOfMonth(parseISO(event.date)))
    setPendingOpen(null)
    setFocusChat(false)
    setFocusAbout(null)
    // choose is stable enough for this one-off jump
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOpen, shown, todayKey, events, selection, connections])

  // A wish notification opens that wish.
  useEffect(() => {
    if (!pendingWish || !connections) return
    const wish = wishes.find((w) => w.id === pendingWish)
    if (wish) {
      setTab('dilekler')
      setSheet({ type: 'wishDetail', wish })
    } else {
      setToast(t('Bu dilek artık yok', 'This wish no longer exists'))
    }
    setPendingWish(null)
  }, [pendingWish, wishes, connections])

  // A plan on someone's shared calendar: select them, go to its day and open it with our conversation.
  useEffect(() => {
    if (!pendingShared || !connections) return
    const { owner, eventId } = pendingShared
    const c = connections.find((x) => x.partnerId === owner)
    const plan = sharedPlans.find((p) => p.owner === owner && p.eventId === eventId)
    if (!c || !plan) {
      setToast(t('Bu plan artık paylaşılmıyor', 'This plan is no longer shared'))
      setPendingShared(null)
      return
    }
    if (!selection.includes(c.id)) {
      choose([...selection, c.id])
      return
    }
    const matches = shown.filter((e) => e.seriesId === plan.id)
    const event = matches.find((e) => e.date >= todayKey) ?? matches[0]
    if (!event) {
      const target = startOfMonth(parseISO(plan.date))
      if (+target !== +month) setMonth(target)
      else setPendingShared(null)
      return
    }
    setTab('takvim')
    setSelected(parseISO(event.date))
    setMonth(startOfMonth(parseISO(event.date)))
    setSheet({ type: 'detail', event, focusChat: true })
    setPendingShared(null)
    // choose is stable enough for this one-off jump
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingShared, connections, sharedPlans, selection, shown, month, todayKey])

  // "X takvimini seninle paylaştı" opens the calendar with that person selected.
  useEffect(() => {
    if (!pendingPerson || !connections) return
    const c = connections.find((x) => x.partnerId === pendingPerson)
    if (c) {
      setTab('takvim')
      choose([c.id])
      // Go to their next plan, so the shared calendar is visible right away.
      const name = (members[pendingPerson] ?? UNKNOWN_PERSON).name
      // Their shared calendar and our plans together, whichever comes first.
      const theirs = expandEvents(
        [...sharedPlans.filter((p) => p.owner === pendingPerson), ...events.filter((e) => e.coupleId === c.id)],
        todayKey,
        addDaysKey(todayKey, 400),
      ).sort(byDateTime)
      if (theirs.length) {
        const first = parseISO(theirs[0].date)
        setSelected(first)
        setMonth(startOfMonth(first))
        const day = dateText(first, 'd MMMM', 'MMMM d')
        setToast(t(`📅 ${genitive(name)} takvimi açıldı: ilk plan ${day}`, `📅 Showing ${name}’s calendar: first plan on ${day}`))
      } else {
        setToast(t(`📅 ${genitive(name)} takviminde şimdilik yaklaşan plan yok`, `📅 Nothing coming up on ${name}’s calendar yet`))
      }
    }
    setPendingPerson(null)
    // choose is stable enough for this one-off jump
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPerson, connections])

  // An anniversary notification opens that day, with that person selected.
  useEffect(() => {
    if (!pendingMilestone || !connections) return
    const { id, coupleId, day } = pendingMilestone
    if (!byId[coupleId]) {
      setPendingMilestone(null)
      return
    }
    if (!selection.includes(coupleId)) {
      choose([...selection, coupleId])
      return
    }
    const event = shown.find((e) => e.id === id)
    if (!event && day && +startOfMonth(parseISO(day)) !== +month) {
      setMonth(startOfMonth(parseISO(day)))
      return
    }
    setTab('takvim')
    if (day) setSelected(parseISO(day))
    if (event) setSheet({ type: 'detail', event })
    setPendingMilestone(null)
    // choose is stable enough for this one-off jump
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMilestone, shown, selection, byId, connections, month])

  // "Ece’nin doğum gününe 1 ay var" opens that birthday, with Ece selected.
  useEffect(() => {
    if (!pendingBirthday || !connections) return
    const c = connections.find((x) => x.partnerId === pendingBirthday)
    if (c && !selection.includes(c.id)) {
      choose([...selection, c.id])
      return
    }
    const event = shown.find((e) => e.birthday === pendingBirthday && e.date >= todayKey)
    if (event) {
      setTab('takvim')
      setSelected(parseISO(event.date))
      setMonth(startOfMonth(parseISO(event.date)))
      setSheet({ type: 'detail', event })
    }
    setPendingBirthday(null)
    // choose is stable enough for this one-off jump
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBirthday, connections, selection, shown, todayKey])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(id)
  }, [toast])

  // A notification link is used once, then the address is cleaned.
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', '/')
  }, [])

  // What the screen shows -------------------------------------------------------

  const selectedKey = format(selected, 'yyyy-MM-dd')
  const sorted = useMemo(() => [...shown].sort(byDateTime), [shown])
  const dayEvents = sorted.filter((e) => e.date === selectedKey)
  // Today and what comes next are at the top; the calendar below shows any other day picked on it.
  const todayEvents = sorted.filter((e) => e.date === todayKey)
  // One line per plan in "Yaklaşanlar": a weekly plan shows only its next time.
  // Others' shared calendars show on the calendar, the selected day and in a list of their own.
  const nextOnce = (e, i, list) => !e.seriesId || list.findIndex((o) => o.seriesId === e.seriesId) === i
  const upcoming = sorted
    .filter((e) => !e.shared && e.date > todayKey)
    .filter(nextOnce)
    .slice(0, 5)
  const sharedUpcoming = sorted
    .filter((e) => e.shared && e.date > todayKey)
    .filter(nextOnce)
    .slice(0, 5)
  const sharedOwners = [...new Set(sharedUpcoming.map((e) => e.owner))]

  // Cover cards: the next confirmed plan of each kind that has not ended yet.
  const nowHM = format(new Date(), 'HH:mm')
  const iDeclined = (e) => e.guests?.some((g) => g.id === userId && g.status === 'declined')
  const stillAhead = (e) =>
    !e.shared &&
    (e.status ?? 'confirmed') === 'confirmed' &&
    !iDeclined(e) &&
    (e.date > todayKey || (e.date === todayKey && (!e.time || (e.endTime || e.time) > nowHM)))
  const ahead = sorted.filter(stillAhead)
  const firstOf = (test) => ahead.find(test)
  const nextDate = firstOf((e) => e.tag === 'date' && !e.surprise)
  const highlights = [
    {
      kind: 'date',
      label: t('Sıradaki buluşma', nextDate?.relation === 'partner' ? 'Next date' : 'Next meetup'),
      event: nextDate,
    },
    { kind: 'surprise', label: t('Sıradaki sürpriz', 'Next surprise'), event: firstOf((e) => e.surprise) },
    { kind: 'special', label: t('Sıradaki özel gün', 'Next special day'), event: firstOf((e) => e.tag === 'ozel' || e.milestone) },
    { kind: 'trip', label: t('Sıradaki tatil', 'Next trip'), event: firstOf((e) => e.tag === 'tatil') },
    { kind: 'any', label: t('Sıradaki plan', 'Next plan'), event: ahead[0] },
  ]
    .filter((h) => h.event)
    .map((h) => ({ ...h, text: h.event.locked ? t('🎁 Bir sürpriz yaklaşıyor', '🎁 A surprise is coming') : h.event.title }))

  // Questions waiting for me, from the people selected in the people bar (everyone under "Tümü").
  const selectedPeople = new Set(selection.map((id) => byId[id]?.partnerId).filter(Boolean))
  const waitingForMe = withPartner.filter(
    (e) => e.status === 'proposed' && e.awaiting === userId && selection.includes(e.coupleId),
  )
  const invitedMe = withPartner.filter(
    (e) =>
      e.guests?.some((g) => g.id === userId && g.status === 'pending') &&
      [e.createdBy, ...e.guests.map((g) => g.id)].some((id) => selectedPeople.has(id)),
  )
  // An open invitation is shown on the home screen only while nobody has joined yet (getting started);
  // later it waits behind "Kişi ekle" and in settings.
  const openInvites = all.filter((c) => !c.partnerId)
  const pending = linked.length ? [] : openInvites.slice(0, 1)
  const counter =
    single?.partnerId && single.togetherSince && relationOf(single).counter
      ? relationOf(single).counter(dayNumber(single.togetherSince, todayKey))
      : null
  const isNew = (e) => Boolean(seenAt) && e.createdBy !== userId && new Date(e.createdAt) > new Date(seenAt)
  // With plans of several people on screen, each says who it is with.
  const withWhom = (e) => {
    if (e.shared) return `${possessive((members[e.owner] ?? UNKNOWN_PERSON).name)} ${t('takvimi', 'calendar')}`
    if (e.guests) {
      const others = [e.createdBy, ...e.guests.map((g) => g.id)].filter((id) => id !== userId)
      return others.map((id) => (members[id] ?? UNKNOWN_PERSON).name).join(', ')
    }
    const c = byId[e.coupleId]
    return linked.length > 1 && c?.partnerId ? personOf(c).name : null
  }
  // A new plan can only be made over open connections; editing keeps everyone already on it.
  const formConnections = all.filter((c) => sheet?.event || !closed.has(c.id)).map((c) => ({
    id: c.id,
    relation: c.relation,
    relationLabel: relationOf(c).label,
    emoji: relationOf(c).emoji,
    partnerName: personOf(c)?.name,
    partnerId: c.partnerId,
    color: personOf(c)?.color,
    short: personOf(c)?.short ?? '⏳',
  }))
  const openSelection = selection.filter((id) => !closed.has(id))
  const defaultCoupleId =
    (single && !closed.has(single.id) ? single.id : null) ??
    openSelection.find((id) => byId[id]?.partnerId) ??
    openSelection[0] ??
    all.find((c) => !closed.has(c.id))?.id
  // People picked one by one in the people bar ("Tümü" is not a choice of guests).
  const chosenGuests = chosen.filter((id) => byId[id]?.partnerId && !closed.has(id))
  // Selected people whose calendar is read-only, for the notice under the people bar.
  const lockedHere = selection.filter((id) => closed.has(id) && byId[id]?.partnerId)

  // Plans that clash with a plan being made: mine, and what I can see of the people I am inviting.
  const conflictsFor = (when, coupleIds, editingId) =>
    findConflicts({
      when,
      inviteeIds: coupleIds.map((id) => byId[id]?.partnerId).filter(Boolean),
      editingId,
      events: withPartner,
      sharedPlans,
      partnerOf: (coupleId) => byId[coupleId]?.partnerId,
      members,
      me: userId,
    })

  function selectDay(day) {
    setSelected(day)
    setMonth(startOfMonth(day))
  }

  function changeView(next) {
    setView(next)
    remember(VIEW_KEY, next)
  }

  // Actions ------------------------------------------------------------------------

  // Why a plan cannot be added: the subscription offer, or (for a subscriber) choosing who it covers.
  function showPaywall(coupleId = null) {
    if (billing?.subscribed) {
      setSheet({ type: 'settings' })
      setToast(
        t(
          `Aboneliğin en fazla ${billing.max} kişiyi kapsar; kimleri kapsayacağını buradan seç`,
          `Your subscription covers up to ${billing.max} people; choose who here`,
        ),
      )
      return
    }
    const person = personOf(byId[coupleId])
    setSheet({
      type: 'paywall',
      reason: person
        ? t(
            `${person.name} ile takviminiz salt okunur. Biriniz UsDay+’a geçince ikiniz de devam edersiniz; planlarınız yerinde duruyor.`,
            `Your calendar with ${person.name} is read-only. Once one of you gets UsDay+, you can both carry on; your plans are all still there.`,
          )
        : t(
            'Yeni plan eklemek için UsDay+’a geç. Bağlandığın biri abone olursa sen ayrıca ödemezsin.',
            'Get UsDay+ to add new plans. If someone you’re connected with subscribes, you don’t pay separately.',
          ),
    })
  }

  // While billing is on, a plan needs a connection someone pays for.
  function canPlan(coupleId) {
    if (!closed.size) return true
    const ok = coupleId ? !closed.has(coupleId) : all.some((c) => !closed.has(c.id))
    if (!ok) showPaywall(coupleId ?? (lockedHere.length === 1 ? lockedHere[0] : null))
    return ok
  }

  async function handleSave(form) {
    try {
      await savePlan(form)
    } catch (err) {
      // The connection closed while the form was open (a subscription ended): say why instead.
      if (!billing?.enabled || !['42501', 'PGRST116'].includes(err?.code)) throw err
      refreshBilling()
      showPaywall(form.coupleIds.length === 1 ? form.coupleIds[0] : null)
    }
  }

  async function savePlan(form) {
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
        const n = guestIds.length
        setToast(
          hiddenFrom.length
            ? t(`🎁 Grup sürprizi hazır, ${targets} sadece ipucunu görecek`, `🎁 Group surprise ready, ${targets} will only see the hint`)
            : t(`👥 ${n} kişiye davet gitti`, `👥 Invitation sent to ${n} ${n === 1 ? 'person' : 'people'}`),
        )
      }
      reload()
      return
    }

    const coupleId = form.coupleIds[0]
    const connection = byId[coupleId]
    const partner = personOf(connection)
    const id = await saveEvent(form, coupleId, sheet.event, connection?.partnerId)
    // A surprise made from someone's wish quietly claims that wish.
    if (sheet.fromWish && form.surprise) {
      // Tell the others only if I had not already said I am getting it.
      const already = wishes.find((w) => w.id === sheet.fromWish)?.claim?.mine
      await claimWish(sheet.fromWish, id, !already).catch(() => {})
    }
    setSheet(null)
    if (sheet.fromWish) setTab('takvim')
    if (!selection.includes(coupleId)) choose([...selection, coupleId])
    selectDay(parseISO(form.date))
    const asking = form.propose && partner
    if (!sheet.event || asking) {
      if (partner) notifyPartner(id)
      setToast(
        asking
          ? t(`📨 ${dative(partner.name)} soruldu, yanıtını bildireceğiz`, `📨 Asked ${partner.name}, we’ll let you know the answer`)
          : form.surprise
            ? t(
                `🎁 Sürpriz eklendi, ${partner?.name ?? 'o'} sadece ipucunu görecek`,
                `🎁 Surprise added, ${partner?.name ?? 'they'} will only see the hint`,
              )
            : t('✨ Ortak takvime eklendi', '✨ Added to your shared calendar'),
      )
    }
    reload()
  }

  // scope 'one' drops just the opened day of a repeating plan.
  async function handleDelete(scope) {
    try {
      if (scope === 'one') {
        await skipOccurrence(sheet.occurrence)
        setToast(t('🗓️ Sadece o gün silindi', '🗓️ Only that day was deleted'))
      } else {
        await deleteEvent(sheet.event)
      }
      setSheet(null)
      reload()
    } catch {
      setToast(t('Silinemedi, tekrar dener misin?', 'Couldn’t delete. Try again?'))
    }
  }

  async function handleCover(dataUrl) {
    try {
      await setCover(single, dataUrl)
      reload()
    } catch {
      setToast(t('Fotoğraf yüklenemedi', 'Couldn’t upload the photo'))
    }
  }

  const connectionActions = {
    onRelation: async (c, relation) => {
      try {
        await setRelation(c.id, relation)
        reload()
      } catch {
        setToast(t('Kaydedilemedi, tekrar dener misin?', 'Couldn’t save. Try again?'))
      }
    },
    onSince: async (c, date) => {
      try {
        await setTogetherSince(c.id, date)
        setToast(date ? t('💜 Tarih kaydedildi', '💜 Date saved') : t('Tarih kaldırıldı', 'Date removed'))
        reload()
      } catch {
        setToast(t('Kaydedilemedi, tekrar dener misin?', 'Couldn’t save. Try again?'))
      }
    },
    onCancel: async (c) => {
      if (!window.confirm(t('Bu davet iptal edilsin mi? Kod artık çalışmayacak.', 'Cancel this invitation? The code will stop working.'))) return
      try {
        await cancelConnection(c.id)
        setToast(t('Davet iptal edildi', 'Invitation cancelled'))
        reload()
      } catch {
        setToast(t('İptal edilemedi. Bu bağlantıda plan varsa önce onları sil.', 'Couldn’t cancel. If this connection has plans, delete them first.'))
      }
    },
    onReport: (connection, person) => setSheet({ type: 'report', connection, person }),
    onRemove: (connection, person) => setSheet({ type: 'remove', connection, person }),
  }

  const openForm = (preset) => canPlan(preset?.coupleId) && setSheet({ type: 'form', preset })

  // A birthday becomes a surprise: with that person (hidden from them), or a group surprise if more
  // people are added in the form.
  function planBirthday(personId, date) {
    const person = members[personId] ?? UNKNOWN_PERSON
    openForm({
      title: `🎂 ${possessive(person.name)} ${t('doğum günü', 'birthday')}`,
      date,
      tag: 'ozel',
      surprise: true,
      revealOn: date,
      coupleId: all.find((c) => c.partnerId === personId)?.id,
      hiddenFrom: [personId],
    })
  }

  function showWishes(personId) {
    setSheet(null)
    setWishFocus(personId === userId ? null : personId)
    setTab('dilekler')
    window.scrollTo(0, 0)
  }

  async function saveBirthday(mmdd) {
    await setBirthday(userId, mmdd)
    setSheet((s) => (s?.type === 'birthday' ? null : s))
    setToast(t('🎂 Doğum günün kaydedildi', '🎂 Your birthday is saved'))
    reload()
  }

  // A wish becomes a plan: the owner plans it openly, others as a surprise (asking first).
  function planFromWish(wish, surprise) {
    const extra = [wish.note, wish.link, wish.price && `💸 ${wish.price}`].filter(Boolean).join('\n')
    const withOwner = all.find((c) => c.partnerId === wish.owner)
    if (!canPlan(wish.owner === userId ? defaultCoupleId : withOwner?.id)) return
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
    setToast(sheet.wish ? t('Dilek güncellendi', 'Wish updated') : t('✨ Dilek listene eklendi', '✨ Added to your wish list'))
    reload()
  }

  async function handleWishDelete() {
    if (!window.confirm(t('Bu dilek silinsin mi?', 'Delete this wish?'))) return
    try {
      await deleteWish(sheet.wish)
      setSheet(null)
      reload()
    } catch {
      setToast(t('Silinemedi, tekrar dener misin?', 'Couldn’t delete. Try again?'))
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
        aria-label={unread ? t(`Bildirimler, ${unread} okunmamış`, `Notifications, ${unread} unread`) : t('Bildirimler', 'Notifications')}
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <button className="cover-photo-btn cover-icon" onClick={() => setSheet({ type: 'settings' })} aria-label={t('Ayarlar', 'Settings')}>
        <Settings size={18} aria-hidden="true" />
      </button>
    </span>
  )

  const card = (e, showDate) => (
    <EventCard
      key={e.id}
      event={e}
      members={members}
      isNew={isNew(e)}
      withWhom={withWhom(e)}
      me={userId}
      showDate={showDate}
      onClick={() => openDetail(e)}
    />
  )

  const peopleBar = (
    <PeopleBar
      connections={all}
      members={members}
      selected={selection}
      locked={closed}
      onChange={choose}
      onAdd={() => setSheet({ type: 'addPerson' })}
    />
  )

  const openDetail = (event) => setSheet({ type: 'detail', event })
  // A two-person plan in a connection nobody pays for: no new comments.
  const isLocked = (e) => Boolean(e.coupleId && !e.guests && !e.shared && !e.milestone && !e.birthday && closed.has(e.coupleId))

  if (!connections) return <div className="splash">UsDay</div>

  const welcomeIdeas = templatesFor('date', single?.relation ?? 'partner').items.slice(0, 6)
  // Wishes have their own "whose list" choice: everyone I am connected with, whatever is picked above.
  const wishPeople = [...new Set(linked.map((c) => c.partnerId))].map((id) => ({ ...(members[id] ?? UNKNOWN_PERSON), id }))
  const waiting = invitedMe.length + waitingForMe.length + pending.length
  const me = members[userId]
  // Birthdays of the selected people in the next 30 days: time to plan something.
  const birthdaysSoon = [...new Set(linked.filter((c) => selection.includes(c.id)).map((c) => c.partnerId))]
    .map((id) => members[id])
    .filter((p) => p?.birthday)
    .map((person) => {
      const date = nextBirthday(person.birthday, todayKey)
      return { person, date, days: daysUntil(todayKey, date) }
    })
    .filter((b) => b.days <= 30)
    .sort((a, b) => a.days - b.days)

  // First steps while nobody has joined: the calendar is ready when they arrive.
  const startSteps = [
    {
      id: 'birthday',
      title: t('Doğum gününü ekle', 'Add your birthday'),
      hint: t('Sevdiklerine bir ay önceden hatırlatılır.', 'Your people get a reminder a month before.'),
      done: Boolean(me?.birthday),
    },
    {
      id: 'invite',
      title: t('Davet linkini gönder', 'Send your invite link'),
      hint: t('Sevgilin, ailen, kardeşin ya da arkadaşın.', 'To your partner, family, sibling or a friend.'),
      done: inviteSent,
    },
    {
      id: 'plan',
      title: t('İlk planını ekle', 'Add your first plan'),
      hint: t('Katıldığında takvimde hazır bulur.', 'It’ll be waiting in the calendar when they join.'),
      done: events.some((e) => e.createdBy === userId),
      action: () => openForm(),
      actionLabel: t('Plan ekle', 'Add plan'),
    },
    {
      id: 'wish',
      title: t('Dilek listene bir şey ekle', 'Add something to your wish list'),
      hint: t('Sana hediye düşünenlere ipucu olur.', 'A hint for anyone thinking of a gift for you.'),
      done: wishes.some((w) => w.owner === userId),
      action: () => setSheet({ type: 'wishForm' }),
      actionLabel: t('Dilek ekle', 'Add wish'),
    },
  ]

  return (
    <div className="app has-tabbar">
      {tab === 'dilekler' ? (
        <WishesView
          key={wishFocus ?? 'mine'}
          initialWhose={wishFocus}
          wishes={wishes}
          me={userId}
          people={wishPeople}
          onOpen={(wish) => setSheet({ type: 'wishDetail', wish })}
          onAdd={() => setSheet({ type: 'wishForm' })}
          header={
            <header className="page-head">
              <h1>{t('Dilekler', 'Wishes')}</h1>
              {headerButtons}
            </header>
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

            {lockedHere.length > 0 && (
              <section className="notice card readonly-card">
                <span className="notice-icon">
                  <Lock size={18} aria-hidden="true" />
                </span>
                <span>
                  <strong>
                    {lockedHere.length > 3
                      ? t(`${lockedHere.length} kişiyle takvimin salt okunur`, `Your calendar with ${lockedHere.length} people is read-only`)
                      : t(
                          `${listNames(lockedHere.map((id) => personOf(byId[id]).name))} ile takviminiz salt okunur`,
                          `Your calendar with ${listNames(lockedHere.map((id) => personOf(byId[id]).name))} is read-only`,
                        )}
                  </strong>
                  <small>
                    {billing.subscribed
                      ? t('Aboneliğine eklersen yeniden plan ekleyebilirsiniz.', 'Add them to your subscription to plan together again.')
                      : t(
                          'Planlarınız yerinde duruyor. Biriniz UsDay+’a geçince yeni plan ve yorum ekleyebilirsiniz.',
                          'Your plans are still there. Once one of you gets UsDay+, you can add plans and comments again.',
                        )}
                  </small>
                  <span className="birthday-actions">
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() => showPaywall(lockedHere.length === 1 ? lockedHere[0] : null)}
                    >
                      {billing.subscribed ? t('Aboneliğime ekle', 'Add to my subscription') : t('UsDay+’a bak', 'See UsDay+')}
                    </button>
                  </span>
                </span>
              </section>
            )}

            <NotificationCard partnerName={personOf(single)?.name} onToast={setToast} />

            {waiting > 0 && (
              <section className="waiting">
                <h2 className="section-title">{t('Seni bekleyenler', 'Waiting for you')}</h2>
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
                    onRelation={(relation) => connectionActions.onRelation(c, relation)}
                    onShared={() => {
                      setInviteSent(true)
                      remember(INVITE_SENT_KEY, true)
                    }}
                    showJoin={all.length === 1}
                    onToast={setToast}
                    onJoined={(id) => connectionReady(id, t('💜 Ortak takviminiz açıldı!', '💜 Your shared calendar is ready!'))}
                  />
                ))}

                {pending.length > 0 && <StartGuide steps={startSteps} />}
              </section>
            )}

            {birthdaysSoon.length > 0 && (
              <section className="waiting">
                <h2 className="section-title">{t('Yaklaşan doğum günleri', 'Upcoming birthdays')}</h2>
                {birthdaysSoon.map(({ person, date, days }) => (
                  <section key={person.id} className="notice card birthday-card">
                    <span className="notice-icon">
                      <Cake size={20} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>
                        {possessive(person.name)} {t('doğum günü', 'birthday')}
                      </strong>
                      <small>
                        {days === 0 ? t('Bugün', 'Today') : days === 1 ? t('Yarın', 'Tomorrow') : t(`${days} gün sonra`, `In ${days} days`)} ·{' '}
                        {dateText(date, 'd MMMM EEEE', 'EEEE, MMMM d')}
                      </small>
                      <span className="birthday-actions">
                        <button className="btn btn-primary btn-small" onClick={() => planBirthday(person.id, date)}>
                          {t('Sürpriz planla', 'Plan a surprise')}
                        </button>
                        <button className="btn btn-secondary btn-small" onClick={() => showWishes(person.id)}>
                          {t('Dileklerine bak', 'See their wishes')}
                        </button>
                      </span>
                    </span>
                  </section>
                ))}
              </section>
            )}

            {linked.length > 0 && shown.filter((e) => !e.milestone && !e.birthday).length === 0 && (
              <section className="welcome card">
                <strong>{t('UsDay’e hoş geldin', 'Welcome to UsDay')}</strong>
                <small>{t('İlk planı ekle; bir fikre dokunman yeterli.', 'Add your first plan: just tap an idea.')}</small>
                <div className="templates">
                  {welcomeIdeas.map((idea) => (
                    <button key={idea.title} className="chip" onClick={() => openForm({ ...idea, tag: 'date' })}>
                      {idea.title}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {todayEvents.length > 0 && (
              <section className="agenda">
                <h2 className="section-title">
                  {t('Bugün', 'Today')} <small>{dateText(new Date(), 'd MMMM EEEE', 'EEEE, MMMM d')}</small>
                </h2>
                <div className="event-list">{todayEvents.map((e) => card(e, false))}</div>
              </section>
            )}

            {upcoming.length > 0 && (
              <section className="agenda">
                <h2 className="section-title">{t('Yaklaşanlar', 'Coming up')}</h2>
                <div className="event-list">{upcoming.map((e) => card(e, true))}</div>
              </section>
            )}

            <div className="segmented view-switch" role="group" aria-label={t('Takvim görünümü', 'Calendar view')}>
              <button className={view === 'month' ? 'is-active' : ''} aria-pressed={view === 'month'} onClick={() => changeView('month')}>
                {t('Ay', 'Month')}
              </button>
              <button className={view === 'week' ? 'is-active' : ''} aria-pressed={view === 'week'} onClick={() => changeView('week')}>
                {t('Hafta', 'Week')}
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

            {(selectedKey !== todayKey || !todayEvents.length) && (
              <section className="agenda">
                <h2 className="section-title">
                  {selectedKey === todayKey ? t('Bugün', 'Today') : dateText(selected, 'd MMMM, EEEE', 'EEEE, MMMM d')}
                </h2>
                {dayEvents.length ? (
                  <div className="event-list">{dayEvents.map((e) => card(e, false))}</div>
                ) : (
                  <button className="empty" onClick={() => openForm()}>
                    {t('Bu gün boş. Plan ekle', 'Nothing on this day. Add a plan')}
                  </button>
                )}
              </section>
            )}

            {sharedUpcoming.length > 0 && (
              <section className="agenda">
                <h2 className="section-title">
                  {sharedOwners.length === 1
                    ? t(
                        `${genitive((members[sharedOwners[0]] ?? UNKNOWN_PERSON).name)} takviminden`,
                        `From ${(members[sharedOwners[0]] ?? UNKNOWN_PERSON).name}’s calendar`,
                      )
                    : t('Paylaşılan takvimlerden', 'From shared calendars')}
                </h2>
                <div className="event-list">
                  {sharedUpcoming.map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      members={members}
                      withWhom={sharedOwners.length === 1 ? null : withWhom(e)}
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

      <TabBar
        tab={tab}
        onChange={(next) => {
          setTab(next)
          window.scrollTo(0, 0)
        }}
        onAdd={() => (tab === 'dilekler' ? setSheet({ type: 'wishForm' }) : openForm())}
        addLabel={tab === 'dilekler' ? t('Dilek ekle', 'Add wish') : t('Plan ekle', 'Add plan')}
      />

      {sheet && (
        <Sheet onClose={() => setSheet(null)}>
          {sheet.type === 'addPerson' ? (
            <AddPersonSheet
              invites={openInvites}
              initialMode={sheet.mode}
              onToast={setToast}
              onCreated={(id) => connectionReady(id, t('💌 Davet kodun hazır, gönderebilirsin', '💌 Your invite code is ready to send'))}
              onJoined={(id) => connectionReady(id, t('💜 Ortak takviminiz açıldı!', '💜 Your shared calendar is ready!'))}
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
              onOpenLink={(url) => {
                setSheet(null)
                openLink(url)
              }}
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
              connection={sheet.connection}
              person={sheet.person}
              onDone={(message) => {
                closeWith(message)
                reload()
              }}
              onCancel={() => setSheet({ type: 'settings' })}
              onToast={setToast}
            />
          ) : sheet.type === 'remove' ? (
            <RemoveConnectionSheet
              connection={sheet.connection}
              person={sheet.person}
              planCount={events.filter((e) => e.coupleId === sheet.connection.id).length}
              onDone={(message) => {
                closeWith(message)
                reload()
              }}
              onCancel={() => setSheet({ type: 'settings' })}
              onToast={setToast}
            />
          ) : sheet.type === 'admin' ? (
            <AdminPanel initialSection={sheet.section} onClose={() => setSheet(null)} onToast={setToast} />
          ) : sheet.type === 'paywall' ? (
            <PaywallSheet
              reason={sheet.reason}
              max={billing?.max}
              onHaveCode={() => setSheet({ type: 'addPerson', mode: 'join' })}
              onClose={() => setSheet(null)}
            />
          ) : sheet.type === 'birthday' ? (
            <BirthdaySheet current={me?.birthday ?? ''} onSave={saveBirthday} onClose={() => setSheet(null)} />
          ) : sheet.type === 'settings' ? (
            <SettingsSheet
              me={members[userId]}
              admin={admin}
              shares={shares}
              onSharesChanged={() => reload()}
              onFeedback={() => setSheet({ type: 'feedback' })}
              onAdmin={() => setSheet({ type: 'admin', section: 'overview' })}
              onBirthday={() => setSheet({ type: 'birthday' })}
              billing={billing}
              onBillingChanged={refreshBilling}
              onPaywall={() => showPaywall()}
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
              defaultCoupleIds={chosenGuests}
              findConflicts={conflictsFor}
              defaultCoupleId={defaultCoupleId}
              onAddTemplate={async (template) => {
                await addTemplate(template)
                setToast(t('✨ Şablon eklendi', '✨ Template added'))
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
              focusChat={sheet.focusChat}
              focusAbout={sheet.focusAbout}
              me={userId}
              members={members}
              withWhom={withWhom(sheet.event)}
              onPlanBirthday={planBirthday}
              onShowWishes={showWishes}
              readOnly={isLocked(sheet.event)}
              onPaywall={() => showPaywall(sheet.event.coupleId)}
              onEdit={() =>
                // The form edits the whole series from its first day; the opened day is kept for "sadece bu günü sil".
                canPlan(sheet.event.coupleId) &&
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

      {/* Everyone gives their birthday once; until then this stays on top. */}
      {me && !me.birthday && (
        <Sheet locked onClose={() => {}}>
          <BirthdaySheet required onSave={saveBirthday} />
        </Sheet>
      )}

      {toast && (
        <div className="toast" aria-hidden="true">
          {toast}
        </div>
      )}
      {/* Read out by screen readers; always present so the change is announced. */}
      <div className="visually-hidden" role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  )
}
