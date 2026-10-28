import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { ChevronRight, ExternalLink, Sparkles } from 'lucide-react'
import { setCovered } from '../lib/api'
import { UNKNOWN_PERSON } from '../lib/constants'
import { genitive } from '../lib/format'

const MANAGE = {
  app_store: 'https://apps.apple.com/account/subscriptions',
  play_store: 'https://play.google.com/store/account/subscriptions',
}

// "Abonelik" in settings: my subscription, and which of my people it covers (up to billing.max).
export default function SubscriptionSettings({ billing, me, connections, members, onPaywall, onChanged, onToast }) {
  const [busy, setBusy] = useState(null)
  const sub = billing.subscription
  const state = Object.fromEntries(billing.connections.map((c) => [c.couple_id, c]))
  const people = connections.filter((c) => c.partnerId && state[c.id])
  const until = sub?.expires_at ? format(parseISO(sub.expires_at), 'd MMMM yyyy', { locale: tr }) : null

  const status = !billing.subscribed
    ? null
    : sub?.status === 'cancelled'
      ? `İptal edildi · ${until} tarihine kadar açık`
      : sub?.status === 'grace'
        ? 'Ödeme alınamadı · mağaza hesabını kontrol et'
        : [sub?.product === 'yearly' ? 'Yıllık' : 'Aylık', until && `yenilenme ${until}`].filter(Boolean).join(' · ')

  async function toggle(c, on) {
    setBusy(c.id)
    try {
      await setCovered(me.id, c.id, on)
      await onChanged()
    } catch (err) {
      onToast(err.message === 'no_slot' ? `${billing.max} kişilik yerin dolu; önce birini çıkar` : 'Kaydedilemedi, tekrar dener misin?')
    }
    setBusy(null)
  }

  function label(c, person) {
    const s = state[c.id]
    if (!s.open) return 'Salt okunur'
    if (!billing.subscribed) return `${genitive(person.name)} aboneliğinde`
    return s.other_pays ? 'Kendi aboneliği var' : 'Senin aboneliğinde'
  }

  return (
    <section className="settings-group">
      <h4>Abonelik</h4>
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
                Yönet <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
          </div>
        ) : (
          <button className="list-row" onClick={onPaywall}>
            <span className="row-icon">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <span className="row-text">
              UsDay+’a geç
              <small>Sen + {billing.max} kişi · aylık 129,99 TL</small>
            </span>
            <ChevronRight size={18} className="row-chevron" aria-hidden="true" />
          </button>
        )}
      </div>

      {people.length > 0 && (
        <>
          <p className="hint cover-hint">
            {billing.subscribed
              ? `Aboneliğin ${billing.max} kişiyi kapsar · ${billing.used}/${billing.max} dolu. Kendi aboneliği olanlar yer kaplamaz.`
              : 'Bağlantılarından biri abone olunca ortak takviminiz açılır.'}
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
