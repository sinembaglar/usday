import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Plus, Search, SendHorizontal, X } from 'lucide-react'
import { gifSearchOn } from '../lib/api'
import GifPicker from './GifPicker'

// The box under a conversation: text, and a picture or GIF from the phone (shown before sending).
// onSend(text, file) resolves when it is saved; the form then empties itself.
export default function CommentForm({ placeholder, onSend, onError }) {
  const [draft, setDraft] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [sending, setSending] = useState(false)
  const [gifsOn, setGifsOn] = useState(null) // null while asking; only false hides GIF search
  const [findingGif, setFindingGif] = useState(false)
  const [attaching, setAttaching] = useState(false) // the "+" menu: a photo or a GIF
  const inputRef = useRef(null)

  useEffect(() => {
    let active = true
    gifSearchOn().then((on) => active && setGifsOn(on))
    return () => {
      active = false
    }
  }, [])

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
      {findingGif && (
        <GifPicker
          onPick={(gif) => {
            setFile(gif)
            setFindingGif(false)
          }}
          onClose={() => setFindingGif(false)}
          onError={onError}
        />
      )}
      {preview && (
        <div className="comment-preview">
          <img src={preview} alt="Gönderilecek görsel" />
          <button type="button" className="comment-preview-remove" onClick={() => setFile(null)} aria-label="Görseli kaldır">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      {attaching && (
        <div className="attach-menu">
          <button
            type="button"
            onClick={() => {
              setAttaching(false)
              inputRef.current?.click()
            }}
          >
            <ImagePlus size={18} aria-hidden="true" /> Fotoğraf
          </button>
          {gifsOn !== false && (
            <button
              type="button"
              className="gif-btn"
              onClick={() => {
                setAttaching(false)
                setFindingGif(true)
              }}
            >
              <Search size={18} aria-hidden="true" /> GIF ara
            </button>
          )}
        </div>
      )}
      <div className="comment-form">
        <button
          type="button"
          className={`btn btn-secondary attach-btn ${attaching || findingGif ? 'is-active' : ''}`}
          onClick={() => (gifsOn === false ? inputRef.current?.click() : setAttaching((a) => !a))}
          aria-label="Fotoğraf ya da GIF ekle"
          aria-expanded={gifsOn === false ? undefined : attaching}
          disabled={sending}
        >
          <Plus size={20} aria-hidden="true" />
        </button>
        <input
          className="input"
          placeholder={placeholder}
          maxLength={1000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn btn-primary send-btn" disabled={(!draft.trim() && !file) || sending} aria-label="Gönder">
          {sending ? '…' : <SendHorizontal size={18} aria-hidden="true" />}
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

// A picture in a comment bubble; tapping shows it large, a double tap laughs at it.
export function CommentImage({ url, onDoubleTap }) {
  const [open, setOpen] = useState(false)
  const waiting = useRef(null)
  if (!url) return null

  function tap() {
    if (waiting.current) {
      clearTimeout(waiting.current)
      waiting.current = null
      onDoubleTap?.()
      return
    }
    if (!onDoubleTap) return setOpen(true)
    waiting.current = setTimeout(() => {
      waiting.current = null
      setOpen(true)
    }, 300)
  }

  return (
    <>
      <button type="button" className="comment-image" onClick={tap}>
        <img src={url} alt="" loading="lazy" draggable={false} />
      </button>
      {open && (
        <div
          className="lightbox"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(false)
          }}
        >
          <img src={url} alt="" />
        </div>
      )}
    </>
  )
}
