import { useState } from 'react'
import { ChevronRight, ExternalLink, RotateCcw, Sparkles } from 'lucide-react'
import { setCovered } from '../lib/api'
import { UNKNOWN_PERSON } from '../lib/constants'
import { genitive } from '../lib/format'
import { dateText, t } from '../lib/i18n'
import { PRICE, TRIAL_DAYS } from '../lib/prices'
import { canBuy, restore } from '../lib/purchases'

const MANAGE = {
  app_store: 'https://apps.apple.com/account/subscriptions',
  play_store: 'https://play.google.com/store/account/subscriptions',
}

// "Abonelik" in settings: my subscription, and which of my people it covers (up to billing.max).
export default function SubscriptionSettings({ billing, me, connections, members, onPaywall, onChanged, onRestored, onToast }) {
  const [busy, setBusy] = useState(null)
  const [restoring, setRestoring] = useState(false)
  const sub = billing.subscription
  const state = Object.fromEntries(billing.connections.map((c) => [c.couple_id, c]))
  const people = connections.filter((c) => c.partnerId && state[c.id])
  const until = sub?.expires_at ? dateText(sub.expires_at, 'd MMMM yyyy', 'MMMM d, yyyy') : null

  const yearly = sub?.product === 'yearly'
  const plan = yearly ? t('Yıllık', 'Yearly') : t('Aylık', 'Monthly')
  const status = !billing.subscribed
    ? null
    : sub?.trial && sub?.status === 'active'
      ? t(
          `Ücretsiz deneme · ${until} tarihinde ${yearly ? 'yıllık' : 'aylık'} abonelik başlar`,
          `Free trial · your ${yearly ? 'yearly' : 'monthly'} plan starts on ${until}`,
        )
      : sub?.status === 'cancelled'
      ? t(`İptal edildi · ${until} tarihine kadar açık`, `Cancelled · open until ${until}`)
      : sub?.status === 'grace'
        ? t('Ödeme alınamadı · mağaza hesabını kontrol et', 'Payment failed · check your store account')
        : [plan, until && t(`yenilenme ${until}`, `renews ${until}`)].filter(Boolean).join(' · ')

  async function toggle(c, on) {
    setBusy(c.id)
    try {
      await setCovered(me.id, c.id, on)
      await onChanged()
    } catch (err) {
      onToast(
        err.message === 'no_slot'
          ? t(`${billing.max} kişilik yerin dolu; önce birini çıkar`, `All ${billing.max} places are taken; remove someone first`)
          : t('Kaydedilemedi, tekrar dener misin?', 'Couldn’t save. Try again?'),
      )
    }
    setBusy(null)
  }

  // A subscription bought with this Apple / Google account, e.g. on an earlier phone.
  async function bringBack() {
    setRestoring(true)
    try {
      if (await restore()) onRestored()
      else onToast(t('Bu Apple ya da Google hesabıyla alınmış bir abonelik bulunamadı', 'No subscription was found for this Apple or Google account'))
    } catch {
      onToast(t('Geri yüklenemedi, tekrar dener misin?', 'Couldn’t restore. Try again?'))
    }
    setRestoring(false)
  }

  function label(c, person) {
    const s = state[c.id]
    if (!s.open) return t('Salt okunur', 'Read-only')
    if (!billing.subscribed) return t(`${genitive(person.name)} aboneliğinde`, `On ${person.name}’s subscription`)
    return s.other_pays ? t('Kendi aboneliği var', 'Has their own subscription') : t('Senin aboneliğinde', 'On your subscription')
  }

  return (
    <section className="settings-group">
      <h4>{t('Abonelik', 'Subscription')}</h4>
      <div className="list-card">
        {billing.subscribed ? (
          <div className="list-row">
            <span className="row-icon">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <span className="row-text">
              UsDay+
              <small>{status}</small>
            </span>
            {MANAGE[sub?.store] && (
              <a className="link-btn" href={MANAGE[sub.store]} target="_blank" rel="noreferrer">
                {t('Yönet', 'Manage')} <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
          </div>
        ) : (
          <button className="list-row" onClick={onPaywall}>
            <span className="row-icon">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <span className="row-text">
              {t('UsDay+’a geç', 'Get UsDay+')}
              <small>
                {t(
                  `${TRIAL_DAYS} gün ücretsiz · sen + ${billing.max} kişi · yıllık ${PRICE.yearly}`,
                  `${TRIAL_DAYS} days free · you + ${billing.max} people · ${PRICE.yearly} a year`,
                )}
              </small>
            </span>
            <ChevronRight size={18} className="row-chevron" aria-hidden="true" />
          </button>
        )}
        {canBuy && (
          <button className="list-row" onClick={bringBack} disabled={restoring}>
            <span className="row-icon">
              <RotateCcw size={18} aria-hidden="true" />
            </span>
            <span className="row-text">
              {restoring ? t('Bir saniye…', 'One moment…') : t('Satın alımları geri yükle', 'Restore purchases')}
              <small>{t('Telefon değiştirdiysen', 'If you changed phones')}</small>
            </span>
          </button>
        )}
      </div>

      {people.length > 0 && (
        <>
          <p className="hint cover-hint">
            {billing.subscribed
              ? t(
                  `Aboneliğin ${billing.max} kişiyi kapsar · ${billing.used}/${billing.max} dolu. Kendi aboneliği olanlar yer kaplamaz.`,
                  `Your subscription covers ${billing.max} people · ${billing.used}/${billing.max} used. People with their own subscription don’t take a place.`,
                )
              : t('Bağlantılarından biri abone olunca ortak takviminiz açılır.', 'Your shared calendar opens when one of your connections subscribes.')}
          </p>
          <div className="list-card">
            {people.map((c) => {
              const person = members[c.partnerId] ?? UNKNOWN_PERSON
              const s = state[c.id]
              const canToggle = billing.subscribed && !s.other_pays
              const Row = canToggle ? 'button' : 'div'
              return (
                <Row
                  key={c.id}
                  className={`list-row cover-row ${s.covered_by_me ? 'is-on' : ''}`}
                  {...(canToggle && {
                    role: 'switch',
                    'aria-checked': s.covered_by_me,
                    disabled: busy === c.id,
                    onClick: () => toggle(c, !s.covered_by_me),
                  })}
                >
                  <span className="person-avatar" style={{ background: person.color }}>
                    {person.short}
                  </span>
                  <span className="row-text">
                    {person.name}
                    <small className={s.open ? '' : 'is-locked'}>{label(c, person)}</small>
                  </span>
                  {canToggle && <span className="switch" aria-hidden="true" />}
                </Row>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
