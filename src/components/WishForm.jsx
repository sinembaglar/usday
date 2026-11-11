import { useRef, useState } from 'react'
import { Camera, Heart, X } from 'lucide-react'
import { WISH_CATEGORIES } from '../lib/constants'
import { WISH_ICONS } from '../lib/icons'
import { resizeImage } from '../lib/image'
import { t } from '../lib/i18n'

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
      setError(t('Kaydedilemedi, tekrar dener misin?', 'Couldn’t save. Try again?'))
      setSaving(false)
    }
  }

  const photoSrc = form.photo?.dataUrl ?? form.photo?.url

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      <h3>{initial?.id ? t('Dileği düzenle', 'Edit wish') : t('Yeni dilek', 'New wish')}</h3>

      <input
        className="input title-input"
        placeholder={WISH_CATEGORIES[form.category].placeholder}
        maxLength={120}
        value={form.title}
        onChange={set('title')}
      />

      <div className="chips" role="radiogroup" aria-label={t('Kategori', 'Category')}>
        {Object.entries(WISH_CATEGORIES).map(([key, c]) => {
          const Icon = WISH_ICONS[key]
          return (
            <button
              type="button"
              key={key}
              role="radio"
              aria-checked={form.category === key}
              className={`chip icon-chip ${form.category === key ? 'is-active' : ''}`}
              style={{ '--tag': 'var(--rose)' }}
              onClick={() => setForm((f) => ({ ...f, category: key }))}
            >
              <Icon size={15} aria-hidden="true" />
              {c.label}
            </button>
          )
        })}
      </div>

      <label className="field">
        <span>{t('Bağlantı', 'Link')}</span>
        <input className="input" type="url" inputMode="url" placeholder={t('Ürün ya da mekân linki', 'A link to the product or place')} maxLength={500} value={form.link} onChange={set('link')} />
      </label>
      <label className="field">
        <span>{t('Fiyat (isteğe bağlı)', 'Price (optional)')}</span>
        <input className="input" placeholder={t('örn. ~2.000 ₺', 'e.g. ~$50')} maxLength={40} value={form.price} onChange={set('price')} />
      </label>

      <textarea className="input" rows={2} placeholder={t('Not: beden, renk, hangi gün…', 'Note: size, colour, which day…')} maxLength={1000} value={form.note} onChange={set('note')} />

      <div className="photo-picker">
        {photoSrc && (
          <div className="photo-thumb">
            <img src={photoSrc} alt="" />
            <button type="button" aria-label={t('Kaldır', 'Remove')} onClick={() => setForm((f) => ({ ...f, photo: null }))}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
        {!photoSrc && (
          <button type="button" className="photo-add" onClick={() => fileRef.current?.click()}>
            <Camera size={22} aria-hidden="true" />
            {t('Fotoğraf', 'Photo')}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
      </div>

      <label className={`surprise-toggle propose-toggle ${form.loved ? 'is-on' : ''}`}>
        <input type="checkbox" checked={form.loved} onChange={set('loved')} />
        <span className="switch" />
        <span>
          <strong>
            <Heart size={15} aria-hidden="true" /> {t('Çok istiyorum', 'I really want this')}
          </strong>
          <small>{t('Listenin en üstünde görünür', 'Shows at the top of your list')}</small>
        </span>
      </label>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        {onDelete && (
          <button type="button" className="btn btn-ghost danger" onClick={onDelete}>
            {t('Sil', 'Delete')}
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t('Vazgeç', 'Cancel')}
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving || !form.title.trim()}>
          {saving ? t('Kaydediliyor…', 'Saving…') : t('Kaydet', 'Save')}
        </button>
      </div>
    </form>
  )
}
