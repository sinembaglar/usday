import { useState } from 'react'
import { RELATIONS, UNKNOWN_PERSON } from '../lib/constants'

// One connection in settings: who they are to me, since when, or withdraw an open invitation.
function ConnectionRow({ connection, members, onRelation, onSince, onCancel, onReport }) {
  const [since, setSince] = useState(connection.togetherSince)
  const person = connection.partnerId ? (members[connection.partnerId] ?? UNKNOWN_PERSON) : null
  const relation = RELATIONS[connection.relation] ?? RELATIONS.partner

  return (
    <div className="connection-row">
      <strong>
        {relation.emoji} {person ? person.name : 'Davet bekliyor'}
      </strong>
      <div className="chips" role="radiogroup" aria-label="İlişki">
        {Object.entries(RELATIONS).map(([key, r]) => (
          <button
            key={key}
            role="radio"
            aria-checked={connection.relation === key}
            className={`chip ${connection.relation === key ? 'is-active' : ''}`}
            style={{ '--tag': 'var(--rose)' }}
            onClick={() => key !== connection.relation && onRelation(connection, key)}
          >
            {r.emoji} {r.label}
          </button>
        ))}
      </div>
      {relation.since && (
        <label className="field">
          <span>{relation.since}</span>
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
        <button className="link-btn danger-link" onClick={() => onReport(person)}>
          🚩 {person.name} hakkında şikayet et
        </button>
      )}
    </div>
  )
}

export default function ConnectionSettings({ connections, members, onRelation, onSince, onCancel, onReport }) {
  return (
    <section className="settings-group">
      <h4>👥 Kişiler</h4>
      <p className="hint">
        Gün sayacı ve yıldönümleri sevgili ve arkadaş bağlantılarında kapakta ve takvimde görünür.
      </p>
      {connections.map((c) => (
        <ConnectionRow
          key={`${c.id}-${c.togetherSince}`}
          connection={c}
          members={members}
          onRelation={onRelation}
          onSince={onSince}
          onCancel={onCancel}
          onReport={onReport}
        />
      ))}
    </section>
  )
}
