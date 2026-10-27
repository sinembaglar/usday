import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addShareComment, deleteShareComment, loadShareComments } from '../lib/api'
import { dative, timeAgo } from '../lib/format'
import { UNKNOWN_PERSON } from '../lib/constants'

// Quick words for someone else's plan: a joke, a wish to come along, or a little "bensiz mi?".
const QUICK = ['Bensiz mi? 😤', 'Ben de gelebilir miyim? 🙋', 'İyi eğlenceler 🥳', 'Kıskandım 😏', 'Ne yapıyorsun bakalım? 👀']

// One side conversation about a plan on a shared calendar: the calendar's owner and one viewer.
// The plan's other people never see it.
export function ShareThread({ eventId, owner, viewer, me, members, title, focus = false }) {
  const [comments, setComments] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const ref = useRef(null)
  const scrolled = useRef(false)

  const load = useCallback(async () => {
    try {
      const all = await loadShareComments(eventId)
      setComments(all.filter((c) => c.owner === owner && c.viewer === viewer))
    } catch {
      // stays as it was
    }
  }, [eventId, owner, viewer])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`share-chat-${eventId}-${viewer}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'share_comments', filter: `event_id=eq.${eventId}` }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, viewer, load])

  useEffect(() => {
    if (!focus || scrolled.current || !comments.length) return
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    scrolled.current = true
  }, [focus, comments.length])

  async function send(text) {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      await addShareComment({ eventId, owner, viewer, author: me, body })
      setDraft('')
      await load()
    } finally {
      setSending(false)
    }
  }

  async function remove(c) {
    if (!window.confirm('Bu yorum silinsin mi?')) return
    await deleteShareComment(c.id)
    load()
  }

  const iAmViewer = me === viewer
  const other = (members[iAmViewer ? owner : viewer] ?? UNKNOWN_PERSON).name

  return (
    <section className="share-thread" ref={ref}>
      {title && <h4>{title}</h4>}
      {iAmViewer && (
        <p className="hint">Burada yazdıklarını sadece {other} görür; plandaki diğer kişiler görmez.</p>
      )}
      {comments.length > 0 && (
        <ul className="comments">
          {comments.map((c) => {
            const author = members[c.author] ?? UNKNOWN_PERSON
            const own = c.author === me
            return (
              <li key={c.id} className={own ? 'is-own' : ''}>
                <span className="avatar small" style={{ background: author.color }}>
                  {author.short}
                </span>
                <div className="bubble">
                  <p>{c.body}</p>
                  <small>
                    {timeAgo(c.created_at)}
                    {own && (
                      <button type="button" className="link-btn" onClick={() => remove(c)}>
                        sil
                      </button>
                    )}
                  </small>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {iAmViewer && (
        <div className="quick-words">
          {QUICK.map((q) => (
            <button key={q} type="button" className="chip" disabled={sending} onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      <form
        className="comment-form"
        onSubmit={(e) => {
          e.preventDefault()
          send(draft)
        }}
      >
        <input
          className="input"
          placeholder={iAmViewer ? `${dative(other)} yaz… 💬` : 'Cevap yaz…'}
          maxLength={1000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn btn-primary" disabled={!draft.trim() || sending} aria-label="Gönder">
          ➤
        </button>
      </form>
    </section>
  )
}

// On my own plan: what the people I share my calendar with said about it, one thread each.
export function ThreadsOnMyPlan({ eventId, me, members, focusViewer }) {
  const [viewers, setViewers] = useState([])

  useEffect(() => {
    let active = true
    const load = () =>
      loadShareComments(eventId)
        .then((all) => active && setViewers([...new Set(all.filter((c) => c.owner === me).map((c) => c.viewer))]))
        .catch(() => {})
    load()
    const channel = supabase
      .channel(`share-threads-${eventId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'share_comments', filter: `event_id=eq.${eventId}` }, load)
      .subscribe()
    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [eventId, me])

  return viewers.map((v) => (
    <ShareThread
      key={v}
      eventId={eventId}
      owner={me}
      viewer={v}
      me={me}
      members={members}
      focus={v === focusViewer}
      title={`💬 ${(members[v] ?? UNKNOWN_PERSON).name} ile bu plan hakkında`}
    />
  ))
}
