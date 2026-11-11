import { useState } from 'react'
import { Send } from 'lucide-react'
import { createConnection, joinCouple } from '../lib/api'
import { RELATIONS } from '../lib/constants'
import { RELATION_ICONS } from '../lib/icons'
import { shareInvite } from '../lib/invite'
import { t } from '../lib/i18n'

const JOIN_ERRORS = {
  invalid_invite: t('Bu kod geçersiz ya da kullanılmış.', 'This code is invalid or already used.'),
  already_connected: t('Bu kişiyle zaten bağlısınız.', 'You’re already connected with this person.'),
}

// Add someone: open a new invitation (choosing who they are to you) or join theirs with a code.
// Invitations nobody has joined yet are here too, ready to send again.
export default function AddPersonSheet({ invites = [], initialMode = 'invite', onCreated, onJoined, onClose, onToast }) {
  const [mode, setMode] = useState(initialMode) // invite | join
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
      setError(t('Oluşturulamadı, tekrar dener misin?', 'Couldn’t create it. Try again?'))
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
      setError(JOIN_ERRORS[key] ?? t('Bir şeyler ters gitti, tekrar dener misin?', 'Something went wrong. Try again?'))
      setBusy(false)
    }
  }

  return (
    <div className="settings">
      <h3>{t('Kişi ekle', 'Add person')}</h3>

      {invites.length > 0 && (
        <section className="settings-group">
          <h4>{t('Bekleyen davetlerin', 'Your open invitations')}</h4>
          <div className="list-card">
            {invites.map((c) => {
              const Icon = RELATION_ICONS[c.relation] ?? RELATION_ICONS.partner
              return (
                <div key={c.id} className="list-row">
                  <span className="row-icon">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="row-text">
                    {(RELATIONS[c.relation] ?? RELATIONS.partner).label}
                    <small className="code-text">{c.inviteCode}</small>
                  </span>
                  <button className="btn btn-secondary btn-small" onClick={() => shareInvite(c.inviteCode, onToast)}>
                    <Send size={16} aria-hidden="true" /> {t('Gönder', 'Send')}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="segmented">
        <button className={mode === 'invite' ? 'is-active' : ''} onClick={() => setMode('invite')}>
          {t('Ben davet edeyim', 'I’ll invite')}
        </button>
        <button className={mode === 'join' ? 'is-active' : ''} onClick={() => setMode('join')}>
          {t('Kodum var', 'I have a code')}
        </button>
      </div>

      {mode === 'invite' ? (
        <section className="settings-group">
          <h4>{t('Kimi davet ediyorsun?', 'Who are you inviting?')}</h4>
          <div className="categories relations" role="radiogroup" aria-label={t('İlişki', 'Relationship')}>
            {Object.entries(RELATIONS).map(([key, r]) => {
              const Icon = RELATION_ICONS[key]
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={relation === key}
                  className={`category ${relation === key ? 'is-active' : ''}`}
                  style={{ '--tag': 'var(--rose)' }}
                  onClick={() => setRelation(key)}
                >
                  <Icon size={20} aria-hidden="true" />
                  {r.label}
                </button>
              )
            })}
          </div>
          <p className="hint">
            {t(
              'Her kişiyle ayrı bir ortak takvimin olur; biri diğerinin planlarını görmez.',
              'You get a separate shared calendar with each person; nobody sees the others’ plans.',
            )}
          </p>
          <button className="btn btn-primary" disabled={busy} onClick={create}>
            {busy ? t('Bir saniye…', 'One moment…') : t('Davet kodu oluştur', 'Create an invite code')}
          </button>
        </section>
      ) : (
        <form className="settings-group" onSubmit={join}>
          <h4>{t('Sana gönderilen davet kodu', 'The invite code you got')}</h4>
          <input
            className="input code-input"
            placeholder={t('Örn. K7MP2X', 'E.g. K7MP2X')}
            maxLength={6}
            autoCapitalize="characters"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary" disabled={busy || code.trim().length !== 6}>
            {busy ? t('Bir saniye…', 'One moment…') : t('Bağlan', 'Connect')}
          </button>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          {t('Kapat', 'Close')}
        </button>
      </div>
    </div>
  )
}
