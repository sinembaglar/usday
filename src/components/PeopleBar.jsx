import { Lock, Plus, Users } from 'lucide-react'
import { UNKNOWN_PERSON } from '../lib/constants'

// The people strip: pick one or several connections; calendar and cover follow the choice.
// An invitation nobody has joined yet is not a person: it waits behind "Kişi ekle".
export default function PeopleBar({ connections, members, selected, locked, onChange, onAdd }) {
  const joined = connections.filter((c) => c.partnerId)
  const all = selected.length === connections.length

  function toggle(id) {
    if (all) return onChange([id]) // from "Tümü", a tap focuses on that person
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    onChange(next.length ? next : [id])
  }

  return (
    <div className="people-bar" role="group" aria-label="Kişiler">
      {joined.length > 1 && (
        <button
          className={`person-chip ${all ? 'is-active' : ''}`}
          aria-pressed={all}
          onClick={() => onChange(connections.map((c) => c.id))}
        >
          <span className="person-avatar all">
            <Users size={15} aria-hidden="true" />
          </span>
          Tümü
        </button>
      )}
      {joined.map((c) => {
        const person = members[c.partnerId] ?? UNKNOWN_PERSON
        const on = !all && selected.includes(c.id)
        return (
          <button
            key={c.id}
            className={`person-chip ${on || (all && joined.length === 1) ? 'is-active' : ''}`}
            aria-pressed={on}
            onClick={() => toggle(c.id)}
          >
            <span className="person-avatar" style={{ background: person.color }}>
              {person.short}
              {locked?.has(c.id) && (
                <span className="person-lock" aria-label="salt okunur">
                  <Lock size={9} strokeWidth={2.6} aria-hidden="true" />
                </span>
              )}
            </span>
            {person.name}
          </button>
        )
      })}
      <button className="person-chip add" onClick={onAdd}>
        <span className="person-avatar add">
          <Plus size={16} aria-hidden="true" />
        </span>
        Kişi ekle
      </button>
    </div>
  )
}
