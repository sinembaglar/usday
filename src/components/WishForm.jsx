import { useRef, useState } from 'react'
import { WISH_CATEGORIES } from '../lib/constants'
import { resizeImage } from '../lib/image'

const EMPTY = { category: 'gift', title: '', link: '', price: '', note: '', photo: null, loved: false }

export default function WishForm({ initial, onSave, onDelete, onCancel }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initial }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function pickPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) {
      const dataUrl = await resizeImage(file, 1200)
      setForm((f) => ({ ...f, photo: { dataUrl } }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      await onSave(form)
    } catch {
      setError('Kaydedilemedi, tekrar dener misin?')
      setSaving(false)
    }
  }

  const photoSrc = form.photo?.dataUrl ?? form.photo?.url

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      <h3>{initial?.id ? 'Dileği düzenle' : 'Yeni dilek'}</h3>

      <div className="categories three" role="radiogroup" aria-label="Kategori">
        {Object.entries(WISH_CATEGORIES).map(([key, c]) => (
          <button
            type="button"
            key={key}
            role="radio"
            aria-checked={form.category === key}
            className={`category ${form.category === key ? 'is-active' : ''}`}
            style={{ '--tag': 'var(--rose)' }}
            onClick={() => setForm((f) => ({ ...f, category: key }))}
          >
            <span>{c.emoji}</span>
            {c.label}
          </button>
        ))}
      </div>

      <input
        className="input title-input"
        placeholder={WISH_CATEGORIES[form.category].placeholder}
        maxLength={120}
        value={form.title}
        onChange={set('title')}
      />

      <div className="row">
        <label className="field">
          <span>Bağlantı</span>
          <input className="input" type="url" inputMode="url" placeholder="🔗 Ürün ya da mekân linki" maxLength={500} value={form.link} onChange={set('link')} />
        </label>
      </div>
      <div className="row">
        <label className="field">
          <span>Fiyat (isteğe bağlı)</span>
          <input className="input" placeholder="örn. ~2.000 ₺" maxLength={40} value={form.price} onChange={set('price')} />
        </label>
      </div>

      <textarea className="input" rows={2} placeholder="Not: beden, renk, hangi gün… 📝" maxLength={1000} value={form.note} onChange={set('note')} />

      <div className="photo-picker">
        {photoSrc && (
          <div className="photo-thumb">
            <img src={photoSrc} alt="" />
            <button type="button" aria-label="Kaldır" onClick={() => setForm((f) => ({ ...f, photo: null }))}>
              ×
            </button>
          </div>
        )}
        {!photoSrc && (
          <button type="button" className="photo-add" onClick={() => fileRef.current?.click()}>
            <span>📷</span>
            Fotoğraf
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
      </div>

      <label className={`surprise-toggle propose-toggle ${form.loved ? 'is-on' : ''}`}>
        <input type="checkbox" checked={form.loved} onChange={set('loved')} />
        <span className="switch" />
        <span>
          <strong>💖 Çok istiyorum</strong>
          <small>Listenin en üstünde görünür</small>
        </span>
      </label>

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
        <button type="submit" className="btn btn-primary" disabled={saving || !form.title.trim()}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}
