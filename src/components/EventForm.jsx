import { useState } from 'react'
import { DEFAULT_TEASER, TAGS, isTemplateTitle, tagEmoji, tagLabel, templatesFor } from '../lib/constants'
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
  connections = [], // [{ id, relation, partnerName, partnerId, emoji }]
  defaultCoupleId,
  onSave, // gets the form with coupleIds: one id = two-person plan, several = group plan
  onDelete, // (scope: 'one' | 'all') => void
  onCancel,
}) {
  const [form, setForm] = useState(() => {
    // A group plan being edited: tick the people already invited.
    const invited = initial?.guests
      ? connections.filter((c) => initial.guests.some((g) => g.id === c.partnerId)).map((c) => c.id)
      : null
    const coupleIds = invited ?? [initial?.coupleId ?? preset?.coupleId ?? defaultCoupleId ?? connections[0]?.id]
    const canAsk = coupleIds.length === 1 && Boolean(connections.find((c) => c.id === coupleIds[0])?.partnerName)
    return {
      ...EMPTY,
      date: defaultDate,
      ...preset,
      ...initial,
      coupleIds,
      hiddenFrom: initial?.hiddenFrom ?? [],
      // Keep asking while a plan is unanswered; a declined one is re-asked by default.
      propose: canAsk && (preset?.propose ?? (initial?.status === 'proposed' || initial?.status === 'declined')),
    }
  })

  const group = form.coupleIds.length > 1
  const picked = connections.filter((c) => form.coupleIds.includes(c.id))
  const connection = group ? null : picked[0]
  // A group of only partners is still worded as a date; anything mixed is a meetup.
  const relation = picked.every((c) => c.relation === 'partner') ? 'partner' : 'friend'
  const partnerName = connection?.partnerName
  const ownTemplates = group ? [] : templates.filter((t) => t.coupleId === connection?.id)
  const linked = connections.filter((c) => c.partnerName)
  // Editing a two-person plan keeps it with the same person; a group plan can change its guests.
  const canChoose = (!initial || initial.guests) && connections.length > 1

  function togglePerson(c) {
    setForm((f) => {
      const on = f.coupleIds.includes(c.id)
      // Groups are only made of people who joined; an open invitation can only be a plan on its own.
      const next = on
        ? f.coupleIds.filter((id) => id !== c.id)
        : c.partnerName && f.coupleIds.every((id) => linked.some((l) => l.id === id))
          ? [...f.coupleIds, c.id]
          : [c.id]
      if (!next.length || (initial?.guests && next.length < 2)) return f
      const single = next.length === 1
      return {
        ...f,
        coupleIds: next,
        propose: single && connections.find((x) => x.id === next[0])?.partnerName ? f.propose : false,
        // Someone taken off the plan can no longer be the one it is hidden from.
        hiddenFrom: f.hiddenFrom.filter((id) => next.some((cid) => connections.find((x) => x.id === cid)?.partnerId === id)),
      }
    })
  }
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

  const category = templatesFor(form.tag, relation)
  const repeating = form.repeat !== 'none'
  const wasRepeating = initial && initial.repeat !== 'none'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.date || saving) return
    if (group && form.surprise && !form.hiddenFrom.length) {
      setError('Sürprizin kimden gizleneceğini seç.')
      return
    }
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

      {canChoose && (
        <div className="field">
          <span>Kiminle? {group ? `· 👥 ${picked.length} kişilik grup planı` : '· birden fazla kişi seçebilirsin'}</span>
          <div className="chips" role="group" aria-label="Kiminle">
            {(initial?.guests ? linked : connections).map((c) => (
              <button
                type="button"
                key={c.id}
                aria-pressed={form.coupleIds.includes(c.id)}
                className={`chip ${form.coupleIds.includes(c.id) ? 'is-active' : ''}`}
                style={{ '--tag': 'var(--rose)' }}
                onClick={() => togglePerson(c)}
              >
                {form.coupleIds.includes(c.id) && group ? '✓ ' : ''}
                {c.emoji} {c.partnerName ?? 'Davet bekleyen'}
              </button>
            ))}
          </div>
          {group && (
            <small className="hint">
              Herkese davet gider; “katılıyorum / katılamıyorum” der. Davetliler birbirinin adını bu planda görür.
            </small>
          )}
        </div>
      )}

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
            <span>{tagEmoji(key, relation)}</span>
            {tagLabel(key, relation)}
          </button>
        ))}
      </div>

      {!initial && category && (
        <TemplateRow
          tag={form.tag}
          relation={relation}
          custom={ownTemplates}
          selectedTitle={form.title}
          draft={form}
          onPick={(t) =>
            setForm((f) => ({ ...f, title: t.title, time: t.time, endTime: '', repeat: f.surprise ? 'none' : (t.repeat ?? 'none') }))
          }
          onAdd={(t) => onAddTemplate({ ...t, coupleId: connection?.id })}
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
          <small>
            {group
              ? 'Seçtiğin kişiler sadece ipucunu görür; diğerleri sürprizi seninle birlikte hazırlar'
              : `${partnerName ?? 'Diğer kişi'} sadece ipucunu görür, detaylar açılış gününe kadar gizli kalır`}
          </small>
        </span>
      </label>

      {form.surprise && (
        <div className="surprise-fields">
          {group && (
            <div className="field">
              <span>Kimden gizli?</span>
              <div className="chips" role="group" aria-label="Kimden gizli">
                {picked.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    aria-pressed={form.hiddenFrom.includes(c.partnerId)}
                    className={`chip ${form.hiddenFrom.includes(c.partnerId) ? 'is-active' : ''}`}
                    style={{ '--tag': 'var(--gold)' }}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        hiddenFrom: f.hiddenFrom.includes(c.partnerId)
                          ? f.hiddenFrom.filter((id) => id !== c.partnerId)
                          : [...f.hiddenFrom, c.partnerId],
                      }))
                    }
                  >
                    {form.hiddenFrom.includes(c.partnerId) ? '🎯 ' : ''}
                    {c.partnerName}
                  </button>
                ))}
              </div>
              <small className="hint">
                {form.hiddenFrom.length
                  ? (() => {
                      const insiders = picked.filter((c) => !form.hiddenFrom.includes(c.partnerId)).map((c) => c.partnerName)
                      return insiders.length
                        ? `🤫 Sen ve ${insiders.join(', ')} sürprizi biliyorsunuz; hazırlık sohbeti aranızda kalır.`
                        : '🤫 Sürprizi sadece sen biliyorsun.'
                    })()
                  : 'Sürprizin kime olduğunu seç.'}
              </small>
            </div>
          )}
          <label className="field">
            <span>{group ? 'Sürpriz olanlara gidecek ipucu' : `${partnerName ? dative(partnerName) : 'Eşine'} gidecek ipucu`}</span>
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
