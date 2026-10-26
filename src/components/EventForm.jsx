import { useState } from 'react'
import { DEFAULT_TEASER, TAGS, TEMPLATES, isTemplateTitle } from '../lib/constants'
import PhotoPicker from './PhotoPicker'
import TemplateRow from './TemplateRow'

const EMPTY = {
  title: '',
  time: '',
  tag: 'date',
  note: '',
  photos: [],
  surprise: false,
  teaser: '',
  revealOn: '',
  blurPhotos: false,
}

export default function EventForm({
  initial,
  preset,
  defaultDate,
  templates = [],
  onAddTemplate,
  onDeleteTemplate,
  onSave,
  onDelete,
  onCancel,
}) {
  const [form, setForm] = useState(() => ({ ...EMPTY, date: defaultDate, ...preset, ...initial }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  // Switching category drops a ready-made title from the previous one; typed titles stay.
  function chooseCategory(tag) {
    const fromTemplate = (title) => isTemplateTitle(title) || templates.some((t) => t.title === title)
    setForm((f) => (fromTemplate(f.title) && f.tag !== tag ? { ...f, tag, title: '', time: '' } : { ...f, tag }))
  }

  const category = TEMPLATES[form.tag]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.date || saving) return
    setSaving(true)
    setError('')
    try {
      await onSave({
      ...form,
      title: form.title.trim(),
      teaser: form.surprise ? form.teaser.trim() || DEFAULT_TEASER : '',
      revealOn: form.surprise ? form.revealOn || form.date : '',
      blurPhotos: form.surprise && form.blurPhotos,
      })
    } catch {
      setError('Kaydedilemedi. İnternet bağlantını kontrol edip tekrar dener misin?')
      setSaving(false)
    }
  }

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      <h3>{initial ? 'Planı düzenle' : 'Yeni plan'}</h3>

      <div className="categories" role="radiogroup" aria-label="Kategori">
        {Object.entries(TAGS).map(([key, tag]) => (
          <button
            type="button"
            key={key}
            role="radio"
            aria-checked={form.tag === key}
            className={`category ${form.tag === key ? 'is-active' : ''}`}
            style={{ '--tag': tag.color }}
            onClick={() => chooseCategory(key)}
          >
            <span>{tag.emoji}</span>
            {tag.label}
          </button>
        ))}
      </div>

      {!initial && category && (
        <TemplateRow
          tag={form.tag}
          custom={templates}
          selectedTitle={form.title}
          draft={form}
          onPick={(t) => setForm((f) => ({ ...f, title: t.title, time: t.time }))}
          onAdd={onAddTemplate}
          onDelete={onDeleteTemplate}
        />
      )}

      <input className="input title-input" placeholder="Ne yapıyoruz?" value={form.title} onChange={set('title')} />

      <div className="row">
        <label className="field">
          <span>Tarih</span>
          <input className="input" type="date" value={form.date} onChange={set('date')} required />
        </label>
        <label className="field">
          <span>Saat</span>
          <input className="input" type="time" value={form.time} onChange={set('time')} />
        </label>
      </div>

      <textarea className="input" rows={2} placeholder="Not ekle…" value={form.note} onChange={set('note')} />

      <PhotoPicker photos={form.photos} onChange={(photos) => setForm((f) => ({ ...f, photos }))} />

      <label className={`surprise-toggle ${form.surprise ? 'is-on' : ''}`}>
        <input type="checkbox" checked={form.surprise} onChange={set('surprise')} />
        <span className="switch" />
        <span>
          <strong>🎁 Sürpriz modu</strong>
          <small>Eşin sadece ipucunu görür, detaylar açılış gününe kadar gizli kalır</small>
        </span>
      </label>

      {form.surprise && (
        <div className="surprise-fields">
          <label className="field">
            <span>Eşine gidecek ipucu</span>
            <input className="input" placeholder={DEFAULT_TEASER} value={form.teaser} onChange={set('teaser')} />
          </label>
          <label className="field">
            <span>Ne zaman açılsın?</span>
            <input className="input" type="date" value={form.revealOn || form.date} max={form.date} onChange={set('revealOn')} />
          </label>
          {form.photos.length > 0 && (
            <label className="check">
              <input type="checkbox" checked={form.blurPhotos} onChange={set('blurPhotos')} />
              Biletleri / fotoğrafları açılana kadar bulanık göster 🔒
            </label>
          )}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        {onDelete && (
          <button type="button" className="btn btn-ghost danger" onClick={onDelete}>
            Sil
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Vazgeç
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}
