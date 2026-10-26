import { useState } from 'react'
import { DEFAULT_TEASER, TAGS, TEMPLATES, isTemplateTitle } from '../lib/constants'
import { REPEATS } from '../lib/recurrence'
import { dative } from '../lib/format'
import PhotoPicker from './PhotoPicker'
import TemplateRow from './TemplateRow'

const EMPTY = {
  title: '',
  time: '',
  endTime: '',
  location: '',
  repeat: 'none',
  repeatUntil: '',
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
  partnerName, // set when there is someone to ask
  onSave,
  onDelete, // (scope: 'one' | 'all') => void
  onCancel,
}) {
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    date: defaultDate,
    ...preset,
    ...initial,
    // Keep asking while a plan is unanswered; a declined one is re-asked by default.
    propose: Boolean(partnerName) && (initial?.status === 'proposed' || initial?.status === 'declined'),
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  // Switching category drops a ready-made title from the previous one; typed titles stay.
  function chooseCategory(tag) {
    const fromTemplate = (title) => isTemplateTitle(title) || templates.some((t) => t.title === title)
    setForm((f) =>
      fromTemplate(f.title) && f.tag !== tag ? { ...f, tag, title: '', time: '', repeat: 'none' } : { ...f, tag },
    )
  }

  // A surprise is a one-off plan.
  function toggleSurprise(e) {
    const surprise = e.target.checked
    setForm((f) => ({ ...f, surprise, repeat: surprise ? 'none' : f.repeat }))
  }

  const category = TEMPLATES[form.tag]
  const repeating = form.repeat !== 'none'
  const wasRepeating = initial && initial.repeat !== 'none'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.date || saving) return
    setSaving(true)
    setError('')
    try {
      await onSave({
        ...form,
        title: form.title.trim(),
        endTime: form.time ? form.endTime : '',
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
          onPick={(t) =>
            setForm((f) => ({ ...f, title: t.title, time: t.time, endTime: '', repeat: f.surprise ? 'none' : (t.repeat ?? 'none') }))
          }
          onAdd={onAddTemplate}
          onDelete={onDeleteTemplate}
        />
      )}

      <input className="input title-input" placeholder="Ne yapıyoruz?" value={form.title} onChange={set('title')} />

      <div className="row">
        <label className="field">
          <span>{repeating ? 'İlk gün' : 'Tarih'}</span>
          <input className="input" type="date" value={form.date} onChange={set('date')} required />
        </label>
      </div>

      <div className="row">
        <label className="field">
          <span>Başlangıç</span>
          <input className="input" type="time" value={form.time} onChange={set('time')} />
        </label>
        <label className="field">
          <span>Bitiş</span>
          <input
            className="input"
            type="time"
            value={form.endTime}
            onChange={set('endTime')}
            disabled={!form.time}
            aria-describedby={form.time ? undefined : 'end-hint'}
          />
        </label>
      </div>
      {!form.time && (
        <small id="end-hint" className="hint form-hint">
          Saat girmezsen plan gün boyu sürer.
        </small>
      )}

      <label className="field">
        <span>Konum</span>
        <input
          className="input"
          placeholder="📍 Nerede? (örn. Zorlu PSM)"
          maxLength={200}
          value={form.location}
          onChange={set('location')}
        />
      </label>

      {!form.surprise && (
        <div className="field">
          <span>Tekrar</span>
          <div className="chips" role="radiogroup" aria-label="Tekrar">
            {Object.entries(REPEATS).map(([key, label]) => (
              <button
                type="button"
                key={key}
                role="radio"
                aria-checked={form.repeat === key}
                className={`chip ${form.repeat === key ? 'is-active' : ''}`}
                style={{ '--tag': TAGS[form.tag].color }}
                onClick={() => setForm((f) => ({ ...f, repeat: key }))}
              >
                {key === 'none' ? label : `🔁 ${label}`}
              </button>
            ))}
          </div>
          {repeating && (
            <label className="field repeat-until">
              <span>Ne zamana kadar? (boş bırakırsan hep tekrarlanır)</span>
              <input
                className="input"
                type="date"
                min={form.date}
                value={form.repeatUntil}
                onChange={set('repeatUntil')}
              />
            </label>
          )}
        </div>
      )}

      <textarea className="input" rows={2} placeholder="Not ekle…" value={form.note} onChange={set('note')} />

      <PhotoPicker photos={form.photos} onChange={(photos) => setForm((f) => ({ ...f, photos }))} />

      {partnerName && (
        <label className={`surprise-toggle propose-toggle ${form.propose ? 'is-on' : ''}`}>
          <input type="checkbox" checked={form.propose} onChange={set('propose')} />
          <span className="switch" />
          <span>
            <strong>📨 Önce {dative(partnerName)} sor</strong>
            <small>
              “Uygunum” derse plan kesinleşir; başka bir zaman da önerebilir.
              {form.surprise && ' Sürpriz olduğu için sadece ipucu ve zaman gider.'}
            </small>
          </span>
        </label>
      )}

      <label className={`surprise-toggle ${form.surprise ? 'is-on' : ''}`}>
        <input type="checkbox" checked={form.surprise} onChange={toggleSurprise} />
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

      {wasRepeating && (
        <small className="hint form-hint">🔁 Bu plan tekrarlanıyor. Değişiklikler tüm tekrarlara uygulanır.</small>
      )}

      {error && <p className="form-error">{error}</p>}

      {confirmingDelete ? (
        <div className="delete-choice">
          <strong>Tekrarlanan planı sil</strong>
          <button type="button" className="btn btn-ghost bordered" onClick={() => onDelete('one')}>
            Sadece bu günü sil
          </button>
          <button type="button" className="btn btn-ghost bordered danger" onClick={() => onDelete('all')}>
            Tüm tekrarları sil
          </button>
          <button type="button" className="link-btn" onClick={() => setConfirmingDelete(false)}>
            Vazgeç
          </button>
        </div>
      ) : (
        <div className="form-actions">
          {onDelete && (
            <button
              type="button"
              className="btn btn-ghost danger"
              onClick={() => (wasRepeating ? setConfirmingDelete(true) : onDelete('all'))}
            >
              Sil
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Kaydediliyor…' : form.propose ? 'Sor 📨' : 'Kaydet'}
          </button>
        </div>
      )}
    </form>
  )
}
