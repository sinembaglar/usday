import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addComment, deleteComment, hasPush, loadConversation, setReaction } from '../lib/api'
import { notifyReaction } from '../lib/push'
import { timeAgo } from '../lib/format'
import { UNKNOWN_PERSON } from '../lib/constants'

const EMOJIS = ['😍', '🥳', '👍', '😂', '🙈']

// Comments and reactions under a plan. Attached to the whole series for repeating plans.
export default function Conversation({ eventId, me, members, hasPartner, listeners = [], focus = false }) {
  // Opened from a comment notification: scroll down to the conversation once it has loaded.
  const sectionRef = useRef(null)
  const scrolled = useRef(false)
  const [comments, setComments] = useState([])
  const [reactions, setReactions] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [silent, setSilent] = useState([]) // people who would hear about a comment but have notifications off
  const listenerKey = listeners.join()

  useEffect(() => {
    let active = true
    Promise.all(listenerKey.split(',').filter(Boolean).map(async (id) => [id, (await hasPush(id)) ? null : id]))
      .then((list) => active && setSilent(list.map(([, id]) => id).filter(Boolean)))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [listenerKey])

  const load = useCallback(async () => {
    try {
      const data = await loadConversation(eventId)
      setComments(data.comments)
      setReactions(data.reactions)
    } catch {
      // stays as it was; the next change will try again
    }
  }, [eventId])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`conversation-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_comments', filter: `event_id=eq.${eventId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_reactions', filter: `event_id=eq.${eventId}` }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, load])

  useEffect(() => {
    if (!focus || scrolled.current || !comments.length) return
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    scrolled.current = true
  }, [focus, comments.length])

  const mine = reactions.find((r) => r.user_id === me)?.emoji

  async function react(emoji) {
    const next = mine === emoji ? null : emoji
    setReactions((list) => [...list.filter((r) => r.user_id !== me), ...(next ? [{ user_id: me, emoji: next }] : [])])
    try {
      await setReaction(eventId, me, next)
      if (next && hasPartner) notifyReaction(eventId, next)
    } catch {
      load()
    }
  }

  async function send(e) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    try {
      // The database sends the notification for a new comment.
      await addComment(eventId, body)
      setDraft('')
      await load()
    } finally {
      setSending(false)
    }
  }

  async function remove(comment) {
    if (!window.confirm('Bu yorum silinsin mi?')) return
    await deleteComment(comment.id)
    load()
  }

  return (
    <section className="conversation" ref={sectionRef}>
      <div className="reactions" role="group" aria-label="Tepki ver">
        {EMOJIS.map((emoji) => {
          const who = reactions.filter((r) => r.emoji === emoji)
          return (
            <button
              type="button"
              key={emoji}
              className={`reaction ${mine === emoji ? 'is-mine' : ''} ${who.length ? 'has-count' : ''}`}
              onClick={() => react(emoji)}
              title={who.map((r) => (members[r.user_id] ?? UNKNOWN_PERSON).name).join(', ')}
            >
              {emoji}
              {who.length > 0 && <small>{who.map((r) => (members[r.user_id] ?? UNKNOWN_PERSON).short).join(' ')}</small>}
            </button>
          )
        })}
      </div>

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

      <form className="comment-form" onSubmit={send}>
        <input
          className="input"
          placeholder={comments.length ? 'Yanıt yaz…' : 'Bir şey yaz… 💬'}
          maxLength={1000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn btn-primary" disabled={!draft.trim() || sending} aria-label="Gönder">
          ➤
        </button>
      </form>
      {silent.length > 0 && (
        <p className="hint silent-hint">
          🔕 {silent.map((id) => (members[id] ?? UNKNOWN_PERSON).name).join(', ')} bildirimleri açmamış; yazdıklarını
          uygulamayı açınca görecek.
        </p>
      )}
    </section>
  )
}
