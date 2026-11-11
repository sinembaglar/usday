import { useState } from 'react'
import { Check, Gift, Hourglass, Repeat, Send, TriangleAlert } from 'lucide-react'
import { DEFAULT_TEASER, TAGS, isTemplateTitle, tagLabel, templatesFor } from '../lib/constants'
import { tagIcon } from '../lib/icons'
import { REPEATS } from '../lib/recurrence'
import { dative } from '../lib/format'
import { t } from '../lib/i18n'
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
      hiddenFrom: initial?.hiddenFrom ?? preset?.hiddenFrom ?? [],
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
  const ownTemplates = group ? [] : templates.filter((template) => template.coupleId === connection?.id)
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
    const fromTemplate = (title) => isTemplateTitle(title) || templates.some((template) => template.title === title)
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
      setError(t('Sürprizin kimden gizleneceğini seç.', 'Choose who the surprise is for.'))
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
      setError(t('Kaydedilemedi. İnternet bağlantını kontrol edip tekrar dener misin?', 'Couldn’t save. Check your connection and try again?'))
      setSaving(false)
    }
  }

  // Open invitations are offered only while nobody has joined yet: they can only be a plan on their own.
  const choices = initial?.guests || linked.length ? linked : connections

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      <h3>{initial ? t('Planı düzenle', 'Edit plan') : t('Yeni plan', 'New plan')}</h3>

      <input className="input title-input" placeholder={t('Ne yapıyoruz?', 'What are we doing?')} value={form.title} onChange={set('title')} />

      {!initial && category && (
        <TemplateRow
          tag={form.tag}
          relation={relation}
          custom={ownTemplates}
          selectedTitle={form.title}
          draft={form}
          onPick={(template) =>
            setForm((f) => ({
              ...f,
              title: template.title,
              time: template.time,
              endTime: '',
              repeat: f.surprise ? 'none' : (template.repeat ?? 'none'),
            }))
          }
          onAdd={(template) => onAddTemplate({ ...template, coupleId: connection?.id })}
          onDelete={onDeleteTemplate}
        />
      )}

      <div className="row">
        <label className="field">
          <span>{repeating ? t('İlk gün', 'First day') : t('Tarih', 'Date')}</span>
          <input className="input" type="date" value={form.date} onChange={set('date')} required />
        </label>
      </div>

      <div className="row">
        <label className="field">
          <span>{t('Başlangıç', 'Starts')}</span>
          <input className="input" type="time" value={form.time} onChange={set('time')} />
        </label>
        <label className="field">
          <span>{t('Bitiş', 'Ends')}</span>
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
          {t('Saat yoksa gün boyu sürer.', 'No time means all day.')}
        </small>
      )}
      {conflicts.length > 0 && (
        <div className="conflict-box" role="status">
          {conflicts.slice(0, 4).map((c) => (
            <span key={c}>
              <TriangleAlert size={14} aria-hidden="true" /> {c}
            </span>
          ))}
          {conflicts.length > 4 && <span>{t(`… ve ${conflicts.length - 4} plan daha`, `… and ${conflicts.length - 4} more`)}</span>}
          <small>{t('Yine de kaydedebilirsin.', 'You can still save it.')}</small>
        </div>
      )}

      {canChoose && (
        <div className="field guest-picker">
          <div className="guest-picker-head">
            <span>{group ? t(`Kiminle · ${picked.length} kişi (grup planı)`, `With · ${picked.length} people (group plan)`) : t('Kiminle', 'With')}</span>
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
                {allPicked ? t('Temizle', 'Clear') : t('Tümünü seç', 'Select all')}
              </button>
            )}
          </div>
          <div className="person-picks" role="group" aria-label={t('Kiminle', 'With')}>
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
                  {c.partnerName ?? t('Davet bekleyen', 'Invite pending')}
                </button>
              )
            })}
          </div>
          {group && (
            <small className="hint">
              {t('Herkes katılıp katılmayacağını söyler; davetliler birbirini görür.', 'Everyone says whether they’re coming; guests can see each other.')}
            </small>
          )}
        </div>
      )}

      <div className="field">
        <span>{t('Kategori', 'Category')}</span>
        <div className="chips" role="radiogroup" aria-label={t('Kategori', 'Category')}>
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
        <span>{t('Konum', 'Place')}</span>
        <input
          className="input"
          placeholder={t('Nerede? (örn. Zorlu PSM)', 'Where? (e.g. the Odeon on Main St)')}
          maxLength={200}
          value={form.location}
          onChange={set('location')}
        />
      </label>

      {!form.surprise && (
        <div className="field">
          <span>{t('Tekrar', 'Repeat')}</span>
          <div className="chips" role="radiogroup" aria-label={t('Tekrar', 'Repeat')}>
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
              <span>{t('Ne zamana kadar? (boş bırakırsan hep tekrarlanır)', 'Until when? (leave empty to repeat forever)')}</span>
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

      <textarea className="input" rows={2} placeholder={t('Not ekle…', 'Add a note…')} value={form.note} onChange={set('note')} />

      <PhotoPicker photos={form.photos} onChange={(photos) => setForm((f) => ({ ...f, photos }))} />

      {partnerName && (
        <label className={`surprise-toggle propose-toggle ${form.propose ? 'is-on' : ''}`}>
          <input type="checkbox" checked={form.propose} onChange={set('propose')} />
          <span className="switch" />
          <span>
            <strong>{t(`Önce ${dative(partnerName)} sor`, `Ask ${partnerName} first`)}</strong>
            <small>
              {t('“Uygunum” derse kesinleşir; başka zaman da önerebilir.', 'It’s on once they say “I’m free”; they can also suggest another time.')}
              {form.surprise && t(' Sürpriz olduğu için sadece ipucu ve zaman gider.', ' Since it’s a surprise, only the hint and the time are sent.')}
            </small>
          </span>
        </label>
      )}

      <label className={`surprise-toggle ${form.surprise ? 'is-on' : ''}`}>
        <input type="checkbox" checked={form.surprise} onChange={toggleSurprise} />
        <span className="switch" />
        <span>
          <strong><Gift size={15} aria-hidden="true" /> {t('Sürpriz modu', 'Surprise mode')}</strong>
          <small>
            {group
              ? t('Seçtiklerin sadece ipucunu görür; diğerleri seninle hazırlar.', 'The people you pick only see the hint; the others plan it with you.')
              : t(
                  `${partnerName ?? 'Diğer kişi'} açılış gününe kadar sadece ipucunu görür`,
                  `${partnerName ?? 'The other person'} only sees the hint until the reveal day`,
                )}
          </small>
        </span>
      </label>

      {form.surprise && (
        <div className="surprise-fields">
          {group && (
            <div className="field">
              <span>{t('Kimden gizli?', 'Who is it a surprise for?')}</span>
              <div className="chips" role="group" aria-label={t('Kimden gizli', 'Who is it a surprise for')}>
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
                        ? t(
                            `Sen ve ${insiders.join(', ')} biliyorsunuz; hazırlık sohbeti aranızda kalır.`,
                            `You and ${insiders.join(', ')} are in on it; the planning chat stays between you.`,
                          )
                        : t('Sürprizi sadece sen biliyorsun.', 'Only you know about the surprise.')
                    })()
                  : t('Sürprizin kime olduğunu seç.', 'Choose who the surprise is for.')}
              </small>
            </div>
          )}
          <label className="field">
            <span>
              {group
                ? t('Sürpriz olanlara gidecek ipucu', 'The hint they’ll see')
                : t(`${partnerName ? dative(partnerName) : 'Eşine'} gidecek ipucu`, `The hint ${partnerName ?? 'they'} will see`)}
            </span>
            <input className="input" placeholder={DEFAULT_TEASER} value={form.teaser} onChange={set('teaser')} />
          </label>
          <label className="field">
            <span>{t('Ne zaman açılsın?', 'When should it be revealed?')}</span>
            <input className="input" type="date" value={form.revealOn || form.date} max={form.date} onChange={set('revealOn')} />
          </label>
          {form.photos.length > 0 && (
            <label className="check">
              <input type="checkbox" checked={form.blurPhotos} onChange={set('blurPhotos')} />
              {t('Biletleri ve fotoğrafları açılana kadar bulanık göster', 'Blur tickets and photos until it’s revealed')}
            </label>
          )}
        </div>
      )}

      {wasRepeating && (
        <small className="hint form-hint">
          {t('Bu plan tekrarlanıyor; değişiklik tüm tekrarlara uygulanır.', 'This plan repeats; changes apply to every time it happens.')}
        </small>
      )}

      {error && <p className="form-error">{error}</p>}

      {confirmingDelete ? (
        <div className="delete-choice">
          <strong>{t('Tekrarlanan planı sil', 'Delete a repeating plan')}</strong>
          <button type="button" className="btn btn-ghost bordered" onClick={() => onDelete('one')}>
            {t('Sadece bu günü sil', 'Delete only this day')}
          </button>
          <button type="button" className="btn btn-ghost bordered danger" onClick={() => onDelete('all')}>
            {t('Tüm tekrarları sil', 'Delete every time')}
          </button>
          <button type="button" className="link-btn" onClick={() => setConfirmingDelete(false)}>
            {t('Vazgeç', 'Cancel')}
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
              {t('Sil', 'Delete')}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('Vazgeç', 'Cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              t('Kaydediliyor…', 'Saving…')
            ) : form.propose ? (
              <>
                <Send size={16} aria-hidden="true" /> {t('Sor', 'Ask')}
              </>
            ) : (
              t('Kaydet', 'Save')
            )}
          </button>
        </div>
      )}
    </form>
  )
}
