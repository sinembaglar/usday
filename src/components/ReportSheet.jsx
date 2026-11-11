import { useState } from 'react'
import { removeConnection, reportPerson } from '../lib/api'
import { dative } from '../lib/format'
import { t } from '../lib/i18n'

export const REPORT_REASONS = {
  harassment: t('😟 Rahatsız edici davranış', '😟 Harassment or bullying'),
  inappropriate: t('🔞 Uygunsuz içerik ya da fotoğraf', '🔞 Inappropriate content or photo'),
  spam: t('🤖 Spam ya da sahte hesap', '🤖 Spam or a fake account'),
  other: t('💬 Diğer', '💬 Other'),
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
      onDone(
        block
          ? t(`🚩 Şikayetin alındı, ${person.name} engellendi`, `🚩 Report received, ${person.name} is blocked`)
          : t('🚩 Şikayetin alındı, en kısa sürede inceleyeceğiz', '🚩 Report received. We’ll look at it as soon as we can'),
      )
    } catch {
      setBusy(false)
      onToast(t('Gönderilemedi, tekrar dener misin?', 'Couldn’t send. Try again?'))
    }
  }

  return (
    <form className="settings" onSubmit={submit}>
      <h3>🚩 {t(`${person.name} hakkında şikayet`, `Report ${person.name}`)}</h3>
      <p className="hint">
        {t(
          `Şikayetini sadece uygulamanın yöneticisi görür; ${dative(person.name)} haber verilmez. Gerekirse hesabı engellenir.`,
          `Only the app’s team sees your report; ${person.name} is not told. If needed, their account is blocked.`,
        )}
      </p>
      <div className="chips report-reasons" role="radiogroup" aria-label={t('Sebep', 'Reason')}>
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
        placeholder={t('Ne oldu? (isteğe bağlı)', 'What happened? (optional)')}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {connection && (
        <label className="check-row">
          <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
          <span>
            <strong>{t('🚫 Ayrıca engelle ve bağlantıyı kaldır', '🚫 Also block them and remove the connection')}</strong>
            <small>
              {t(
                'Bu bağlantıdaki planlar ve fotoğraflar ikiniz için de silinir; sana tekrar bağlanamaz.',
                'The plans and photos in this connection are deleted for both of you, and they can’t connect with you again.',
              )}
            </small>
          </span>
        </label>
      )}
      <p className="hint">
        {t('Acil bir tehlike varsa lütfen 112’yi ara.', 'If someone is in immediate danger, call your local emergency number.')}
      </p>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t('Vazgeç', 'Cancel')}
        </button>
        <button className="btn btn-primary" disabled={busy || !reason}>
          {busy ? t('Gönderiliyor…', 'Sending…') : t('Şikayet et', 'Report')}
        </button>
      </div>
    </form>
  )
}
