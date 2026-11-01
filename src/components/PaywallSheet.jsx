import { useState } from 'react'
import { CalendarHeart, Gift, KeyRound, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { siteUrl } from '../lib/native'

const TRIAL_DAYS = 3
const PLANS = [
  { id: 'yearly', label: 'Yıllık', price: '799,90 TL', per: '/ yıl', note: 'Ayda 66,66 TL’ye gelir · 4 ay bedava', best: true },
  { id: 'monthly', label: 'Aylık', price: '99,90 TL', per: '/ ay', note: 'İstediğin ay bırakabilirsin' },
]

// UsDay+: one subscription opens the shared calendar for the subscriber and the people they are connected
// with (up to `max`). Purchases happen in the App Store / Google Play app; on the web this says where.
export default function PaywallSheet({ reason, max = 5, onHaveCode, onClose }) {
  const [plan, setPlan] = useState('yearly')
  const [asked, setAsked] = useState(false)
  const chosen = PLANS.find((p) => p.id === plan)
  // 799,90 TL a year shared by up to max + 1 people, per month.
  const perPerson = (799.9 / 12 / (max + 1)).toLocaleString('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

  const perks = [
    { Icon: Users, text: `Sen ve bağlandığın ${max} kişi`, small: `Onlar ayrıca ödemez; yıllık planda kişi başı ayda ${perPerson} TL` },
    { Icon: CalendarHeart, text: 'Sınırsız ortak plan, grup planı ve sürpriz' },
    { Icon: Gift, text: 'Dilek listeleri, doğum günü ve yıldönümü hatırlatmaları' },
    { Icon: ShieldCheck, text: 'Abonelik biterse hiçbir şey silinmez', small: 'Takvimin salt okunur kalır' },
  ]

  return (
    <div className="settings paywall">
      <span className="notice-icon big">
        <Sparkles size={26} aria-hidden="true" />
      </span>
      <h3>UsDay+</h3>
      {reason ? <p className="paywall-reason">{reason}</p> : <p className="hint">Ortak takviminiz için tek abonelik.</p>}

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

      <div className="paywall-plans" role="radiogroup" aria-label="Abonelik süresi">
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
              {p.best && <span className="paywall-best">En avantajlı</span>}
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
          Abonelik App Store ve Google Play’deki UsDay uygulamasından alınır. Uygulamayı telefonuna indirip aynı hesapla
          giriş yapman yeterli.
        </p>
      ) : (
        <>
          <button className="btn btn-primary paywall-buy" onClick={() => setAsked(true)}>
            {TRIAL_DAYS} gün ücretsiz dene
          </button>
          <p className="hint paywall-trial">
            {TRIAL_DAYS} gün ücretsiz, sonra {chosen.price} {chosen.per}. Deneme bitmeden iptal edersen hiçbir ücret alınmaz.
          </p>
        </>
      )}

      <button className="link-btn paywall-code" onClick={onHaveCode}>
        <KeyRound size={15} aria-hidden="true" /> Abone olan birinden davet kodum var
      </button>

      <p className="hint paywall-legal">
        Ücretsiz deneme bitmeden en az 24 saat önce iptal edilmezse abonelik seçtiğin ücretle başlar ve her dönem aynı ücretle
        yenilenir. Ödeme ve iptal, App Store ya da Google Play hesabından yapılır.{' '}
        <a href={siteUrl('/kosullar')} target="_blank" rel="noreferrer">
          Kullanım Koşulları
        </a>{' '}
        ·{' '}
        <a href={siteUrl('/gizlilik')} target="_blank" rel="noreferrer">
          Gizlilik
        </a>
      </p>

      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Şimdi değil
        </button>
      </div>
    </div>
  )
}
