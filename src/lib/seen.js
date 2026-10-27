import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { loadConversationSeen as loadSeen, markConversationSeen as markSeen } from './api'

// Who has seen a conversation, kept live; and I have seen it whenever a new comment is on screen.
export function useSeen({ eventId, me, owner = null, viewer = null, comments }) {
  const [seen, setSeen] = useState([])
  const marked = useRef(null)
  const latest = comments.at(-1)?.id

  useEffect(() => {
    let active = true
    const load = () =>
      loadSeen(eventId, owner, viewer)
        .then((list) => active && setSeen(list))
        .catch(() => {})
    load()
    const channel = supabase
      .channel(`seen-${eventId}-${owner}-${viewer}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_seen', filter: `event_id=eq.${eventId}` }, load)
      .subscribe()
    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [eventId, owner, viewer])

  useEffect(() => {
    if (!latest || marked.current === latest) return
    marked.current = latest
    markSeen(eventId, me, owner, viewer).catch(() => {})
  }, [latest, eventId, me, owner, viewer])

  return seen
}

// "Görüldü · Yaren, Deniz" under my comment when it is the last one: who looked after I wrote it.
// (Once someone answers, the answer says enough.)
export function seenLine(comments, seen, me, members) {
  const mine = comments.at(-1)
  if (mine?.author !== me) return null
  const by = seen
    .filter((s) => s.user_id !== me && new Date(s.seen_at) >= new Date(mine.created_at))
    .map((s) => members[s.user_id]?.name ?? s.user_name ?? 'Biri')
  return by.length ? { text: `✓ Görüldü · ${by.join(', ')}` } : null
}
