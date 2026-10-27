import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { WISH_CATEGORIES } from '../lib/constants'
import WishCard from './WishCard'

// My wish list and those of the people I am connected with: one row to pick whose list, with the
// category as a small menu at its end. Claims ("sen alıyorsun") are never loaded on my own wishes.
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
        <div className="filter-row">
          <div className="people-bar" role="tablist" aria-label="Kimin listesi">
            <button className={`person-chip ${!person ? 'is-active' : ''}`} onClick={() => setWhose('mine')}>
              <span className="person-avatar all">Ben</span>
              Benim
            </button>
            {people.map((p) => (
              <button key={p.id} className={`person-chip ${whose === p.id ? 'is-active' : ''}`} onClick={() => setWhose(p.id)}>
                <span className="person-avatar" style={{ background: p.color }}>
                  {p.short}
                </span>
                {p.name}
              </button>
            ))}
          </div>
          <label className="select-chip">
            <span className="visually-hidden">Kategori</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">Tümü</option>
              {Object.entries(WISH_CATEGORIES).map(([key, c]) => (
                <option key={key} value={key}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
        </div>

        {person && <p className="hint">“Ben alıyorum” dediğin dileği {person.name} göremez.</p>}

        {open.length ? (
          <div className="wish-grid">
            {open.map((w) => (
              <WishCard key={w.id} wish={w} onClick={() => onOpen(w)} />
            ))}
          </div>
        ) : !person ? (
          <button className="empty" onClick={onAdd}>
            Listen boş. Hediye, gezi ya da deneyim: aklındaki ilk dileği ekle.
            {people.length > 0 && <small>Sevdiklerine hediye fikri vermiş olursun.</small>}
          </button>
        ) : (
          <p className="empty">{person.name} henüz bir dilek eklemedi.</p>
        )}

        {done.length > 0 && (
          <section className="agenda">
            <button className="link-btn" onClick={() => setShowDone((v) => !v)}>
              Gerçekleşenler ({done.length}) <ChevronDown size={14} className={showDone ? 'is-flipped' : ''} aria-hidden="true" />
            </button>
            {showDone && (
              <div className="wish-grid">
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
