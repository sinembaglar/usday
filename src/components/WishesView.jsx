import { useState } from 'react'
import { WISH_CATEGORIES } from '../lib/constants'
import { dative, genitive } from '../lib/format'
import WishCard from './WishCard'

// Both partners' wish lists. Claims ("sen alıyorsun") are only ever loaded for the claimer.
export default function WishesView({ wishes, me, partner, onOpen, onAdd, header }) {
  const [whose, setWhose] = useState('mine')
  const [category, setCategory] = useState('all')
  const [showDone, setShowDone] = useState(false)

  const ownerId = whose === 'mine' ? me : partner?.id
  const list = wishes.filter((w) => w.owner === ownerId && (category === 'all' || w.category === category))
  const open = list.filter((w) => w.status === 'open').sort((a, b) => Number(b.loved) - Number(a.loved))
  const done = list.filter((w) => w.status === 'done')

  return (
    <>
      {header}
      <main className="content">
        {partner && (
          <div className="segmented" role="tablist" aria-label="Kimin listesi">
            <button className={whose === 'mine' ? 'is-active' : ''} onClick={() => setWhose('mine')}>
              Benim dileklerim
            </button>
            <button className={whose === 'partner' ? 'is-active' : ''} onClick={() => setWhose('partner')}>
              {genitive(partner.name)} dilekleri
            </button>
          </div>
        )}

        {whose === 'partner' && (
          <p className="hint center">
            🤫 Bir dileği “ben alıyorum” diye işaretlersen {partner.name} bunu göremez. İstersen sürpriz plana çevir.
          </p>
        )}

        <div className="chips" role="radiogroup" aria-label="Kategori">
          <button className={`chip ${category === 'all' ? 'is-active' : ''}`} style={{ '--tag': 'var(--rose)' }} onClick={() => setCategory('all')}>
            Tümü
          </button>
          {Object.entries(WISH_CATEGORIES).map(([key, c]) => (
            <button
              key={key}
              className={`chip ${category === key ? 'is-active' : ''}`}
              style={{ '--tag': 'var(--rose)' }}
              onClick={() => setCategory(key)}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {open.length ? (
          <div className="event-list">
            {open.map((w) => (
              <WishCard key={w.id} wish={w} onClick={() => onOpen(w)} />
            ))}
          </div>
        ) : whose === 'mine' ? (
          <button className="empty" onClick={onAdd}>
            Listen boş. Hediye, gezi ya da deneyim… Aklındaki ilk dileği ekle ✨
            {partner && <small>{dative(partner.name)} hediye fikri vermiş olursun 😉</small>}
          </button>
        ) : (
          <p className="empty">{partner?.name} henüz bir dilek eklemedi. Belki bir hatırlatma? 💌</p>
        )}

        {done.length > 0 && (
          <section className="agenda">
            <button className="link-btn" onClick={() => setShowDone((v) => !v)}>
              ✨ Gerçekleşenler ({done.length}) {showDone ? '▴' : '▾'}
            </button>
            {showDone && (
              <div className="event-list">
                {done.map((w) => (
                  <WishCard key={w.id} wish={w} onClick={() => onOpen(w)} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </>
  )
}
