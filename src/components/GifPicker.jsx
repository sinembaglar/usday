import { useEffect, useState } from 'react'
import { gifAsFile, searchGifs } from '../lib/api'

const IDEAS = ['kahkaha', 'kıskandım', 'yaşasın', 'aşk', 'şaşırdım', 'ağlıyorum', 'dans', 'alkış']

// Find a GIF to send in a conversation: what is popular, or a search ("kıskandım").
// The chosen one comes back as a file, like a photo from the phone.
export default function GifPicker({ onPick, onClose, onError }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ q: null, gifs: [], more: false, page: 1 })
  const [loading, setLoading] = useState(true)
  const [taking, setTaking] = useState(null)

  // Search a moment after typing stops.
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      setLoading(true)
      searchGifs(query)
        .then((data) => active && setResults({ q: query, gifs: data.gifs ?? [], more: data.more, page: 1 }))
        .catch(() => active && setResults({ q: query, gifs: [], more: false, page: 1, failed: true }))
        .finally(() => active && setLoading(false))
    }, query ? 400 : 0)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query])

  async function more() {
    setLoading(true)
    try {
      const data = await searchGifs(results.q, results.page + 1)
      setResults((r) => ({ ...r, gifs: [...r.gifs, ...(data.gifs ?? [])], more: data.more, page: r.page + 1 }))
    } catch {
      onError?.('GIF’ler yüklenemedi, tekrar dener misin?')
    } finally {
      setLoading(false)
    }
  }

  async function take(gif) {
    if (taking) return
    setTaking(gif.id)
    try {
      onPick(await gifAsFile(gif))
    } catch {
      onError?.('Bu GIF alınamadı, başka birini dener misin?')
      setTaking(null)
    }
  }

  return (
    <div className="gif-picker" data-no-swipe>
      <div className="gif-picker-top">
        <input
          className="input"
          type="search"
          placeholder="GIF ara… (ör. kıskandım)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} // not the comment form's send
          enterKeyHint="search"
          autoFocus
        />
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="GIF aramayı kapat">
          ✕
        </button>
      </div>
      {!query && (
        <div className="gif-ideas">
          {IDEAS.map((idea) => (
            <button key={idea} type="button" className="chip" onClick={() => setQuery(idea)}>
              {idea}
            </button>
          ))}
        </div>
      )}
      <div className="gif-grid">
        {results.gifs.map((gif) => (
          <button
            key={gif.id}
            type="button"
            className={`gif-cell ${taking === gif.id ? 'is-taking' : ''}`}
            style={{ aspectRatio: `${gif.width} / ${gif.height}` }}
            onClick={() => take(gif)}
            aria-label={gif.title || 'GIF'}
          >
            <img src={gif.preview} alt="" loading="lazy" draggable={false} />
          </button>
        ))}
      </div>
      {!loading && !results.gifs.length && (
        <p className="hint">{results.failed ? 'GIF’ler şu an yüklenemedi.' : 'Bir şey bulunamadı, başka bir kelime dener misin?'}</p>
      )}
      {loading && <p className="hint">Yükleniyor…</p>}
      {!loading && results.more && (
        <button type="button" className="link-btn gif-more" onClick={more}>
          Daha fazla
        </button>
      )}
      <p className="gif-credit">GIF’ler KLIPY’den</p>
    </div>
  )
}
