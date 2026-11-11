import { Heart, Link as LinkIcon } from 'lucide-react'
import { WISH_CATEGORIES } from '../lib/constants'
import { WISH_ICONS } from '../lib/icons'
import { t } from '../lib/i18n'

// A wish as a tile: its photo (or category), the title and who is getting it.
export default function WishCard({ wish, onClick }) {
  const category = WISH_CATEGORIES[wish.category]
  const Icon = WISH_ICONS[wish.category] ?? WISH_ICONS.gift

  return (
    <button className={`wish-card ${wish.status === 'done' ? 'is-done' : ''}`} onClick={onClick}>
      <span className="wish-thumb">
        {wish.photo?.url ? <img src={wish.photo.url} alt="" /> : <Icon size={30} strokeWidth={1.6} aria-hidden="true" />}
        {wish.loved && (
          <span className="wish-loved" aria-label={t('Çok istiyor', 'Really wants it')}>
            <Heart size={13} fill="currentColor" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="wish-text">
        <strong>{wish.title}</strong>
        <small>
          {[category.label, wish.price].filter(Boolean).join(' · ')}
          {wish.link && <LinkIcon size={12} aria-label={t('Bağlantı var', 'Has a link')} />}
        </small>
      </span>
      {wish.claim && (
        <span className={`claim-pill ${wish.claim.mine ? '' : 'is-other'}`}>
          {wish.claim.mine
            ? wish.claim.hasPlan
              ? t('sürpriz hazır', 'surprise ready')
              : t('sen alıyorsun', 'you’re getting it')
            : wish.claim.byName
              ? t(`${wish.claim.byName} alıyor`, `${wish.claim.byName} is getting it`)
              : t('biri alıyor', 'someone’s getting it')}
        </span>
      )}
      {wish.status === 'done' && <span className="claim-pill done">{t('gerçekleşti', 'came true')}</span>}
    </button>
  )
}
