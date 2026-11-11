import { useState } from 'react'
import { Check } from 'lucide-react'
import { respondToPlan } from '../lib/api'
import { notifyAnswer } from '../lib/push'
import { t } from '../lib/i18n'

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
      onToast(
        kind === 'accept'
          ? t('✅ Plan kesinleşti', '✅ It’s on!')
          : kind === 'decline'
            ? t('❌ Yanıtın iletildi', '❌ Your answer was sent')
            : t('🕐 Yeni zaman önerildi', '🕐 New time suggested'),
      )
      onAnswered()
    } catch {
      onToast(t('Yanıt gönderilemedi, tekrar dener misin?', 'Couldn’t send your answer. Try again?'))
      setBusy(false)
    }
  }

  return (
    <div className="proposal-actions">
      {mode === null && (
        <div className="proposal-buttons">
          <button className="btn btn-primary" disabled={busy} onClick={() => answer('accept')}>
            <Check size={16} aria-hidden="true" /> {t('Uygunum', 'I’m free')}
          </button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => setMode('decline')}>
            {t('Değilim', 'Can’t')}
          </button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => setMode('counter')}>
            {t('Başka zaman', 'Another time')}
          </button>
        </div>
      )}

      {mode === 'counter' && (
        <div className="row">
          <label className="field">
            <span>{t('Gün', 'Day')}</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('Saat', 'Time')}</span>
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
      )}

      {mode && (
        <>
          <input
            className="input"
            placeholder={
              mode === 'decline'
                ? t('Kısa bir not (isteğe bağlı) — örn. o akşam toplantım var', 'A short note (optional), e.g. I have a meeting that evening')
                : t('Not (isteğe bağlı)', 'Note (optional)')
            }
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="proposal-buttons">
            <button className="btn btn-ghost" onClick={() => setMode(null)} disabled={busy}>
              {t('Geri', 'Back')}
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || (mode === 'counter' && !date)}
              onClick={() => answer(mode)}
            >
              {mode === 'decline' ? t('Gönder', 'Send') : t('Bu zamanı öner', 'Suggest this time')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
