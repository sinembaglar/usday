import { RELATIONS, UNKNOWN_PERSON } from '../lib/constants'

// The people strip: pick one or several connections; calendar, cover and wishes follow the choice.
export default function PeopleBar({ connections, members, selected, onChange, onAdd }) {
  const all = selected.length === connections.length

  function toggle(id) {
    if (all) return onChange([id]) // from "Tümü", a tap focuses on that person
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    onChange(next.length ? next : [id])
  }

  return (
    <div className="people-bar" role="group" aria-label="Kişiler">
      {connections.length > 1 && (
        <button
          className={`person-chip ${all ? 'is-active' : ''}`}
          aria-pressed={all}
          onClick={() => onChange(connections.map((c) => c.id))}
        >
          <span className="person-avatar all">✨</span>
          Tümü
        </button>
      )}
      {connections.map((c) => {
        const person = c.partnerId ? (members[c.partnerId] ?? UNKNOWN_PERSON) : null
        const on = !all && selected.includes(c.id)
        const relation = RELATIONS[c.relation] ?? RELATIONS.partner
        return (
          <button
            key={c.id}
            className={`person-chip ${on || (all && connections.length === 1) ? 'is-active' : ''} ${person ? '' : 'is-pending'}`}
            aria-pressed={on}
            onClick={() => toggle(c.id)}
          >
            <span className="person-avatar" style={{ background: person?.color ?? 'var(--blush)' }}>
              {person ? person.short : '⏳'}
              <i>{relation.emoji}</i>
            </span>
            {person ? person.name : 'Davet bekliyor'}
          </button>
        )
      })}
      <button className="person-chip add" onClick={onAdd} aria-label="Kişi ekle">
        <span className="person-avatar add">＋</span>
        Kişi ekle
      </button>
    </div>
  )
}
