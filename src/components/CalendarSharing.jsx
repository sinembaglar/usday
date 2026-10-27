import { useState } from 'react'
import { UNKNOWN_PERSON } from '../lib/constants'
import { setCalendarShare } from '../lib/api'
import { genitive } from '../lib/format'

const LEVELS = [
  { id: null, label: 'Kapalı' },
  { id: 'busy', label: '🔒 Dolu/boş' },
  { id: 'details', label: '📅 Plan adlarıyla' },
]

// Settings: who sees my whole calendar (all my connections' plans), and how much of it.
export default function CalendarSharing({ me, people, members, shares, onChanged, onToast }) {
  const [busy, setBusy] = useState(null)

  async function choose(personId, level) {
    setBusy(personId)
    try {
      // Tell them when sharing starts (not when only the level changes).
      await setCalendarShare(me, personId, level, !shares.byMe[personId])
      const name = (members[personId] ?? UNKNOWN_PERSON).name
      onToast(level ? `📅 Takvimin ${name} ile paylaşıldı` : `${name} artık takvimini görmüyor`)
      onChanged()
    } catch {
      onToast('Kaydedilemedi, tekrar dener misin?')
    }
    setBusy(null)
  }

  if (!people.length) return null
  const withMe = Object.keys(shares.withMe)

  return (
    <section className="settings-group">
      <h4>📅 Takvimimi paylaş</h4>
      <p className="hint">
        Seçtiğin kişi, diğer bağlantılarındaki planlarını da takviminde görür. Böylece boş olduğun bir zamana plan
        önerebilir. Yer, not, fotoğraf ve kimlerle olduğun hiçbir zaman görünmez. Sürprizler sadece “dolu” görünür.
      </p>
      {people.map((id) => {
        const current = shares.byMe[id] ?? null
        return (
          <div key={id} className="share-row">
            <strong>{(members[id] ?? UNKNOWN_PERSON).name}</strong>
            <div className="segmented">
              {LEVELS.map((l) => (
                <button
                  key={l.label}
                  className={current === l.id ? 'is-active' : ''}
                  disabled={busy === id}
                  onClick={() => current !== l.id && choose(id, l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {withMe.length > 0 && (
        <p className="hint">
          Seninle paylaşanlar:{' '}
          {withMe
            .map((id) => `${genitive((members[id] ?? UNKNOWN_PERSON).name)} takvimi (${shares.withMe[id] === 'details' ? 'plan adlarıyla' : 'dolu/boş'})`)
            .join(', ')}
          . Kişiyi üstten seçince planları takviminde soluk görünür.
        </p>
      )}
    </section>
  )
}
