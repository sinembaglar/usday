import { useState } from 'react'
import { createConnection, joinCouple } from '../lib/api'
import { RELATIONS } from '../lib/constants'

const JOIN_ERRORS = {
  invalid_invite: 'Bu kod geçersiz ya da kullanılmış.',
  already_connected: 'Bu kişiyle zaten bağlısınız.',
}

// Add someone: open a new invitation (choosing who they are to you) or join theirs with a code.
export default function AddPersonSheet({ onCreated, onJoined, onClose }) {
  const [mode, setMode] = useState('invite') // invite | join
  const [relation, setRelation] = useState('friend')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    setBusy(true)
    setError('')
    try {
      onCreated(await createConnection(relation))
    } catch {
      setError('Oluşturulamadı, tekrar dener misin?')
      setBusy(false)
    }
  }

  async function join(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      onJoined(await joinCouple(code.trim().toUpperCase()))
    } catch (err) {
      const key = Object.keys(JOIN_ERRORS).find((k) => err.message?.includes(k))
      setError(JOIN_ERRORS[key] ?? 'Bir şeyler ters gitti, tekrar dener misin?')
      setBusy(false)
    }
  }

  return (
    <div className="settings">
      <h3>Kişi ekle</h3>

      <div className="segmented">
        <button className={mode === 'invite' ? 'is-active' : ''} onClick={() => setMode('invite')}>
          Ben davet edeyim
        </button>
        <button className={mode === 'join' ? 'is-active' : ''} onClick={() => setMode('join')}>
          Kodum var
        </button>
      </div>

      {mode === 'invite' ? (
        <section className="settings-group">
          <h4>Bu takvimi kiminle paylaşacaksın?</h4>
          <div className="categories relations" role="radiogroup" aria-label="İlişki">
            {Object.entries(RELATIONS).map(([key, r]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={relation === key}
                className={`category ${relation === key ? 'is-active' : ''}`}
                style={{ '--tag': 'var(--rose)' }}
                onClick={() => setRelation(key)}
              >
                <span>{r.emoji}</span>
                {r.label}
              </button>
            ))}
          </div>
          <p className="hint">
            Her kişiyle ayrı bir ortak takvimin olur. Birinin planlarını diğeri asla görmez; üstteki kişi çubuğundan
            istediğin kişileri birlikte de görebilirsin.
          </p>
          <button className="btn btn-primary" disabled={busy} onClick={create}>
            {busy ? 'Bir saniye…' : 'Davet kodu oluştur'}
          </button>
        </section>
      ) : (
        <form className="settings-group" onSubmit={join}>
          <h4>Sana gönderilen davet kodu</h4>
          <input
            className="input code-input"
            placeholder="Örn. K7MP2X"
            maxLength={6}
            autoCapitalize="characters"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary" disabled={busy || code.trim().length !== 6}>
            {busy ? 'Bir saniye…' : 'Bağlan'}
          </button>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Kapat
        </button>
      </div>
    </div>
  )
}
