import { useState } from 'react'
import { CalendarHeart, Gift, KeyRound, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { pageUrl } from '../lib/native'
import { t } from '../lib/i18n'
import { PRICE, TRIAL_DAYS } from '../lib/prices'

const PLANS = [
  {
    id: 'yearly',
    label: t('Yıllık', 'Yearly'),
    price: PRICE.yearly,
    per: t('/ yıl', '/ year'),
    note: t(`Ayda ${PRICE.yearlyPerMonth}’ye gelir · 5 ay bedava`, `${PRICE.yearlyPerMonth} a month · 5 months free`),
    best: true,
  },
  {
    id: 'monthly',
    label: t('Aylık', 'Monthly'),
    price: PRICE.monthly,
    per: t('/ ay', '/ month'),
    note: t('İstediğin ay bırakabilirsin', 'Stop any month you like'),
  },
]

// UsDay+: one subscription opens the shared calendar for the subscriber and the people they are connected
// with (up to `max`). Purchases happen in the App Store / Google Play app; on the web this says where.
export default function PaywallSheet({ reason, max = 5, onHaveCode, onClose }) {
  const [plan, setPlan] = useState('yearly')
  const [asked, setAsked] = useState(false)
  const chosen = PLANS.find((p) => p.id === plan)
  const perPerson = PRICE.perPerson(max)

  const perks = [
    {
      Icon: Users,
      text: t(`Sen ve bağlandığın ${max} kişi`, `You and ${max} people you’re connected with`),
      small: t(
        `Onlar ayrıca ödemez; yıllık planda kişi başı ayda ${perPerson}`,
        `They don’t pay separately; on the yearly plan that’s ${perPerson} per person a month`,
      ),
    },
    { Icon: CalendarHeart, text: t('Sınırsız ortak plan, grup planı ve sürpriz', 'Unlimited shared plans, group plans and surprises') },
    { Icon: Gift, text: t('Dilek listeleri, doğum günü ve yıldönümü hatırlatmaları', 'Wish lists, birthday and anniversary reminders') },
    {
      Icon: ShieldCheck,
      text: t('Abonelik biterse hiçbir şey silinmez', 'Nothing is deleted if your subscription ends'),
      small: t('Takvimin salt okunur kalır', 'Your calendar becomes read-only'),
    },
  ]

  return (
    <div className="settings paywall">
      <span className="notice-icon big">
        <Sparkles size={26} aria-hidden="true" />
      </span>
      <h3>UsDay+</h3>
      {reason ? (
        <p className="paywall-reason">{reason}</p>
      ) : (
        <p className="hint">{t('Ortak takviminiz için tek abonelik.', 'One subscription for your shared calendar.')}</p>
      )}

      <ul className="paywall-perks">
        {perks.map(({ Icon, text, small }) => (
          <li key={text}>
            <span className="row-icon">
              <Icon size={17} aria-hidden="true" />
            </span>
            <span>
              {text}
              {small && <small>{small}</small>}
            </span>
          </li>
        ))}
      </ul>

      <div className="paywall-plans" role="radiogroup" aria-label={t('Abonelik süresi', 'Subscription length')}>
        {PLANS.map((p) => (
          <button
            key={p.id}
            role="radio"
            aria-checked={plan === p.id}
            className={`paywall-plan ${plan === p.id ? 'is-active' : ''}`}
            onClick={() => setPlan(p.id)}
          >
            <span className="paywall-plan-label">
              {p.label}
              {p.best && <span className="paywall-best">{t('En avantajlı', 'Best value')}</span>}
            </span>
            <span className="paywall-price">
              {p.price} <small>{p.per}</small>
            </span>
            <small>{p.note}</small>
          </button>
        ))}
      </div>

      {asked ? (
        <p className="notice card paywall-store">
          {t(
            'Abonelik App Store ve Google Play’deki UsDay uygulamasından alınır. Uygulamayı telefonuna indirip aynı hesapla giriş yapman yeterli.',
            'UsDay+ is sold in the UsDay app on the App Store and Google Play. Download it to your phone and sign in with the same account.',
          )}
        </p>
      ) : (
        <>
          <button className="btn btn-primary paywall-buy" onClick={() => setAsked(true)}>
            {t(`${TRIAL_DAYS} gün ücretsiz dene`, `Try it free for ${TRIAL_DAYS} days`)}
          </button>
          <p className="hint paywall-trial">
            {t(
              `${TRIAL_DAYS} gün ücretsiz, sonra ${chosen.price} ${chosen.per}. Deneme bitmeden iptal edersen hiçbir ücret alınmaz.`,
              `Free for ${TRIAL_DAYS} days, then ${chosen.price} ${chosen.per}. Cancel before the trial ends and you won’t be charged.`,
            )}
          </p>
        </>
      )}

      <button className="link-btn paywall-code" onClick={onHaveCode}>
        <KeyRound size={15} aria-hidden="true" /> {t('Abone olan birinden davet kodum var', 'I have an invite code from a subscriber')}
      </button>

      <p className="hint paywall-legal">
        {t(
          'Ücretsiz deneme bitmeden en az 24 saat önce iptal edilmezse abonelik seçtiğin ücretle başlar ve her dönem aynı ücretle yenilenir. Ödeme ve iptal, App Store ya da Google Play hesabından yapılır.',
          'Unless you cancel at least 24 hours before the free trial ends, the subscription starts at the price you chose and renews at the same price every period. Payment and cancellation are handled in your App Store or Google Play account.',
        )}{' '}
        <a href={pageUrl('kosullar')} target="_blank" rel="noreferrer">
          {t('Kullanım Koşulları', 'Terms of Use')}
        </a>{' '}
        ·{' '}
        <a href={pageUrl('gizlilik')} target="_blank" rel="noreferrer">
          {t('Gizlilik', 'Privacy')}
        </a>
      </p>

      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          {t('Şimdi değil', 'Not now')}
        </button>
      </div>
    </div>
  )
}
