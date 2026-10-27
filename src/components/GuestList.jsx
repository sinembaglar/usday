import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { UNKNOWN_PERSON } from '../lib/constants'
import { answerInvitation, moveGroupPlan } from '../lib/api'
import { notifyAnswer } from '../lib/push'

const MARK = { maker: '⭐', pending: '⏳', accepted: '✅', maybe: '🤔', suggested: '🕐', declined: '❌' }
const STATUS_WORD = { maybe: 'belki', suggested: 'başka zaman öneriyor', declined: 'katılamıyor' }

const whenOf = ({ date, time }) =>
  [format(parseISO(date), 'd MMMM EEEE', { locale: tr }), time].filter(Boolean).join(' · ')

// Who is on a group plan and what they said. The maker can move the plan to a suggested time.
export function GuestList({ event, members, me, onMoved, onToast }) {
  const [moving, setMoving] = useState(null)
  const people = [{ id: event.createdBy, status: 'maker', note: '' }, ...event.guests]
  const isMaker = event.createdBy === me

  async function move(guest) {
    const name = (members[guest.id] ?? UNKNOWN_PERSON).name
    if (!window.confirm(`Plan ${whenOf(guest.suggested)} zamanına taşınsın mı? Herkese yeniden sorulur, ${name} katılıyor sayılır.`)) return
    setMoving(guest.id)
    try {
      await moveGroupPlan(event.seriesId ?? event.id, guest.suggested.date, guest.suggested.time, guest.id)
      onToast('🕐 Plan taşındı, herkese yeniden soruldu')
      onMoved()
    } catch {
      onToast('Taşınamadı, tekrar dener misin?')
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
            <span>
              {person.name}
              {g.status === 'maker' && <small> · planlayan</small>}
              {STATUS_WORD[g.status] && <small> · {STATUS_WORD[g.status]}</small>}
              {event.hiddenFrom?.includes(g.id) && <small> · 🎯 sürpriz onun için</small>}
              {g.note && <small> · “{g.note}”</small>}
              {g.suggested && (
                <span className="guest-suggestion">
                  🕐 {whenOf(g.suggested)} olur mu?
                  {isMaker && (
                    <button className="link-btn" disabled={moving === g.id} onClick={() => move(g)}>
                      Bu zamana taşı
                    </button>
                  )}
                </span>
              )}
            </span>
            <span className="guest-mark" title={g.status}>
              {MARK[g.status]}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

const CHOICES = [
  { status: 'accepted', label: '✅ Katılıyorum' },
  { status: 'maybe', label: '🤔 Belki' },
  { status: 'suggested', label: '🕐 Başka zaman' },
  { status: 'declined', label: '❌ Katılamıyorum' },
]

const PLACEHOLDER = {
  accepted: 'Kısa bir not (isteğe bağlı) — örn. biraz geç gelirim',
  maybe: 'Kısa bir not (isteğe bağlı) — örn. işten çıkabilirsem',
  suggested: 'Kısa bir not (isteğe bağlı) — örn. hafta sonu daha rahatım',
  declined: 'Kısa bir not (isteğe bağlı) — örn. o gün şehir dışındayım',
}

const TOAST = {
  accepted: '✅ Katılıyorsun, haber verdik',
  maybe: '🤔 “Belki” dedin, haber verdik',
  suggested: '🕐 Önerin planlayana iletildi',
  declined: '❌ Yanıtın iletildi',
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
      onToast('Yanıt gönderilemedi, tekrar dener misin?')
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
            Geri
          </button>
          <button className="btn btn-primary" disabled={busy || !suggested.date || unchanged} onClick={() => answer(choice)}>
            Gönder
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
          className={`btn ${mine.status === c.status ? 'btn-primary' : 'btn-ghost bordered'}`}
          disabled={busy || (mine.status === c.status && c.status === 'accepted')}
          onClick={() => (c.status === 'accepted' ? answer('accepted') : setChoice(c.status))}
        >
          {c.label}
        </button>
      ))}
      {mine.status === 'accepted' && (
        <button className="link-btn answer-note" onClick={() => setChoice('accepted')}>
          Not ekle
        </button>
      )}
    </div>
  )
}
