import { useState } from 'react'
import { CalendarHeart, Gift, KeyRound, ShieldCheck, Sparkles, Users } from 'lucide-react'

const PLANS = [
  { id: 'yearly', label: 'Yıllık', price: '899,99 TL', per: '/ yıl', note: 'Ayda 75 TL’ye gelir · %42 daha uygun' },
  { id: 'monthly', label: 'Aylık', price: '129,99 TL', per: '/ ay', note: 'İstediğin ay bırakabilirsin' },
]

// UsDay+: one subscription opens the shared calendar for the subscriber and the people they are connected
// with (up to `max`). Purchases happen in the App Store / Google Play app; on the web this says where.
export default function PaywallSheet({ reason, max = 5, onHaveCode, onClose }) {
  const [plan, setPlan] = useState('yearly')
  const [asked, setAsked] = useState(false)

  const perks = [
    { Icon: Users, text: `Sen ve bağlandığın ${max} kişi`, small: 'Onlar ayrıca ödemez' },
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
            <span className="paywall-plan-label">{p.label}</span>
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
        <button className="btn btn-primary paywall-buy" onClick={() => setAsked(true)}>
          Abone ol
        </button>
      )}

      <button className="link-btn paywall-code" onClick={onHaveCode}>
        <KeyRound size={15} aria-hidden="true" /> Abone olan birinden davet kodum var
      </button>

      <p className="hint paywall-legal">
        Abonelik, dönem bitmeden en az 24 saat önce iptal edilmezse aynı ücretle yenilenir. Ödeme ve iptal, App Store ya da
        Google Play hesabından yapılır.{' '}
        <a href="/kosullar" target="_blank" rel="noreferrer">
          Kullanım Koşulları
        </a>{' '}
        ·{' '}
        <a href="/gizlilik" target="_blank" rel="noreferrer">
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
