import { useState } from 'react'
import { Check, Gift, Hourglass, Repeat, Send, TriangleAlert } from 'lucide-react'
import { DEFAULT_TEASER, TAGS, isTemplateTitle, tagLabel, templatesFor } from '../lib/constants'
import { tagIcon } from '../lib/icons'
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
  connections = [], // [{ id, relation, relationLabel, partnerName, partnerId, emoji, color, short }]
  defaultCoupleId,
  defaultCoupleIds, // several people chosen in the people bar: start as a group plan with them
  findConflicts, // (when, coupleIds, editingId) => ["O saatte “Sinema” planın var (20:00)", …]
  onSave, // gets the form with coupleIds: one id = two-person plan, several = group plan
  onDelete, // (scope: 'one' | 'all') => void
  onCancel,
}) {
  const [form, setForm] = useState(() => {
    // A group plan being edited: tick the people already invited.
    const invited = initial?.guests
      ? connections.filter((c) => initial.guests.some((g) => g.id === c.partnerId)).map((c) => c.id)
      : null
    const coupleIds =
      invited ??
      (!initial && !preset?.coupleId && defaultCoupleIds?.length > 1
        ? defaultCoupleIds
        : [initial?.coupleId ?? preset?.coupleId ?? defaultCoupleId ?? connections[0]?.id])
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
  // Other plans at this time, for me or the people I am inviting (only a warning).
  const conflicts = findConflicts
    ? findConflicts(
        { date: form.date, time: form.time, endTime: form.endTime },
        form.coupleIds,
        initial?.seriesId ?? initial?.id,
      )
    : []
  const connection = group ? null : picked[0]
  // A group of only partners is still worded as a date; anything mixed is a meetup.
  const relation = picked.every((c) => c.relation === 'partner') ? 'partner' : 'friend'
  const partnerName = connection?.partnerName
  const ownTemplates = group ? [] : templates.filter((t) => t.coupleId === connection?.id)
  const linked = connections.filter((c) => c.partnerName)
  // Editing a two-person plan keeps it with the same person; a group plan can change its guests.
  const canChoose = (!initial || initial.guests) && connections.length > 1
  const allPicked = linked.length > 1 && linked.every((c) => form.coupleIds.includes(c.id))

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

  // Open invitations are offered only while nobody has joined yet: they can only be a plan on their own.
  const choices = initial?.guests || linked.length ? linked : connections

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      <h3>{initial ? 'Planı düzenle' : 'Yeni plan'}</h3>

      <input className="input title-input" placeholder="Ne yapıyoruz?" value={form.title} onChange={set('title')} />

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
          Saat yoksa gün boyu sürer.
        </small>
      )}
      {conflicts.length > 0 && (
        <div className="conflict-box" role="status">
          {conflicts.slice(0, 4).map((c) => (
            <span key={c}>
              <TriangleAlert size={14} aria-hidden="true" /> {c}
            </span>
          ))}
          {conflicts.length > 4 && <span>… ve {conflicts.length - 4} plan daha</span>}
          <small>Yine de kaydedebilirsin.</small>
        </div>
      )}

      {canChoose && (
        <div className="field guest-picker">
          <div className="guest-picker-head">
            <span>{group ? `Kiminle · ${picked.length} kişi (grup planı)` : 'Kiminle'}</span>
            {linked.length > 1 && (
              <button
                type="button"
                className="link-btn"
                onClick={() =>
                  allPicked
                    ? setForm((f) => ({ ...f, coupleIds: [linked[0].id], hiddenFrom: [] }))
                    : setForm((f) => ({ ...f, coupleIds: linked.map((c) => c.id), propose: false }))
                }
              >
                {allPicked ? 'Temizle' : 'Tümünü seç'}
              </button>
            )}
          </div>
          <div className="person-picks" role="group" aria-label="Kiminle">
            {choices.map((c) => {
              const on = form.coupleIds.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  className={`person-chip ${on ? 'is-active' : ''}`}
                  onClick={() => togglePerson(c)}
                >
                  <span className="person-avatar" style={{ background: c.color ?? 'var(--blush)' }}>
                    {on ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : c.partnerName ? c.short : <Hourglass size={14} aria-hidden="true" />}
                  </span>
                  {c.partnerName ?? 'Davet bekleyen'}
                </button>
              )
            })}
          </div>
          {group && <small className="hint">Herkes katılıp katılmayacağını söyler; davetliler birbirini görür.</small>}
        </div>
      )}

      <div className="field">
        <span>Kategori</span>
        <div className="chips" role="radiogroup" aria-label="Kategori">
          {Object.entries(TAGS).map(([key, tag]) => {
            const Icon = tagIcon(key, relation)
            return (
              <button
                type="button"
                key={key}
                role="radio"
                aria-checked={form.tag === key}
                className={`chip icon-chip ${form.tag === key ? 'is-active' : ''}`}
                style={{ '--tag': tag.color }}
                onClick={() => chooseCategory(key)}
              >
                <Icon size={15} aria-hidden="true" />
                {tagLabel(key, relation)}
              </button>
            )
          })}
        </div>
      </div>

      <label className="field">
        <span>Konum</span>
        <input
          className="input"
          placeholder="Nerede? (örn. Zorlu PSM)"
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
                className={`chip icon-chip ${form.repeat === key ? 'is-active' : ''}`}
                style={{ '--tag': TAGS[form.tag].color }}
                onClick={() => setForm((f) => ({ ...f, repeat: key }))}
              >
                {key !== 'none' && <Repeat size={14} aria-hidden="true" />}
                {label}
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
            <strong>Önce {dative(partnerName)} sor</strong>
            <small>
              “Uygunum” derse kesinleşir; başka zaman da önerebilir.
              {form.surprise && ' Sürpriz olduğu için sadece ipucu ve zaman gider.'}
            </small>
          </span>
        </label>
      )}

      <label className={`surprise-toggle ${form.surprise ? 'is-on' : ''}`}>
        <input type="checkbox" checked={form.surprise} onChange={toggleSurprise} />
        <span className="switch" />
        <span>
          <strong><Gift size={15} aria-hidden="true" /> Sürpriz modu</strong>
          <small>
            {group
              ? 'Seçtiklerin sadece ipucunu görür; diğerleri seninle hazırlar.'
              : `${partnerName ?? 'Diğer kişi'} açılış gününe kadar sadece ipucunu görür`}
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
                    {c.partnerName}
                  </button>
                ))}
              </div>
              <small className="hint">
                {form.hiddenFrom.length
                  ? (() => {
                      const insiders = picked.filter((c) => !form.hiddenFrom.includes(c.partnerId)).map((c) => c.partnerName)
                      return insiders.length
                        ? `Sen ve ${insiders.join(', ')} biliyorsunuz; hazırlık sohbeti aranızda kalır.`
                        : 'Sürprizi sadece sen biliyorsun.'
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
              Biletleri ve fotoğrafları açılana kadar bulanık göster
            </label>
          )}
        </div>
      )}

      {wasRepeating && (
        <small className="hint form-hint">Bu plan tekrarlanıyor; değişiklik tüm tekrarlara uygulanır.</small>
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
            {saving ? 'Kaydediliyor…' : form.propose ? <><Send size={16} aria-hidden="true" /> Sor</> : 'Kaydet'}
          </button>
        </div>
      )}
    </form>
  )
}
