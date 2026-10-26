import { useState } from 'react'
import { UNKNOWN_PERSON } from '../lib/constants'
import { answerInvitation } from '../lib/api'
import { notifyAnswer } from '../lib/push'

const MARK = { maker: '⭐', pending: '⏳', accepted: '✅', declined: '❌' }

// Who is on a group plan and what they said.
export function GuestList({ event, members }) {
  const people = [{ id: event.createdBy, status: 'maker', note: '' }, ...event.guests]
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
              {event.hiddenFrom?.includes(g.id) && <small> · 🎯 sürpriz onun için</small>}
              {g.note && <small> · “{g.note}”</small>}
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

// My answer to a group plan; it can be changed later.
export function InvitationActions({ event, me, onAnswered, onToast }) {
  const mine = event.guests.find((g) => g.id === me)
  const [declining, setDeclining] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  if (!mine) return null

  async function answer(status) {
    setBusy(true)
    try {
      await answerInvitation(event.seriesId ?? event.id, status, status === 'declined' ? note.trim() || null : null)
      notifyAnswer(event.seriesId ?? event.id)
      onToast(status === 'accepted' ? '✅ Katılıyorsun, haber verdik' : '❌ Yanıtın iletildi')
      onAnswered()
    } catch {
      onToast('Yanıt gönderilemedi, tekrar dener misin?')
      setBusy(false)
    }
  }

  if (declining) {
    return (
      <div className="proposal-actions">
        <input
          className="input"
          placeholder="Kısa bir not (isteğe bağlı) — örn. o gün şehir dışındayım"
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="proposal-buttons">
          <button className="btn btn-ghost" disabled={busy} onClick={() => setDeclining(false)}>
            Geri
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => answer('declined')}>
            Gönder
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="proposal-buttons">
      <button
        className={`btn ${mine.status === 'accepted' ? 'btn-primary' : 'btn-ghost bordered'}`}
        disabled={busy || mine.status === 'accepted'}
        onClick={() => answer('accepted')}
      >
        ✅ Katılıyorum
      </button>
      <button
        className={`btn ${mine.status === 'declined' ? 'btn-primary' : 'btn-ghost bordered'}`}
        disabled={busy || mine.status === 'declined'}
        onClick={() => setDeclining(true)}
      >
        ❌ Katılamıyorum
      </button>
    </div>
  )
}
