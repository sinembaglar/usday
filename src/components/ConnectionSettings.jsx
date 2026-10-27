import { useState } from 'react'
import { ChevronDown, Flag, Hourglass, UserMinus } from 'lucide-react'
import { RELATIONS, UNKNOWN_PERSON } from '../lib/constants'
import { RELATION_ICONS } from '../lib/icons'

// One connection in settings: a row; tapping it opens who they are to me, since when, and the
// rarer actions (withdraw an invitation, remove, report).
function ConnectionRow({ connection, members, open, onToggle, onRelation, onSince, onCancel, onReport, onRemove }) {
  const [since, setSince] = useState(connection.togetherSince)
  const person = connection.partnerId ? (members[connection.partnerId] ?? UNKNOWN_PERSON) : null
  const relation = RELATIONS[connection.relation] ?? RELATIONS.partner

  return (
    <div className={`list-item ${open ? 'is-open' : ''}`}>
      <button className="list-row" onClick={onToggle} aria-expanded={open}>
        <span className="person-avatar" style={{ background: person?.color ?? 'var(--blush)' }}>
          {person ? person.short : <Hourglass size={14} aria-hidden="true" />}
        </span>
        <span className="row-text">
          {person ? person.name : 'Davet bekliyor'}
          <small>
            {relation.label}
            {!person && ` · kod ${connection.inviteCode}`}
          </small>
        </span>
        <ChevronDown size={18} className="row-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="list-detail">
          <div className="chips" role="radiogroup" aria-label="İlişki">
            {Object.entries(RELATIONS).map(([key, r]) => {
              const Icon = RELATION_ICONS[key]
              return (
                <button
                  key={key}
                  role="radio"
                  aria-checked={connection.relation === key}
                  className={`chip icon-chip ${connection.relation === key ? 'is-active' : ''}`}
                  style={{ '--tag': 'var(--rose)' }}
                  onClick={() => key !== connection.relation && onRelation(connection, key)}
                >
                  <Icon size={14} aria-hidden="true" />
                  {r.label}
                </button>
              )
            })}
          </div>
          {relation.since && (
            <label className="field">
              <span>{relation.since} · gün sayacı ve yıldönümü için</span>
              <div className="inline-form">
                <input
                  className="input"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={since}
                  onChange={(e) => setSince(e.target.value)}
                />
                <button className="btn btn-primary" disabled={since === connection.togetherSince} onClick={() => onSince(connection, since)}>
                  Kaydet
                </button>
              </div>
            </label>
          )}
          {!person && (
            <button className="link-btn danger-link" onClick={() => onCancel(connection)}>
              Bu daveti iptal et
            </button>
          )}
          {person && (
            <div className="connection-links">
              <button className="link-btn danger-link" onClick={() => onRemove(connection, person)}>
                <UserMinus size={15} aria-hidden="true" /> Kaldır / engelle
              </button>
              <button className="link-btn danger-link" onClick={() => onReport(connection, person)}>
                <Flag size={15} aria-hidden="true" /> Şikayet et
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ConnectionSettings({ connections, members, onRelation, onSince, onCancel, onReport, onRemove }) {
  const [open, setOpen] = useState(null)

  return (
    <section className="settings-group">
      <h4>Kişiler</h4>
      <div className="list-card">
        {/* People first; invitations nobody has joined yet at the end. */}
        {[...connections].sort((a, b) => Number(!a.partnerId) - Number(!b.partnerId)).map((c) => (
          <ConnectionRow
            key={`${c.id}-${c.togetherSince}`}
            connection={c}
            members={members}
            open={open === c.id}
            onToggle={() => setOpen((o) => (o === c.id ? null : c.id))}
            onRelation={onRelation}
            onSince={onSince}
            onCancel={onCancel}
            onReport={onReport}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  )
}
