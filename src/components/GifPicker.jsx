import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { gifAsFile, searchGifs } from '../lib/api'
import { t } from '../lib/i18n'

const IDEAS = t(
  ['kahkaha', 'kıskandım', 'yaşasın', 'aşk', 'şaşırdım', 'ağlıyorum', 'dans', 'alkış'],
  ['lol', 'jealous', 'yay', 'love', 'shocked', 'crying', 'dance', 'applause'],
)

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
      onError?.(t('GIF’ler yüklenemedi, tekrar dener misin?', 'Couldn’t load GIFs. Try again?'))
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
      onError?.(t('Bu GIF alınamadı, başka birini dener misin?', 'Couldn’t get this GIF. Try another one?'))
      setTaking(null)
    }
  }

  return (
    <div className="gif-picker" data-no-swipe>
      <div className="gif-picker-top">
        <input
          className="input"
          type="search"
          placeholder={t('GIF ara… (ör. kıskandım)', 'Search GIFs… (e.g. jealous)')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} // not the comment form's send
          enterKeyHint="search"
          autoFocus
        />
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label={t('GIF aramayı kapat', 'Close GIF search')}>
          <X size={18} aria-hidden="true" />
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
        <p className="hint">
          {results.failed
            ? t('GIF’ler şu an yüklenemedi.', 'GIFs couldn’t load right now.')
            : t('Bir şey bulunamadı, başka bir kelime dener misin?', 'Nothing found. Try another word?')}
        </p>
      )}
      {loading && <p className="hint">{t('Yükleniyor…', 'Loading…')}</p>}
      {!loading && results.more && (
        <button type="button" className="link-btn gif-more" onClick={more}>
          {t('Daha fazla', 'More')}
        </button>
      )}
      <p className="gif-credit">{t('GIF’ler KLIPY’den', 'GIFs by KLIPY')}</p>
    </div>
  )
}
