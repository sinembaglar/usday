import { useState } from 'react'
import { sendFeedback } from '../lib/api'

const KINDS = [
  { id: 'idea', label: '💡 Öneri' },
  { id: 'bug', label: '🐞 Hata' },
  { id: 'love', label: '💜 Beğendim' },
  { id: 'other', label: '💬 Diğer' },
]

const PLACEHOLDER = {
  idea: 'Neyi eklememizi ya da değiştirmemizi istersin?',
  bug: 'Ne oldu? Hangi ekrandaydın, neye dokundun?',
  love: 'En çok neyi seviyorsun?',
  other: 'Aklından geçeni yaz…',
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
      onDone('💜 Teşekkürler, mesajın bize ulaştı')
    } catch {
      setBusy(false)
      onToast('Gönderilemedi, tekrar dener misin?')
    }
  }

  return (
    <form className="settings" onSubmit={submit}>
      <h3>Geri bildirim</h3>
      <p className="hint">UsDay’i birlikte güzelleştirelim. Mesajını sadece uygulamanın yöneticisi okur.</p>
      <div className="chips" role="radiogroup" aria-label="Konu">
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
        <p className="hint">Hangi cihazdan yazdığın mesajına otomatik eklenir, sorunu bulmamız kolaylaşır.</p>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Vazgeç
        </button>
        <button className="btn btn-primary" disabled={busy || !message.trim()}>
          {busy ? 'Gönderiliyor…' : 'Gönder'}
        </button>
      </div>
    </form>
  )
}
