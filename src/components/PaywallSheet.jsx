import { useEffect, useState } from 'react'
import { CalendarHeart, Gift, KeyRound, RotateCcw, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { pageUrl } from '../lib/native'
import { locale, t } from '../lib/i18n'
import { PRICE, TRIAL_DAYS } from '../lib/prices'
import { buy, canBuy, loadPlans, restore } from '../lib/purchases'

// Without the store (the web, or before the store is set up) the prices UsDay+ starts with are shown.
const FALLBACK = {
  yearly: { price: PRICE.yearly, perMonth: PRICE.yearlyPerMonth, trialDays: TRIAL_DAYS },
  monthly: { price: PRICE.monthly, trialDays: TRIAL_DAYS },
  freeMonths: 5,
}

// UsDay+: one subscription opens the shared calendar for the subscriber and the people they are connected
// with (up to `max`). In the phone app it is bought here, at the store's price for the phone's country;
// on the web this says to use the app.
export default function PaywallSheet({ reason, max = 5, onHaveCode, onBought, onClose, onToast }) {
  const [choice, setChoice] = useState('yearly')
  const [store, setStore] = useState(canBuy ? undefined : null) // undefined while loading, null without the store
  const [busy, setBusy] = useState(false)
  const [asked, setAsked] = useState(false)
  const [error, setError] = useState('')

  function fetchPlans() {
    setStore(undefined)
    setError('')
    loadPlans()
      .then((plans) => setStore(plans?.yearly || plans?.monthly ? plans : null))
      .catch(() => {
        setStore(null)
        setError(t('Mağazaya şu an ulaşılamıyor, birazdan tekrar dener misin?', 'Can’t reach the store right now. Try again in a moment?'))
      })
  }

  useEffect(() => {
    if (canBuy) fetchPlans()
    // once, when the sheet opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const plans = store ?? FALLBACK
  const selling = canBuy && Boolean(store)
  const list = [
    plans.yearly && {
      id: 'yearly',
      label: t('Yıllık', 'Yearly'),
      per: t('/ yıl', '/ year'),
      note: [
        plans.yearly.perMonth && t(`Ayda ${plans.yearly.perMonth}’ye gelir`, `${plans.yearly.perMonth} a month`),
        plans.freeMonths > 0 && t(`${plans.freeMonths} ay bedava`, `${plans.freeMonths} months free`),
      ]
        .filter(Boolean)
        .join(' · '),
      best: true,
      ...plans.yearly,
    },
    plans.monthly && {
      id: 'monthly',
      label: t('Aylık', 'Monthly'),
      per: t('/ ay', '/ month'),
      note: t('İstediğin ay bırakabilirsin', 'Stop any month you like'),
      ...plans.monthly,
    },
  ].filter(Boolean)
  const chosen = list.find((p) => p.id === choice) ?? list[0]
  const trial = chosen?.trialDays ?? 0

  // The yearly price shared by everyone it covers, per month, in the store's currency.
  const perPerson = selling && plans.yearly
    ? new Intl.NumberFormat(locale, { style: 'currency', currency: plans.yearly.pkg.product.currencyCode }).format(
        plans.yearly.amount / 12 / (max + 1),
      )
    : PRICE.perPerson(max)

  async function purchase() {
    if (!selling) return setAsked(true)
    setBusy(true)
    setError('')
    try {
      const result = await buy(chosen)
      if (result === 'bought') onBought()
      else if (result === 'pending') onToast(t('Ödeme onay bekliyor; onaylanınca UsDay+ açılır.', 'Your payment is pending; UsDay+ opens once it goes through.'))
    } catch {
      setError(t('Satın alma tamamlanamadı, tekrar dener misin?', 'The purchase didn’t go through. Try again?'))
    }
    setBusy(false)
  }

  async function bringBack() {
    setBusy(true)
    setError('')
    try {
      if (await restore()) onBought()
      else onToast(t('Bu Apple ya da Google hesabıyla alınmış bir abonelik bulunamadı', 'No subscription was found for this Apple or Google account'))
    } catch {
      setError(t('Geri yüklenemedi, tekrar dener misin?', 'Couldn’t restore. Try again?'))
    }
    setBusy(false)
  }

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

      {store === undefined ? (
        <p className="hint paywall-loading">{t('Fiyatlar yükleniyor…', 'Loading prices…')}</p>
      ) : (
        <div className="paywall-plans" role="radiogroup" aria-label={t('Abonelik süresi', 'Subscription length')}>
          {list.map((p) => (
            <button
              key={p.id}
              role="radio"
              aria-checked={chosen?.id === p.id}
              className={`paywall-plan ${chosen?.id === p.id ? 'is-active' : ''}`}
              onClick={() => setChoice(p.id)}
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
      )}

      {error && <p className="form-error">{error}</p>}

      {asked ? (
        <p className="notice card paywall-store">
          {t(
            'Abonelik App Store ve Google Play’deki UsDay uygulamasından alınır. Uygulamayı telefonuna indirip aynı hesapla giriş yapman yeterli.',
            'UsDay+ is sold in the UsDay app on the App Store and Google Play. Download it to your phone and sign in with the same account.',
          )}
        </p>
      ) : canBuy && store === null ? (
        <button className="btn btn-secondary paywall-buy" onClick={fetchPlans}>
          {t('Tekrar dene', 'Try again')}
        </button>
      ) : (
        chosen && (
          <>
            <button className="btn btn-primary paywall-buy" onClick={purchase} disabled={busy || store === undefined}>
              {busy
                ? t('Bir saniye…', 'One moment…')
                : trial > 0
                  ? t(`${trial} gün ücretsiz dene`, `Try it free for ${trial} days`)
                  : t('Abone ol', 'Subscribe')}
            </button>
            <p className="hint paywall-trial">
              {trial > 0
                ? t(
                    `${trial} gün ücretsiz, sonra ${chosen.price} ${chosen.per}. Deneme bitmeden iptal edersen hiçbir ücret alınmaz.`,
                    `Free for ${trial} days, then ${chosen.price} ${chosen.per}. Cancel before the trial ends and you won’t be charged.`,
                  )
                : t(
                    `${chosen.price} ${chosen.per}, her dönem kendiliğinden yenilenir.`,
                    `${chosen.price} ${chosen.per}, renews automatically every period.`,
                  )}
            </p>
          </>
        )
      )}

      {canBuy && (
        <button className="link-btn paywall-code" onClick={bringBack} disabled={busy}>
          <RotateCcw size={15} aria-hidden="true" /> {t('Satın alımları geri yükle', 'Restore purchases')}
        </button>
      )}
      <button className="link-btn paywall-code" onClick={onHaveCode}>
        <KeyRound size={15} aria-hidden="true" /> {t('Abone olan birinden davet kodum var', 'I have an invite code from a subscriber')}
      </button>

      <p className="hint paywall-legal">
        {t(
          'Abonelik, dönem bitmeden en az 24 saat önce iptal edilmezse aynı ücretle kendiliğinden yenilenir. Ücretsiz deneme bitmeden iptal edilmezse abonelik seçtiğin ücretle başlar. Ödeme ve iptal, App Store ya da Google Play hesabından yapılır.',
          'The subscription renews automatically at the same price unless it is cancelled at least 24 hours before the end of the period. Unless you cancel before the free trial ends, the subscription starts at the price you chose. Payment and cancellation are handled in your App Store or Google Play account.',
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
