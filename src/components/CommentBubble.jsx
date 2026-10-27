import { useRef, useState } from 'react'
import { CommentImage } from './CommentForm'
import CommentReactions from './CommentReactions'
import { COMMENT_FEELINGS } from '../lib/constants'
import { timeAgo } from '../lib/format'

const DOUBLE_TAP = 300
const LONG_PRESS = 450
const MENU_WIDTH = COMMENT_FEELINGS.length * 46 + 12

// One comment in a conversation. Pressing and holding it (or its picture) shows the emojis to pick
// from, right above it; a double tap laughs at it 😂.
export default function CommentBubble({ comment: c, author, showName, me, members, onReact, onRemove }) {
  const own = c.author === me
  const mine = c.reactions?.find((r) => r.user_id === me)?.emoji
  const [pop, setPop] = useState(null)
  const [menu, setMenu] = useState(null) // where the emoji menu sits on screen
  const bubble = useRef(null)
  const lastTap = useRef(0)
  const press = useRef(null)
  const held = useRef(false)

  function feel(emoji) {
    setPop(emoji)
    setTimeout(() => setPop(null), 800)
    if (mine !== emoji) onReact(c, emoji)
  }

  function choose(emoji) {
    setMenu(null)
    if (mine === emoji) onReact(c, null)
    else feel(emoji)
  }

  // Above the comment when there is room, otherwise below it; never off the screen's edges.
  function openMenu() {
    const r = bubble.current.getBoundingClientRect()
    const left = Math.min(Math.max(own ? r.right - MENU_WIDTH : r.left, 8), window.innerWidth - MENU_WIDTH - 8)
    setMenu({ left, top: r.top > 140 ? r.top - 62 : r.bottom + 8 })
    navigator.vibrate?.(10)
  }

  const ignored = (e) => e.target.closest('a, input, .feelings, .feeling-menu, .feeling-menu-backdrop, .lightbox, small')

  function down(e) {
    if (ignored(e)) return
    held.current = false
    const start = { x: e.clientX, y: e.clientY }
    press.current = { start, timer: setTimeout(() => {
      held.current = true
      press.current = null
      openMenu()
    }, LONG_PRESS) }
  }

  function move(e) {
    if (!press.current) return
    const { start } = press.current
    if (Math.abs(e.clientX - start.x) > 10 || Math.abs(e.clientY - start.y) > 10) cancel()
  }

  function cancel() {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }

  // A hold is not also a tap: the picture does not open, nothing is laughed at.
  function clickCapture(e) {
    if (!held.current) return
    held.current = false
    e.stopPropagation()
    e.preventDefault()
  }

  function tap(e) {
    if (ignored(e) || e.target.closest('button')) return
    const now = Date.now()
    if (now - lastTap.current < DOUBLE_TAP) {
      lastTap.current = 0
      feel('😂')
    } else {
      lastTap.current = now
    }
  }

  return (
    <div
      ref={bubble}
      className={`bubble ${menu ? 'is-pressed' : ''}`}
      onClick={tap}
      onClickCapture={clickCapture}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {pop && (
        <span className="bubble-pop" aria-hidden="true">
          {pop}
        </span>
      )}
      {showName && !own && <strong className="bubble-name">{author.name}</strong>}
      <CommentImage url={c.imageUrl} onDoubleTap={() => feel('😂')} />
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
      {menu && (
        <>
          <div className="feeling-menu-backdrop" onClick={() => setMenu(null)} />
          <div className="feeling-menu" role="group" aria-label="Tepki seç" style={menu}>
            {COMMENT_FEELINGS.map((emoji) => (
              <button type="button" key={emoji} className={mine === emoji ? 'is-mine' : ''} onClick={() => choose(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
