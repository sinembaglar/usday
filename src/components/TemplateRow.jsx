import { useState } from 'react'
import { TAGS, templatesFor } from '../lib/constants'

// Ready-made ideas for the chosen category (worded for this connection), plus the connection's
// own ones and a way to add more.
export default function TemplateRow({ tag, relation, custom, selectedTitle, draft, onPick, onAdd, onDelete }) {
  const [adding, setAdding] = useState(false)
  const [entry, setEntry] = useState({ title: '', time: '' })
  const [error, setError] = useState('')

  const category = templatesFor(tag, relation)
  const color = TAGS[tag].color
  const own = custom.filter((t) => t.tag === tag)

  function startAdding() {
    // Offer the plan being typed as the new template.
    const typed = draft.title.trim()
    const isBuiltIn = category.items.some((t) => t.title === typed) || own.some((t) => t.title === typed)
    setEntry(typed && !isBuiltIn ? { title: typed, time: draft.time } : { title: '', time: '' })
    setError('')
    setAdding(true)
  }

  async function save() {
    const title = entry.title.trim()
    if (!title) return
    try {
      await onAdd({ tag, title, time: entry.time })
      setAdding(false)
    } catch {
      setError('Eklenemedi. Aynı isimde bir şablon olabilir.')
    }
  }

  async function remove(template) {
    if (!window.confirm(`“${template.title}” şablonu ikinizden de silinsin mi?`)) return
    await onDelete(template.id)
  }

  return (
    <div className="template-group">
      <small>{category.heading}</small>
      <div className="templates" aria-label={category.heading}>
        <button type="button" className="chip add-chip" onClick={startAdding} aria-label="Kendi şablonunu ekle">
          ＋ Ekle
        </button>
        {own.map((t) => (
          <span
            key={t.id}
            className={`chip own-chip ${selectedTitle === t.title ? 'is-active' : ''}`}
            style={{ '--tag': color }}
          >
            <button type="button" onClick={() => onPick(t)}>
              {t.title}
            </button>
            <button type="button" className="own-remove" aria-label={`${t.title} şablonunu sil`} onClick={() => remove(t)}>
              ×
            </button>
          </span>
        ))}
        {category.items.map((t) => (
          <button
            type="button"
            key={t.title}
            className={`chip ${selectedTitle === t.title ? 'is-active' : ''}`}
            style={{ '--tag': color }}
            onClick={() => onPick(t)}
          >
            {t.title}
          </button>
        ))}
      </div>

      {adding && (
        <div className="template-add">
          <input
            className="input"
            placeholder="Örn. 🍣 Sushi akşamı"
            maxLength={60}
            value={entry.title}
            onChange={(e) => setEntry((x) => ({ ...x, title: e.target.value }))}
            autoFocus
          />
          <input
            className="input time-input"
            type="time"
            aria-label="Varsayılan saat"
            value={entry.time}
            onChange={(e) => setEntry((x) => ({ ...x, time: e.target.value }))}
          />
          <div className="template-add-actions">
            <small className="hint">Emoji ekleyebilirsin. Şablon ikinizde de görünür.</small>
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>
              Vazgeç
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={!entry.title.trim()}>
              Ekle
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>
      )}
    </div>
  )
}
