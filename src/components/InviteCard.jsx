import { useState } from 'react'
import { Send } from 'lucide-react'
import { joinCouple } from '../lib/api'
import { RELATIONS } from '../lib/constants'
import { RELATION_ICONS } from '../lib/icons'
import { shareInvite } from '../lib/invite'
import { t } from '../lib/i18n'

const JOIN_ERRORS = {
  invalid_invite: t('Bu kod geçersiz ya da kullanılmış.', 'This code is invalid or already used.'),
  already_connected: t('Bu kişiyle zaten bağlısınız.', 'You’re already connected with this person.'),
}

// An open invitation: share its code, or join someone else's with theirs. With onRelation, the first
// invitation also asks who it is for (it starts as 'partner').
export default function InviteCard({ code, relation = 'partner', onRelation, onShared, onJoined, onToast, showJoin = true }) {
  const [joining, setJoining] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const words = RELATIONS[relation] ?? RELATIONS.partner

  const share = async () => (await shareInvite(code, onToast)) && onShared?.()

  async function join(e) {
    e.preventDefault()
    setError('')
    try {
      const id = await joinCouple(input.trim().toUpperCase())
      onJoined(id)
    } catch (err) {
      const key = Object.keys(JOIN_ERRORS).find((k) => err.message?.includes(k))
      setError(JOIN_ERRORS[key] ?? t('Bir şeyler ters gitti, tekrar dener misin?', 'Something went wrong. Try again?'))
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
          <small>
            {onRelation
              ? t('Kimi davet ettiğini seç, linki gönder.', 'Choose who you’re inviting, then send the link.')
              : t('Linki gönder ya da kodu söyle.', 'Send the link or tell them the code.')}
          </small>
        </span>
      </div>

      {onRelation && (
        <div className="chips invite-relations" role="radiogroup" aria-label={t('Kimi davet ediyorsun?', 'Who are you inviting?')}>
          {Object.entries(RELATIONS).map(([key, r]) => {
            const RelationIcon = RELATION_ICONS[key]
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={relation === key}
                className={`chip icon-chip ${relation === key ? 'is-active' : ''}`}
                style={{ '--tag': 'var(--rose)' }}
                onClick={() => key !== relation && onRelation(key)}
              >
                <RelationIcon size={14} aria-hidden="true" />
                {r.label}
              </button>
            )
          })}
        </div>
      )}

      <div className="invite-code">{code}</div>

      <button className="btn btn-primary" onClick={share}>
        <Send size={18} aria-hidden="true" /> {t('Davet linkini gönder', 'Send the invite link')}
      </button>

      {showJoin &&
        (joining ? (
          <form className="invite-join" onSubmit={join}>
            <input
              className="input code-input"
              placeholder={t('Onun kodu', 'Their code')}
              maxLength={6}
              autoCapitalize="characters"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <button className="btn btn-primary" disabled={input.trim().length !== 6}>
              {t('Bağlan', 'Connect')}
            </button>
            {error && <p className="form-error">{error}</p>}
          </form>
        ) : (
          <button className="link-btn" onClick={() => setJoining(true)}>
            {t('Seni biri davet etti mi? Onun kodunu gir', 'Did someone invite you? Enter their code')}
          </button>
        ))}
    </section>
  )
}
