import { WISH_CATEGORIES } from '../lib/constants'

export default function WishCard({ wish, onClick }) {
  const category = WISH_CATEGORIES[wish.category]
  const meta = [category.label, wish.price, wish.link && '🔗'].filter(Boolean)

  return (
    <button className={`wish-card ${wish.status === 'done' ? 'is-done' : ''}`} onClick={onClick}>
      <span className="wish-thumb">{wish.photo?.url ? <img src={wish.photo.url} alt="" /> : category.emoji}</span>
      <span className="event-body">
        <strong>
          {wish.title}
          {wish.loved && <span className="loved" title="Çok istiyor">💖</span>}
        </strong>
        <small>{meta.join(' · ')}</small>
      </span>
      {wish.claim && (
        <span className={`claim-pill ${wish.claim.mine ? '' : 'is-other'}`}>
          {wish.claim.mine
            ? wish.claim.hasPlan
              ? '🎁 sürpriz hazır'
              : '🤫 sen alıyorsun'
            : `🎁 ${wish.claim.byName} alıyor`}
        </span>
      )}
      {wish.status === 'done' && <span className="claim-pill done">✨</span>}
    </button>
  )
}
