import { useState } from 'react'
import { removeConnection, reportPerson } from '../lib/api'
import { dative } from '../lib/format'

export const REPORT_REASONS = {
  harassment: '😟 Rahatsız edici davranış',
  inappropriate: '🔞 Uygunsuz içerik ya da fotoğraf',
  spam: '🤖 Spam ya da sahte hesap',
  other: '💬 Diğer',
}

// Reporting someone I am connected with. They are not told.
export default function ReportSheet({ userId, connection, person, onDone, onCancel, onToast }) {
  const [reason, setReason] = useState(null)
  const [message, setMessage] = useState('')
  const [block, setBlock] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await reportPerson(userId, person.id, reason, message)
      if (block) await removeConnection(connection.id, true)
      onDone(block ? `🚩 Şikayetin alındı, ${person.name} engellendi` : '🚩 Şikayetin alındı, en kısa sürede inceleyeceğiz')
    } catch {
      setBusy(false)
      onToast('Gönderilemedi, tekrar dener misin?')
    }
  }

  return (
    <form className="settings" onSubmit={submit}>
      <h3>🚩 {person.name} hakkında şikayet</h3>
      <p className="hint">
        Şikayetini sadece uygulamanın yöneticisi görür; {dative(person.name)} haber verilmez. Gerekirse hesabı
        engellenir.
      </p>
      <div className="chips report-reasons" role="radiogroup" aria-label="Sebep">
        {Object.entries(REPORT_REASONS).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={reason === id}
            className={`chip ${reason === id ? 'is-active' : ''}`}
            style={{ '--tag': 'var(--danger)' }}
            onClick={() => setReason(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        className="input"
        rows={4}
        maxLength={2000}
        placeholder="Ne oldu? (isteğe bağlı)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {connection && (
        <label className="check-row">
          <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
          <span>
            <strong>🚫 Ayrıca engelle ve bağlantıyı kaldır</strong>
            <small>Bu bağlantıdaki planlar ve fotoğraflar ikiniz için de silinir; sana tekrar bağlanamaz.</small>
          </span>
        </label>
      )}
      <p className="hint">Acil bir tehlike varsa lütfen 112’yi ara.</p>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Vazgeç
        </button>
        <button className="btn btn-primary" disabled={busy || !reason}>
          {busy ? 'Gönderiliyor…' : 'Şikayet et'}
        </button>
      </div>
    </form>
  )
}
