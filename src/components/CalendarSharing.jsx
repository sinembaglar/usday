import { useState } from 'react'
import { UNKNOWN_PERSON } from '../lib/constants'
import { setCalendarShare } from '../lib/api'
import { genitive } from '../lib/format'
import { t } from '../lib/i18n'

const LEVELS = [
  { id: null, label: t('Kapalı', 'Off') },
  { id: 'busy', label: t('Dolu/boş', 'Busy/free') },
  { id: 'details', label: t('Plan adları', 'Plan names') },
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
      onToast(
        level
          ? t(`📅 Takvimin ${name} ile paylaşıldı`, `📅 Your calendar is shared with ${name}`)
          : t(`${name} artık takvimini görmüyor`, `${name} no longer sees your calendar`),
      )
      onChanged()
    } catch {
      onToast(t('Kaydedilemedi, tekrar dener misin?', 'Couldn’t save. Try again?'))
    }
    setBusy(null)
  }

  if (!people.length) return null
  const withMe = Object.keys(shares.withMe)

  return (
    <section className="settings-group">
      <h4>{t('Takvimimi paylaş', 'Share my calendar')}</h4>
      <p className="hint">
        {t(
          'Seçtiğin kişi boş olduğun zamanı görür. Yer, not ve kimlerle olduğun görünmez.',
          'The people you pick see when you’re free. Places, notes and who you’re with stay hidden.',
        )}
      </p>
      {people.map((id) => {
        const current = shares.byMe[id] ?? null
        return (
          <div key={id} className="share-row">
            <span>{(members[id] ?? UNKNOWN_PERSON).name}</span>
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
          {t('Seninle paylaşanlar:', 'Shared with you:')}{' '}
          {withMe
            .map((id) => {
              const name = (members[id] ?? UNKNOWN_PERSON).name
              const level = shares.withMe[id] === 'details' ? t('plan adlarıyla', 'with plan names') : t('dolu/boş', 'busy/free')
              return t(`${genitive(name)} takvimi (${level})`, `${name}’s calendar (${level})`)
            })
            .join(', ')}
          .
        </p>
      )}
    </section>
  )
}
