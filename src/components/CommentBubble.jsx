import { useRef, useState } from 'react'
import { CommentImage } from './CommentForm'
import CommentReactions from './CommentReactions'
import { timeAgo } from '../lib/format'

const DOUBLE_TAP = 300

// One comment in a conversation. A double tap on someone else's comment (or its picture) laughs at it 😂.
export default function CommentBubble({ comment: c, author, showName, me, members, onReact, onRemove }) {
  const own = c.author === me
  const mine = c.reactions?.find((r) => r.user_id === me)?.emoji
  const [pop, setPop] = useState(null)
  const lastTap = useRef(0)

  function feel(emoji) {
    setPop(emoji)
    setTimeout(() => setPop(null), 800)
    if (mine !== emoji) onReact(c, emoji)
  }

  function tap(e) {
    if (own || e.target.closest('button, a, input, .lightbox')) return
    const now = Date.now()
    if (now - lastTap.current < DOUBLE_TAP) {
      lastTap.current = 0
      feel('😂')
    } else {
      lastTap.current = now
    }
  }

  return (
    <div className="bubble" onClick={tap}>
      {pop && (
        <span className="bubble-pop" aria-hidden="true">
          {pop}
        </span>
      )}
      {showName && !own && <strong className="bubble-name">{author.name}</strong>}
      <CommentImage
        url={c.imageUrl}
        onDoubleTap={own ? null : () => feel('😂')}
        mine={mine}
        onFeel={own ? null : feel}
      />
      {c.body && <p>{c.body}</p>}
      <CommentReactions comment={c} me={me} members={members} onReact={onReact} />
      <small>
        {timeAgo(c.created_at)}
        {own && (
          <button type="button" className="link-btn" onClick={() => onRemove(c)}>
            sil
          </button>
        )}
      </small>
    </div>
  )
}
