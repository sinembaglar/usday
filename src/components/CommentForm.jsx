import { useEffect, useRef, useState } from 'react'

// The box under a conversation: text, and a picture or GIF from the phone (shown before sending).
// onSend(text, file) resolves when it is saved; the form then empties itself.
export default function CommentForm({ placeholder, onSend, onError }) {
  const [draft, setDraft] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [sending, setSending] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function submit(e) {
    e.preventDefault()
    if ((!draft.trim() && !file) || sending) return
    setSending(true)
    try {
      await onSend(draft, file)
      setDraft('')
      setFile(null)
    } catch (err) {
      onError?.(err.message === 'too_big' ? 'GIF en fazla 8 MB olabilir' : 'Gönderilemedi, tekrar dener misin?')
    } finally {
      setSending(false)
    }
  }

  return (
    <form className="comment-form-wrap" onSubmit={submit}>
      {preview && (
        <div className="comment-preview">
          <img src={preview} alt="Gönderilecek görsel" />
          <button type="button" className="comment-preview-remove" onClick={() => setFile(null)} aria-label="Görseli kaldır">
            ✕
          </button>
        </div>
      )}
      <div className="comment-form">
        <button
          type="button"
          className="btn btn-ghost bordered attach-btn"
          onClick={() => inputRef.current?.click()}
          aria-label="Görsel ya da GIF ekle"
          disabled={sending}
        >
          🖼️
        </button>
        <input
          className="input"
          placeholder={placeholder}
          maxLength={1000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn btn-primary" disabled={(!draft.trim() && !file) || sending} aria-label="Gönder">
          {sending ? '…' : '➤'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
      </div>
    </form>
  )
}

// A picture in a comment bubble; tapping shows it large.
export function CommentImage({ url }) {
  const [open, setOpen] = useState(false)
  if (!url) return null
  return (
    <>
      <button type="button" className="comment-image" onClick={() => setOpen(true)}>
        <img src={url} alt="" loading="lazy" />
      </button>
      {open && (
        <div className="lightbox" onClick={() => setOpen(false)}>
          <img src={url} alt="" />
        </div>
      )}
    </>
  )
}
