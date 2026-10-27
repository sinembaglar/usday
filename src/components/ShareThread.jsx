import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addShareComment, deleteShareComment, loadShareComments, uploadCommentImage } from '../lib/api'
import CommentForm, { CommentImage } from './CommentForm'
import { timeAgo } from '../lib/format'
import { UNKNOWN_PERSON, initials } from '../lib/constants'

// Quick words for someone else's plan: a joke, a wish to come along, or a little "bensiz mi?".
const QUICK = ['Bensiz mi? 😤', 'Ben de gelebilir miyim? 🙋', 'İyi eğlenceler 🥳', 'Kıskandım 😏', 'Ne yapıyorsun bakalım? 👀']

// Which comments a thread shows:
//   "viewer"  I look at someone's shared calendar: everything I may read about this plan
//             (the shared conversation, or only mine with the owner when I see busy/free time)
//   "open"    my own plan: the shared conversation of everyone who sees my plan names
//   "private" my own plan: one person who sees only busy/free time, and me
const shows = {
  viewer: (c, owner) => c.owner === owner,
  open: (c, owner) => c.owner === owner && c.open,
  private: (c, owner, viewer) => c.owner === owner && !c.open && c.viewer === viewer,
}

// A conversation about a plan on a shared calendar. The plan's other people never see it.
export function ShareThread({ eventId, owner, viewer, mode, me, members, title, hint, placeholder, focus = false, onToast }) {
  const [comments, setComments] = useState([])
  const [sending, setSending] = useState(false)
  const ref = useRef(null)
  const scrolled = useRef(false)

  const load = useCallback(async () => {
    try {
      const all = await loadShareComments(eventId)
      setComments(all.filter((c) => shows[mode](c, owner, viewer)))
    } catch {
      // stays as it was
    }
  }, [eventId, owner, viewer, mode])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`share-chat-${eventId}-${mode}-${viewer}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'share_comments', filter: `event_id=eq.${eventId}` }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, viewer, mode, load])

  useEffect(() => {
    if (!focus || scrolled.current || !comments.length) return
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    scrolled.current = true
  }, [focus, comments.length])

  // The viewer column says which conversation: the viewer's own, or the owner's (the shared one).
  async function send(text, file = null) {
    const imagePath = file ? await uploadCommentImage(`s-${owner}-${viewer}`, file) : null
    await addShareComment({ eventId, owner, viewer, author: me, body: text, imagePath })
    await load()
  }

  async function quick(text) {
    if (sending) return
    setSending(true)
    try {
      await send(text)
    } catch {
      onToast?.('Gönderilemedi, tekrar dener misin?')
    } finally {
      setSending(false)
    }
  }

  async function remove(c) {
    if (!window.confirm('Bu yorum silinsin mi?')) return
    await deleteShareComment(c)
    load()
  }

  // Someone else who sees the same calendar may not be connected to me: their name comes with the comment.
  const person = (c) =>
    members[c.author] ??
    (c.author_name ? { ...UNKNOWN_PERSON, name: c.author_name, short: initials(c.author_name) } : UNKNOWN_PERSON)

  return (
    <section className="share-thread" ref={ref}>
      {title && <h4>{title}</h4>}
      {hint && <p className="hint">{hint}</p>}
      {comments.length > 0 && (
        <ul className="comments">
          {comments.map((c) => {
            const author = person(c)
            const own = c.author === me
            return (
              <li key={c.id} className={own ? 'is-own' : ''}>
                <span className="avatar small" style={{ background: author.color }} title={author.name}>
                  {author.short}
                </span>
                <div className="bubble">
                  {!own && mode !== 'private' && <strong className="bubble-name">{author.name}</strong>}
                  <CommentImage url={c.imageUrl} />
                  {c.body && <p>{c.body}</p>}
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
      {mode === 'viewer' && (
        <div className="quick-words">
          {QUICK.map((q) => (
            <button key={q} type="button" className="chip" disabled={sending} onClick={() => quick(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      <CommentForm placeholder={placeholder ?? 'Cevap yaz…'} onSend={send} onError={onToast} />
    </section>
  )
}

// On my own plan: the shared conversation with everyone who sees my plan names, and a private one
// with each person who sees only my busy/free time and wrote to me.
export function ThreadsOnMyPlan({ eventId, me, members, focusViewer, onToast }) {
  const [threads, setThreads] = useState({ open: false, private: [] })

  useEffect(() => {
    let active = true
    const load = () =>
      loadShareComments(eventId)
        .then((all) => {
          if (!active) return
          const mine = all.filter((c) => c.owner === me)
          setThreads({
            open: mine.some((c) => c.open),
            private: [...new Set(mine.filter((c) => !c.open).map((c) => c.viewer))],
          })
        })
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

  return (
    <>
      {threads.open && (
        <ShareThread
          eventId={eventId}
          owner={me}
          viewer={me}
          mode="open"
          me={me}
          members={members}
          focus={focusViewer === 'open' || (focusViewer && !threads.private.includes(focusViewer))}
          onToast={onToast}
          title="💬 Takvimini görenler bu plan hakkında"
          hint="Takvimini plan adlarıyla gören herkes bu sohbeti görür ve yazabilir; plandaki diğer kişiler görmez."
        />
      )}
      {threads.private.map((v) => (
        <ShareThread
          key={v}
          eventId={eventId}
          owner={me}
          viewer={v}
          mode="private"
          me={me}
          members={members}
          focus={v === focusViewer}
          onToast={onToast}
          title={`💬 ${(members[v] ?? UNKNOWN_PERSON).name} ile bu plan hakkında`}
          hint="Sadece dolu/boş saatlerini görüyor; bu sohbeti sadece ikiniz görürsünüz."
        />
      ))}
    </>
  )
}
