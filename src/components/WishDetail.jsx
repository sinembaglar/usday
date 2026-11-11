import { useState } from 'react'
import { CalendarPlus, Check, ExternalLink, Gift, Heart, Lock, Sparkles } from 'lucide-react'
import { UNKNOWN_PERSON, WISH_CATEGORIES } from '../lib/constants'
import { WISH_ICONS } from '../lib/icons'
import { claimWish, completeWish, setClaimShared, unclaimWish } from '../lib/api'
import { possessive } from '../lib/format'
import { t } from '../lib/i18n'

const safeLink = (link) => (/^https?:\/\//i.test(link) ? link : `https://${link}`)

// The owner edits, plans or ticks off their wish. Others can secretly claim it, showing their
// name to everyone but the owner or only "biri alıyor", and turn it into a surprise plan.
export default function WishDetail({ wish, me, members, onEdit, onPlan, onSurprise, onChanged, onClose, onToast }) {
  const [busy, setBusy] = useState(false)
  const [choosing, setChoosing] = useState(false) // "Bunu ben alıyorum": show my name to the others or not
  const category = WISH_CATEGORIES[wish.category]
  const Icon = WISH_ICONS[wish.category] ?? WISH_ICONS.gift
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
        onToast(t('🎁 Bunu az önce başka biri ayırdı', '🎁 Someone else just took this one'))
        onChanged()
        return
      }
      onToast(t('Olmadı, tekrar dener misin?', 'That didn’t work. Try again?'))
      setBusy(false)
    }
  }

  return (
    <div className="detail wish-detail">
      {wish.photo?.url && <img className="wish-photo" src={wish.photo.url} alt="" />}
      <span className="tag-label" style={{ '--tag': 'var(--rose)' }}>
        <Icon size={14} aria-hidden="true" />
        {category.label}
      </span>
      <h3>
        {wish.title} {wish.loved && <Heart className="title-heart" size={18} fill="currentColor" aria-label={t('Çok istiyor', 'Really wants it')} />}
      </h3>
      {wish.price && <p className="meta-line">{wish.price}</p>}
      {wish.link && (
        <a className="meta-line place" href={safeLink(wish.link)} target="_blank" rel="noreferrer">
          {t('Bağlantıyı aç', 'Open link')} <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
      {wish.note && <p className="note">{wish.note}</p>}
      {!open && <div className="status-box"><Sparkles size={16} aria-hidden="true" /> {t('Bu dilek gerçekleşti', 'This wish came true')}</div>}
      <p className="author">{mine ? t('Senin dileğin', 'Your wish') : `${possessive(owner.name)} ${t('dileği', 'wish')}`}</p>

      {mine && open && (
        <div className="wish-actions">
          <button className="btn btn-primary" onClick={onPlan}>
            <CalendarPlus size={17} aria-hidden="true" /> {t('Plana çevir', 'Make it a plan')}
          </button>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => run(() => completeWish(wish.id), t('✨ Gerçekleşti olarak işaretlendi', '✨ Marked as come true'))}
          >
            <Check size={17} aria-hidden="true" /> {t('Gerçekleşti', 'It came true')}
          </button>
        </div>
      )}

      {!mine && open && wish.claim && !wish.claim.mine && (
        <div className="status-box is-asking">
          {wish.claim.byName ? (
            <>
              <span>
                {t(
                  <>
                    <b>{wish.claim.byName}</b> bunu alıyor{wish.claim.hasPlan && ' ve bir sürpriz hazırlıyor'}. {owner.name} bilmiyor.
                  </>,
                  <>
                    <b>{wish.claim.byName}</b> is getting this{wish.claim.hasPlan && ' and planning a surprise'}. {owner.name} doesn’t know.
                  </>,
                )}
              </span>
              <small>
                {t(
                  `Birlikte almak istersen ${wish.claim.byName} ile konuşabilirsin.`,
                  `Want to chip in? Talk to ${wish.claim.byName}.`,
                )}
              </small>
            </>
          ) : (
            <span>{t(`Bunu biri alıyor. ${owner.name} bilmiyor.`, `Someone is getting this. ${owner.name} doesn’t know.`)}</span>
          )}
        </div>
      )}

      {!mine && open && (!wish.claim || wish.claim.mine) && (
        <div className="wish-actions">
          {wish.claim?.hasPlan ? (
            <div className="status-box is-asking">
              {t(
                `Bu dilekten bir sürpriz plan hazırladın. ${owner.name} hiçbir şey bilmiyor.`,
                `You made a surprise plan from this wish. ${owner.name} has no idea.`,
              )}
            </div>
          ) : (
            <button className="btn btn-primary" onClick={onSurprise}>
              <Gift size={17} aria-hidden="true" /> {t('Sürpriz plana çevir', 'Make it a surprise')}
            </button>
          )}
          {wish.claim ? (
            <>
              <p className="hint claim-hint">
                {wish.claim.shared
                  ? t(`Diğerleri senin aldığını görüyor, ${owner.name} görmüyor.`, `The others see you’re getting it; ${owner.name} doesn’t.`)
                  : t(
                      `Diğerleri sadece “biri alıyor” görüyor, ${owner.name} hiçbir şey görmüyor.`,
                      `The others only see “someone’s getting it”; ${owner.name} sees nothing.`,
                    )}{' '}
                <button
                  className="link-btn"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => setClaimShared(wish.id, !wish.claim.shared),
                      wish.claim.shared ? t('🔒 Adın artık gizli', '🔒 Your name is hidden now') : t('🎁 Adın artık görünüyor', '🎁 Your name shows now'),
                    )
                  }
                >
                  {wish.claim.shared ? t('Adımı gizle', 'Hide my name') : t('Adım görünsün', 'Show my name')}
                </button>
              </p>
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => run(() => completeWish(wish.id), t('✨ Gerçekleşti olarak işaretlendi', '✨ Marked as come true'))}
              >
                <Check size={17} aria-hidden="true" /> {t('Gerçekleşti', 'It came true')}
              </button>
              <button className="link-btn" disabled={busy} onClick={() => run(() => unclaimWish(wish.id), t('İşaret kaldırıldı', 'Unmarked'))}>
                {t('“Ben alıyorum” işaretini kaldır', 'I’m not getting it after all')}
              </button>
            </>
          ) : choosing ? (
            <div className="claim-choice">
              <strong>{t('Diğerleri görsün mü?', 'Should the others see it’s you?')}</strong>
              <small>{t(`${owner.name} iki durumda da hiçbir şey görmez.`, `Either way, ${owner.name} sees nothing.`)}</small>
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  run(
                    () => claimWish(wish.id, null, true, true),
                    t('🎁 Not alındı, diğerleri senin aldığını görecek', '🎁 Noted. The others will see you’re getting it'),
                  )
                }
              >
                <Gift size={16} aria-hidden="true" /> {t('Adım görünsün', 'Show my name')}{' '}
                <small>“{t(`${members[me]?.name ?? 'Sen'} alıyor`, `${members[me]?.name ?? 'You'}’s getting it`)}”</small>
              </button>
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  run(
                    () => claimWish(wish.id, null, true, false),
                    t('🔒 Not alındı, diğerleri sadece “biri alıyor” görecek', '🔒 Noted. The others will only see “someone’s getting it”'),
                  )
                }
              >
                <Lock size={16} aria-hidden="true" /> {t('Adım gizli kalsın', 'Keep my name hidden')}{' '}
                <small>“{t('Biri alıyor', 'Someone’s getting it')}”</small>
              </button>
              <button className="link-btn" onClick={() => setChoosing(false)}>
                {t('Vazgeç', 'Cancel')}
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary" disabled={busy} onClick={() => setChoosing(true)}>
              <Gift size={17} aria-hidden="true" /> {t('Bunu ben alıyorum', 'I’m getting this')}
            </button>
          )}
        </div>
      )}

      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          {t('Kapat', 'Close')}
        </button>
        {mine && (
          <button className="btn btn-primary" onClick={onEdit}>
            {t('Düzenle', 'Edit')}
          </button>
        )}
      </div>
    </div>
  )
}
