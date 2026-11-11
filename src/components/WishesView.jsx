import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { WISH_CATEGORIES } from '../lib/constants'
import WishCard from './WishCard'
import { t } from '../lib/i18n'

// My wish list and those of the people I am connected with: one row to pick whose list, with the
// category as a small menu at its end. Claims ("sen alıyorsun") are never loaded on my own wishes.
export default function WishesView({ wishes, me, people, initialWhose, onOpen, onAdd, header }) {
  const [whose, setWhose] = useState(initialWhose ?? 'mine')
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
          <div className="people-bar" role="group" aria-label={t('Kimin listesi', 'Whose list')}>
            <button className={`person-chip ${!person ? 'is-active' : ''}`} aria-pressed={!person} onClick={() => setWhose('mine')}>
              <span className="person-avatar all">{t('Ben', 'Me')}</span>
              {t('Benim', 'Mine')}
            </button>
            {people.map((p) => (
              <button
                key={p.id}
                className={`person-chip ${whose === p.id ? 'is-active' : ''}`}
                aria-pressed={whose === p.id}
                onClick={() => setWhose(p.id)}
              >
                <span className="person-avatar" style={{ background: p.color }}>
                  {p.short}
                </span>
                {p.name}
              </button>
            ))}
          </div>
          <label className="select-chip">
            <span className="visually-hidden">{t('Kategori', 'Category')}</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">{t('Tümü', 'All')}</option>
              {Object.entries(WISH_CATEGORIES).map(([key, c]) => (
                <option key={key} value={key}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
        </div>

        {person && (
          <p className="hint">
            {t(`“Ben alıyorum” dediğin dileği ${person.name} göremez.`, `${person.name} never sees which wishes you said you’re getting.`)}
          </p>
        )}

        {open.length ? (
          <div className="wish-grid">
            {open.map((w) => (
              <WishCard key={w.id} wish={w} onClick={() => onOpen(w)} />
            ))}
          </div>
        ) : !person ? (
          <button className="empty" onClick={onAdd}>
            {t('Listen boş. Hediye, gezi ya da deneyim: aklındaki ilk dileği ekle.', 'Your list is empty. A gift, a trip or an experience: add the first wish on your mind.')}
            {people.length > 0 && <small>{t('Sevdiklerine hediye fikri vermiş olursun.', 'It gives your people gift ideas.')}</small>}
          </button>
        ) : (
          <p className="empty">{t(`${person.name} henüz bir dilek eklemedi.`, `${person.name} hasn’t added any wishes yet.`)}</p>
        )}

        {done.length > 0 && (
          <section className="agenda">
            <button className="link-btn" onClick={() => setShowDone((v) => !v)}>
              {t('Gerçekleşenler', 'Came true')} ({done.length}) <ChevronDown size={14} className={showDone ? 'is-flipped' : ''} aria-hidden="true" />
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
