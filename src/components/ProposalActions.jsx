import { useState } from 'react'
import { Check } from 'lucide-react'
import { respondToPlan } from '../lib/api'
import { notifyAnswer } from '../lib/push'

// The asked person's answer: yes, no (with an optional note), or another time.
export default function ProposalActions({ event, onAnswered, onToast }) {
  const [mode, setMode] = useState(null) // null | 'decline' | 'counter'
  const [note, setNote] = useState('')
  const [date, setDate] = useState(event.seriesDate ?? event.date)
  const [time, setTime] = useState(event.time)
  const [busy, setBusy] = useState(false)

  async function answer(kind) {
    setBusy(true)
    try {
      await respondToPlan(event.seriesId ?? event.id, kind, { date, time, note: note.trim() || null })
      notifyAnswer(event.seriesId ?? event.id)
      onToast(kind === 'accept' ? '✅ Plan kesinleşti' : kind === 'decline' ? '❌ Yanıtın iletildi' : '🕐 Yeni zaman önerildi')
      onAnswered()
    } catch {
      onToast('Yanıt gönderilemedi, tekrar dener misin?')
      setBusy(false)
    }
  }

  return (
    <div className="proposal-actions">
      {mode === null && (
        <div className="proposal-buttons">
          <button className="btn btn-primary" disabled={busy} onClick={() => answer('accept')}>
            <Check size={16} aria-hidden="true" /> Uygunum
          </button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => setMode('decline')}>
            Değilim
          </button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => setMode('counter')}>
            Başka zaman
          </button>
        </div>
      )}

      {mode === 'counter' && (
        <div className="row">
          <label className="field">
            <span>Gün</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Saat</span>
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
      )}

      {mode && (
        <>
          <input
            className="input"
            placeholder={mode === 'decline' ? 'Kısa bir not (isteğe bağlı) — örn. o akşam toplantım var' : 'Not (isteğe bağlı)'}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="proposal-buttons">
            <button className="btn btn-ghost" onClick={() => setMode(null)} disabled={busy}>
              Geri
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || (mode === 'counter' && !date)}
              onClick={() => answer(mode)}
            >
              {mode === 'decline' ? 'Gönder' : 'Bu zamanı öner'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
