import { useState } from 'react'
import { TAGS, templatesFor } from '../lib/constants'
import { t } from '../lib/i18n'

// Ready-made ideas for the chosen category (worded for this connection), plus the connection's
// own ones and a way to add more.
export default function TemplateRow({ tag, relation, custom, selectedTitle, draft, onPick, onAdd, onDelete }) {
  const [adding, setAdding] = useState(false)
  const [entry, setEntry] = useState({ title: '', time: '' })
  const [error, setError] = useState('')

  const category = templatesFor(tag, relation)
  const color = TAGS[tag].color
  const own = custom.filter((template) => template.tag === tag)

  function startAdding() {
    // Offer the plan being typed as the new template.
    const typed = draft.title.trim()
    const isBuiltIn = category.items.some((item) => item.title === typed) || own.some((template) => template.title === typed)
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
      setError(t('Eklenemedi. Aynı isimde bir şablon olabilir.', 'Couldn’t add it. There may already be a template with that name.'))
    }
  }

  async function remove(template) {
    if (!window.confirm(t(`“${template.title}” şablonu ikinizden de silinsin mi?`, `Delete the “${template.title}” template for both of you?`))) return
    await onDelete(template.id)
  }

  return (
    <div className="template-group">
      <small>{category.heading}</small>
      <div className="templates" aria-label={category.heading}>
        <button type="button" className="chip add-chip" onClick={startAdding} aria-label={t('Kendi şablonunu ekle', 'Add your own template')}>
          ＋ {t('Ekle', 'Add')}
        </button>
        {own.map((template) => (
          <span
            key={template.id}
            className={`chip own-chip ${selectedTitle === template.title ? 'is-active' : ''}`}
            style={{ '--tag': color }}
          >
            <button type="button" onClick={() => onPick(template)}>
              {template.title}
            </button>
            <button
              type="button"
              className="own-remove"
              aria-label={t(`${template.title} şablonunu sil`, `Delete the ${template.title} template`)}
              onClick={() => remove(template)}
            >
              ×
            </button>
          </span>
        ))}
        {category.items.map((item) => (
          <button
            type="button"
            key={item.title}
            className={`chip ${selectedTitle === item.title ? 'is-active' : ''}`}
            style={{ '--tag': color }}
            onClick={() => onPick(item)}
          >
            {item.title}
          </button>
        ))}
      </div>

      {adding && (
        <div className="template-add">
          <input
            className="input"
            placeholder={t('Örn. 🍣 Sushi akşamı', 'E.g. 🍣 Sushi night')}
            maxLength={60}
            value={entry.title}
            onChange={(e) => setEntry((x) => ({ ...x, title: e.target.value }))}
            autoFocus
          />
          <input
            className="input time-input"
            type="time"
            aria-label={t('Varsayılan saat', 'Default time')}
            value={entry.time}
            onChange={(e) => setEntry((x) => ({ ...x, time: e.target.value }))}
          />
          <div className="template-add-actions">
            <small className="hint">{t('Emoji ekleyebilirsin. Şablon ikinizde de görünür.', 'Emojis welcome. The template shows for both of you.')}</small>
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>
              {t('Vazgeç', 'Cancel')}
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={!entry.title.trim()}>
              {t('Ekle', 'Add')}
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>
      )}
    </div>
  )
}
