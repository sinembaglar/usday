import { useState } from 'react'
import { joinCouple } from '../lib/api'

const JOIN_ERRORS = {
  invalid_invite: 'Bu kod geçersiz ya da kullanılmış.',
  calendar_not_empty: 'Takviminde plan olduğu için birleştirilemiyor. Önce planlarını silmen gerekiyor.',
}

export default function InviteCard({ code, onJoined, onToast }) {
  const [joining, setJoining] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

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
      await joinCouple(input.trim().toUpperCase())
      onJoined()
    } catch (err) {
      const key = Object.keys(JOIN_ERRORS).find((k) => err.message?.includes(k))
      setError(JOIN_ERRORS[key] ?? 'Bir şeyler ters gitti, tekrar dener misin?')
    }
  }

  return (
    <section className="invite card">
      <div className="invite-head">
        <span className="invite-emoji">💌</span>
        <span>
          <strong>Eşini davet et</strong>
          <small>Linki gönder ya da kodu söyle. Kayıt olunca takviminiz birleşir.</small>
        </span>
      </div>

      <div className="invite-code">{code}</div>

      <button className="btn btn-primary" onClick={share}>
        Davet linkini gönder
      </button>

      {joining ? (
        <form className="invite-join" onSubmit={join}>
          <input
            className="input code-input"
            placeholder="Eşinin kodu"
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
          Eşin seni davet etti mi? Onun kodunu gir
        </button>
      )}
    </section>
  )
}
