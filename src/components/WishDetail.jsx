import { useState } from 'react'
import { UNKNOWN_PERSON, WISH_CATEGORIES } from '../lib/constants'
import { claimWish, completeWish, unclaimWish } from '../lib/api'
import { genitive } from '../lib/format'

const safeLink = (link) => (/^https?:\/\//i.test(link) ? link : `https://${link}`)

// The owner edits, plans or ticks off their wish. Others can secretly claim it (everyone but
// the owner sees who did) and turn it into a surprise plan.
export default function WishDetail({ wish, me, members, onEdit, onPlan, onSurprise, onChanged, onClose, onToast }) {
  const [busy, setBusy] = useState(false)
  const category = WISH_CATEGORIES[wish.category]
  const mine = wish.owner === me
  const owner = members[wish.owner] ?? UNKNOWN_PERSON
  const open = wish.status === 'open'

  async function run(action, message) {
    setBusy(true)
    try {
      await action()
      onToast(message)
      onChanged()
    } catch (e) {
      if (e.message === 'taken') {
        onToast('🎁 Bunu az önce başka biri ayırdı')
        onChanged()
        return
      }
      onToast('Olmadı, tekrar dener misin?')
      setBusy(false)
    }
  }

  return (
    <div className="detail wish-detail">
      {wish.photo?.url && <img className="wish-photo" src={wish.photo.url} alt="" />}
      <span className="chip is-active" style={{ '--tag': 'var(--rose)' }}>
        {category.emoji} {category.label}
      </span>
      <h3>
        {wish.title} {wish.loved && <span title="Çok istiyor">💖</span>}
      </h3>
      {wish.price && <p className="meta-line">💸 {wish.price}</p>}
      {wish.link && (
        <a className="meta-line place" href={safeLink(wish.link)} target="_blank" rel="noreferrer">
          🔗 Bağlantıyı aç <span>›</span>
        </a>
      )}
      {wish.note && <p className="note">{wish.note}</p>}
      {!open && <div className="status-box">✨ Bu dilek gerçekleşti!</div>}
      <p className="author">{mine ? 'Senin dileğin' : `${genitive(owner.name)} dileği`}</p>

      {mine && open && (
        <div className="wish-actions">
          <button className="btn btn-primary" onClick={onPlan}>
            📅 Plana çevir
          </button>
          <button className="btn btn-ghost bordered" disabled={busy} onClick={() => run(() => completeWish(wish.id), '✨ Gerçekleşti olarak işaretlendi')}>
            ✨ Gerçekleşti
          </button>
        </div>
      )}

      {!mine && open && wish.claim && !wish.claim.mine && (
        <div className="status-box is-asking">
          <span>
            🎁 <b>{wish.claim.byName}</b> bunu alıyor{wish.claim.hasPlan && ' ve bir sürpriz hazırlıyor'}. {owner.name}{' '}
            bilmiyor 🤫
          </span>
          <small>Birlikte almak istersen {wish.claim.byName} ile konuşabilirsin.</small>
        </div>
      )}

      {!mine && open && (!wish.claim || wish.claim.mine) && (
        <div className="wish-actions">
          {wish.claim?.hasPlan ? (
            <div className="status-box is-asking">🎁 Bu dilekten bir sürpriz plan hazırladın. {owner.name} hiçbir şey bilmiyor 🤫</div>
          ) : (
            <button className="btn btn-primary" onClick={onSurprise}>
              🎁 Sürpriz plana çevir
            </button>
          )}
          {wish.claim ? (
            <>
              <button className="btn btn-ghost bordered" disabled={busy} onClick={() => run(() => completeWish(wish.id), '✨ Gerçekleşti olarak işaretlendi')}>
                ✨ Gerçekleşti
              </button>
              <button className="link-btn" disabled={busy} onClick={() => run(() => unclaimWish(wish.id), 'İşaret kaldırıldı')}>
                “Ben alıyorum” işaretini kaldır
              </button>
            </>
          ) : (
            <button className="btn btn-ghost bordered" disabled={busy} onClick={() => run(() => claimWish(wish.id), `🤫 Not alındı. ${owner.name} görmeyecek, diğerleri senin aldığını görecek`)}>
              🤫 Bunu ben alıyorum
            </button>
          )}
        </div>
      )}

      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Kapat
        </button>
        {mine && (
          <button className="btn btn-primary" onClick={onEdit}>
            Düzenle
          </button>
        )}
      </div>
    </div>
  )
}
