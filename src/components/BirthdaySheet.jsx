import { useState } from 'react'
import { Cake } from 'lucide-react'
import BirthdayPicker from './BirthdayPicker'

// Asking for (or changing) my birthday. When it is required, there is no way out but saving.
export default function BirthdaySheet({ current = '', required = false, onSave, onClose }) {
  const [value, setValue] = useState(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const complete = /^\d{2}-\d{2}$/.test(value)

  async function submit(e) {
    e.preventDefault()
    if (!complete || saving) return
    setSaving(true)
    setError('')
    try {
      await onSave(value)
    } catch {
      setError('Kaydedilemedi, tekrar dener misin?')
      setSaving(false)
    }
  }

  return (
    <form className="settings birthday-sheet" onSubmit={submit}>
      <span className="notice-icon big">
        <Cake size={26} aria-hidden="true" />
      </span>
      <h3>{required ? 'Doğum günün ne zaman?' : 'Doğum günün'}</h3>
      <p className="hint">
        Sevdiklerin takvimlerinde görür ve bir ay önceden hatırlatılır; sana söylenmez, sürpriz kalır. Yılı sormuyoruz.
      </p>
      <BirthdayPicker value={value} onChange={setValue} />
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        {!required && (
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
        )}
        <button className="btn btn-primary" disabled={!complete || saving}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}
