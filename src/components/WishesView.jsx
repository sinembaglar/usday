import { useState } from 'react'
import { WISH_CATEGORIES } from '../lib/constants'
import { genitive } from '../lib/format'
import WishCard from './WishCard'

// My wish list and those of the people I picked in the people bar.
// Claims ("sen alıyorsun") are only ever loaded for the person who made them.
export default function WishesView({ wishes, me, people, onOpen, onAdd, header }) {
  const [whose, setWhose] = useState('mine')
  const [category, setCategory] = useState('all')
  const [showDone, setShowDone] = useState(false)

  const person = people.find((p) => p.id === whose)
  const ownerId = person ? person.id : me
  const list = wishes.filter((w) => w.owner === ownerId && (category === 'all' || w.category === category))
  const open = list.filter((w) => w.status === 'open').sort((a, b) => Number(b.loved) - Number(a.loved))
  const done = list.filter((w) => w.status === 'done')

  return (
    <>
      {header}
      <main className="content">
        {people.length > 0 && (
          <div className="chips whose" role="tablist" aria-label="Kimin listesi">
            <button
              className={`chip ${!person ? 'is-active' : ''}`}
              style={{ '--tag': 'var(--rose)' }}
              onClick={() => setWhose('mine')}
            >
              Benim dileklerim
            </button>
            {people.map((p) => (
              <button
                key={p.id}
                className={`chip ${whose === p.id ? 'is-active' : ''}`}
                style={{ '--tag': 'var(--rose)' }}
                onClick={() => setWhose(p.id)}
              >
                {genitive(p.name)} dilekleri
              </button>
            ))}
          </div>
        )}

        {person && (
          <p className="hint center">
            🤫 Bir dileği “ben alıyorum” diye işaretlersen {person.name} bunu göremez. İstersen sürpriz plana çevir.
          </p>
        )}

        <div className="chips" role="radiogroup" aria-label="Kategori">
          <button
            className={`chip ${category === 'all' ? 'is-active' : ''}`}
            style={{ '--tag': 'var(--rose)' }}
            onClick={() => setCategory('all')}
          >
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
        ) : !person ? (
          <button className="empty" onClick={onAdd}>
            Listen boş. Hediye, gezi ya da deneyim… Aklındaki ilk dileği ekle ✨
            {people.length > 0 && <small>Sevdiklerine hediye fikri vermiş olursun 😉</small>}
          </button>
        ) : (
          <p className="empty">{person.name} henüz bir dilek eklemedi. Belki bir hatırlatma? 💌</p>
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
