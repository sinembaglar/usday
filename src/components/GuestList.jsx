import { useState } from 'react'
import { format } from 'date-fns'
import { Check, CircleHelp, Clock, X } from 'lucide-react'
import { UNKNOWN_PERSON } from '../lib/constants'
import { answerInvitation, moveGroupPlan } from '../lib/api'
import { notifyAnswer } from '../lib/push'
import { dateText, t } from '../lib/i18n'

// Each answer as a word in its own colour (not an emoji): who is coming is readable at a glance.
const STATUS = {
  maker: { word: t('Planlayan', 'Host'), tone: 'maker' },
  pending: { word: t('Bekleniyor', 'Waiting'), tone: 'wait' },
  accepted: { word: t('Geliyor', 'Going'), tone: 'ok' },
  maybe: { word: t('Belki', 'Maybe'), tone: 'maybe' },
  suggested: { word: t('Başka zaman', 'Another time'), tone: 'maybe' },
  declined: { word: t('Gelemiyor', 'Can’t go'), tone: 'no' },
}

const whenOf = ({ date, time }) =>
  [dateText(date, 'd MMMM EEEE', 'EEEE, MMMM d'), time].filter(Boolean).join(' · ')

// Who is on a group plan and what they said. The maker can move the plan to a suggested time.
export function GuestList({ event, members, me, onMoved, onToast }) {
  const [moving, setMoving] = useState(null)
  const people = [{ id: event.createdBy, status: 'maker', note: '' }, ...event.guests]
  const isMaker = event.createdBy === me

  async function move(guest) {
    const name = (members[guest.id] ?? UNKNOWN_PERSON).name
    const when = whenOf(guest.suggested)
    const question = t(
      `Plan ${when} zamanına taşınsın mı? Herkese yeniden sorulur, ${name} katılıyor sayılır.`,
      `Move the plan to ${when}? Everyone is asked again, and ${name} counts as going.`,
    )
    if (!window.confirm(question)) return
    setMoving(guest.id)
    try {
      await moveGroupPlan(event.seriesId ?? event.id, guest.suggested.date, guest.suggested.time, guest.id)
      onToast(t('🕐 Plan taşındı, herkese yeniden soruldu', '🕐 Plan moved; everyone was asked again'))
      onMoved()
    } catch {
      onToast(t('Taşınamadı, tekrar dener misin?', 'Couldn’t move it. Try again?'))
      setMoving(null)
    }
  }

  return (
    <ul className="guest-list">
      {people.map((g) => {
        const person = members[g.id] ?? UNKNOWN_PERSON
        return (
          <li key={g.id}>
            <span className="avatar small" style={{ background: person.color }}>
              {person.short}
            </span>
            <span className="guest-name">
              {person.name}
              {event.hiddenFrom?.includes(g.id) && <small> · {t('sürpriz onun için', 'the surprise is for them')}</small>}
              {g.note && <small className="guest-note">“{g.note}”</small>}
              {g.suggested && (
                <span className="guest-suggestion">
                  {t(`${whenOf(g.suggested)} olur mu?`, `How about ${whenOf(g.suggested)}?`)}
                  {isMaker && (
                    <button className="link-btn" disabled={moving === g.id} onClick={() => move(g)}>
                      {t('Bu zamana taşı', 'Move to this time')}
                    </button>
                  )}
                </span>
              )}
            </span>
            <span className={`status-pill is-${STATUS[g.status]?.tone ?? 'wait'}`}>{STATUS[g.status]?.word}</span>
          </li>
        )
      })}
    </ul>
  )
}

const CHOICES = [
  { status: 'accepted', label: t('Katılıyorum', 'I’m going'), Icon: Check },
  { status: 'maybe', label: t('Belki', 'Maybe'), Icon: CircleHelp },
  { status: 'suggested', label: t('Başka zaman', 'Another time'), Icon: Clock },
  { status: 'declined', label: t('Katılamıyorum', 'Can’t go'), Icon: X },
]

const PLACEHOLDER = {
  accepted: t('Not ekle (örn. biraz geç gelirim)', 'Add a note (e.g. I’ll be a bit late)'),
  maybe: t('Not ekle (örn. işten çıkabilirsem)', 'Add a note (e.g. if I can leave work in time)'),
  suggested: t('Not ekle (örn. hafta sonu daha rahatım)', 'Add a note (e.g. weekends are easier for me)'),
  declined: t('Not ekle (örn. o gün şehir dışındayım)', 'Add a note (e.g. I’m out of town that day)'),
}

const TOAST = {
  accepted: t('✅ Katılıyorsun, haber verdik', '✅ You’re going. We let them know'),
  maybe: t('🤔 “Belki” dedin, haber verdik', '🤔 You said “maybe”. We let them know'),
  suggested: t('🕐 Önerin planlayana iletildi', '🕐 Your suggestion went to the host'),
  declined: t('❌ Yanıtın iletildi', '❌ Your answer was sent'),
}

// My answer to a group plan; it can be changed later. "Katılıyorum" goes in one tap; the others
// open a note (and, for another time, a date and time) first.
export function InvitationActions({ event, me, onAnswered, onToast }) {
  const mine = event.guests.find((g) => g.id === me)
  const [choice, setChoice] = useState(null)
  const [note, setNote] = useState('')
  const [suggested, setSuggested] = useState({ date: event.date, time: event.time ?? '' })
  const [busy, setBusy] = useState(false)
  if (!mine) return null

  async function answer(status) {
    setBusy(true)
    try {
      await answerInvitation(
        event.seriesId ?? event.id,
        status,
        status === 'accepted' && !choice ? null : note.trim() || null,
        status === 'suggested' ? suggested : null,
      )
      notifyAnswer(event.seriesId ?? event.id)
      onToast(TOAST[status])
      onAnswered()
    } catch {
      onToast(t('Yanıt gönderilemedi, tekrar dener misin?', 'Couldn’t send your answer. Try again?'))
      setBusy(false)
    }
  }

  if (choice) {
    const unchanged =
      choice === 'suggested' && suggested.date === event.date && (suggested.time || '') === (event.time || '')
    return (
      <div className="proposal-actions">
        <strong className="answer-title">{CHOICES.find((c) => c.status === choice).label}</strong>
        {choice === 'suggested' && (
          <div className="row">
            <input
              className="input"
              type="date"
              min={format(new Date(), 'yyyy-MM-dd')}
              value={suggested.date}
              onChange={(e) => setSuggested((s) => ({ ...s, date: e.target.value }))}
            />
            <input
              className="input"
              type="time"
              value={suggested.time}
              onChange={(e) => setSuggested((s) => ({ ...s, time: e.target.value }))}
            />
          </div>
        )}
        <input
          className="input"
          placeholder={PLACEHOLDER[choice]}
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="proposal-buttons">
          <button className="btn btn-ghost" disabled={busy} onClick={() => setChoice(null)}>
            {t('Geri', 'Back')}
          </button>
          <button className="btn btn-primary" disabled={busy || !suggested.date || unchanged} onClick={() => answer(choice)}>
            {t('Gönder', 'Send')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="answer-grid">
      {CHOICES.map((c) => (
        <button
          key={c.status}
          className={`btn ${mine.status === c.status ? 'btn-primary' : 'btn-secondary'}`}
          disabled={busy || (mine.status === c.status && c.status === 'accepted')}
          onClick={() => (c.status === 'accepted' ? answer('accepted') : setChoice(c.status))}
        >
          <c.Icon size={16} aria-hidden="true" /> {c.label}
        </button>
      ))}
      {mine.status === 'accepted' && (
        <button className="link-btn answer-note" onClick={() => setChoice('accepted')}>
          {t('Not ekle', 'Add a note')}
        </button>
      )}
    </div>
  )
}
