import { useState } from 'react'
import { joinCouple } from '../lib/api'
import { RELATIONS } from '../lib/constants'

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

  const link = `${window.location.origin}/?davet=${code}`

  async function share() {
    const text = `UsDay’de ortak takvimimizi açtım 💜 Bu linkle kayıt olunca takvimlerimiz birleşiyor (davet kodu: ${code})`
    if (navigator.share) {
      navigator.share({ title: 'UsDay', text, url: link }).catch(() => {})
    } else {
      await navigator.clipboard?.writeText(`${text}\n${link}`)
      onToast('🔗 Davet linki kopyalandı')
    }
  }

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

  return (
    <section className="invite card">
      <div className="invite-head">
        <span className="invite-emoji">{words.emoji}</span>
        <span>
          <strong>{words.invite}</strong>
          <small>Linki gönder ya da kodu söyle. Kayıt olunca ortak takviminiz açılır.</small>
        </span>
      </div>

      <div className="invite-code">{code}</div>

      <button className="btn btn-primary" onClick={share}>
        Davet linkini gönder
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
