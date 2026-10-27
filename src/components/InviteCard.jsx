import { useState } from 'react'
import { Send } from 'lucide-react'
import { joinCouple } from '../lib/api'
import { RELATIONS } from '../lib/constants'
import { RELATION_ICONS } from '../lib/icons'
import { shareInvite } from '../lib/invite'

const JOIN_ERRORS = {
  invalid_invite: 'Bu kod geçersiz ya da kullanılmış.',
  already_connected: 'Bu kişiyle zaten bağlısınız.',
}

// An open invitation: share its code, or join someone else's with theirs.
export default function InviteCard({ code, relation = 'partner', onJoined, onToast, showJoin = true }) {
  const [joining, setJoining] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const words = RELATIONS[relation] ?? RELATIONS.partner

  const share = () => shareInvite(code, onToast)

  async function join(e) {
    e.preventDefault()
    setError('')
    try {
      const id = await joinCouple(input.trim().toUpperCase())
      onJoined(id)
    } catch (err) {
      const key = Object.keys(JOIN_ERRORS).find((k) => err.message?.includes(k))
      setError(JOIN_ERRORS[key] ?? 'Bir şeyler ters gitti, tekrar dener misin?')
    }
  }

  const Icon = RELATION_ICONS[relation] ?? RELATION_ICONS.partner

  return (
    <section className="invite card">
      <div className="invite-head">
        <span className="notice-icon">
          <Icon size={20} aria-hidden="true" />
        </span>
        <span>
          <strong>{words.invite}</strong>
          <small>Linki gönder ya da kodu söyle.</small>
        </span>
      </div>

      <div className="invite-code">{code}</div>

      <button className="btn btn-primary" onClick={share}>
        <Send size={18} aria-hidden="true" /> Davet linkini gönder
      </button>

      {showJoin &&
        (joining ? (
          <form className="invite-join" onSubmit={join}>
            <input
              className="input code-input"
              placeholder="Onun kodu"
              maxLength={6}
              autoCapitalize="characters"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <button className="btn btn-primary" disabled={input.trim().length !== 6}>
              Bağlan
            </button>
            {error && <p className="form-error">{error}</p>}
          </form>
        ) : (
          <button className="link-btn" onClick={() => setJoining(true)}>
            Seni biri davet etti mi? Onun kodunu gir
          </button>
        ))}
    </section>
  )
}
