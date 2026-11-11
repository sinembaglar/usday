import { useState } from 'react'
import { sendFeedback } from '../lib/api'
import { t } from '../lib/i18n'

const KINDS = [
  { id: 'idea', label: t('💡 Öneri', '💡 Idea') },
  { id: 'bug', label: t('🐞 Hata', '🐞 Bug') },
  { id: 'love', label: t('💜 Beğendim', '💜 Love it') },
  { id: 'other', label: t('💬 Diğer', '💬 Other') },
]

const PLACEHOLDER = {
  idea: t('Neyi eklememizi ya da değiştirmemizi istersin?', 'What should we add or change?'),
  bug: t('Ne oldu? Hangi ekrandaydın, neye dokundun?', 'What happened? Which screen were you on, what did you tap?'),
  love: t('En çok neyi seviyorsun?', 'What do you love most?'),
  other: t('Aklından geçeni yaz…', 'Tell us what’s on your mind…'),
}

export default function FeedbackSheet({ userId, onDone, onCancel, onToast }) {
  const [kind, setKind] = useState('idea')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await sendFeedback(userId, kind, message)
      onDone(t('💜 Teşekkürler, mesajın bize ulaştı', '💜 Thank you, we got your message'))
    } catch {
      setBusy(false)
      onToast(t('Gönderilemedi, tekrar dener misin?', 'Couldn’t send. Try again?'))
    }
  }

  return (
    <form className="settings" onSubmit={submit}>
      <h3>{t('Geri bildirim', 'Feedback')}</h3>
      <p className="hint">
        {t(
          'UsDay’i birlikte güzelleştirelim. Mesajını sadece uygulamanın yöneticisi okur.',
          'Help us make UsDay better. Only the app’s team reads your message.',
        )}
      </p>
      <div className="chips" role="radiogroup" aria-label={t('Konu', 'Topic')}>
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={kind === k.id}
            className={`chip ${kind === k.id ? 'is-active' : ''}`}
            style={{ '--tag': 'var(--rose)' }}
            onClick={() => setKind(k.id)}
          >
            {k.label}
          </button>
        ))}
      </div>
      <textarea
        className="input"
        rows={5}
        maxLength={2000}
        placeholder={PLACEHOLDER[kind]}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
        autoFocus
      />
      {kind === 'bug' && (
        <p className="hint">
          {t(
            'Hangi cihazdan yazdığın mesajına otomatik eklenir, sorunu bulmamız kolaylaşır.',
            'The device you’re writing from is added to your message, so we can find the problem faster.',
          )}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t('Vazgeç', 'Cancel')}
        </button>
        <button className="btn btn-primary" disabled={busy || !message.trim()}>
          {busy ? t('Gönderiliyor…', 'Sending…') : t('Gönder', 'Send')}
        </button>
      </div>
    </form>
  )
}
