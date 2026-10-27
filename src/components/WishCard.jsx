import { Heart, Link as LinkIcon } from 'lucide-react'
import { WISH_CATEGORIES } from '../lib/constants'
import { WISH_ICONS } from '../lib/icons'

// A wish as a tile: its photo (or category), the title and who is getting it.
export default function WishCard({ wish, onClick }) {
  const category = WISH_CATEGORIES[wish.category]
  const Icon = WISH_ICONS[wish.category] ?? WISH_ICONS.gift

  return (
    <button className={`wish-card ${wish.status === 'done' ? 'is-done' : ''}`} onClick={onClick}>
      <span className="wish-thumb">
        {wish.photo?.url ? <img src={wish.photo.url} alt="" /> : <Icon size={30} strokeWidth={1.6} aria-hidden="true" />}
        {wish.loved && (
          <span className="wish-loved" aria-label="Çok istiyor">
            <Heart size={13} fill="currentColor" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="wish-text">
        <strong>{wish.title}</strong>
        <small>
          {[category.label, wish.price].filter(Boolean).join(' · ')}
          {wish.link && <LinkIcon size={12} aria-label="Bağlantı var" />}
        </small>
      </span>
      {wish.claim && (
        <span className={`claim-pill ${wish.claim.mine ? '' : 'is-other'}`}>
          {wish.claim.mine
            ? wish.claim.hasPlan
              ? 'sürpriz hazır'
              : 'sen alıyorsun'
            : wish.claim.byName
              ? `${wish.claim.byName} alıyor`
              : 'biri alıyor'}
        </span>
      )}
      {wish.status === 'done' && <span className="claim-pill done">gerçekleşti</span>}
    </button>
  )
}
