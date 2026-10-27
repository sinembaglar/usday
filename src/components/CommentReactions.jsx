import { useState } from 'react'
import { COMMENT_FEELINGS as FEELINGS, initials } from '../lib/constants'

// The emojis under one comment, and a little button to add mine (on my own comment too).
export default function CommentReactions({ comment, me, members, onReact }) {
  const [picking, setPicking] = useState(false)
  const reactions = comment.reactions ?? []
  const mine = reactions.find((r) => r.user_id === me)?.emoji
  const used = FEELINGS.map((emoji) => [emoji, reactions.filter((r) => r.emoji === emoji)]).filter(([, who]) => who.length)
  const nameOf = (r) => members[r.user_id]?.name ?? r.user_name ?? 'Biri'

  function pick(emoji) {
    setPicking(false)
    onReact(comment, mine === emoji ? null : emoji)
  }

  return (
    <div className="feelings">
      {used.map(([emoji, who]) => (
        <button
          type="button"
          key={emoji}
          className={`feeling ${mine === emoji ? 'is-mine' : ''}`}
          title={who.map(nameOf).join(', ')}
          aria-label={`${emoji} ${who.map(nameOf).join(', ')}`}
          onClick={() => pick(emoji)}
        >
          {emoji}
          <small>{who.map((r) => members[r.user_id]?.short ?? initials(nameOf(r))).join(' ')}</small>
        </button>
      ))}
      <button
        type="button"
        className={`feeling feeling-add ${picking ? 'is-open' : ''}`}
        aria-label="Tepki ekle"
        aria-expanded={picking}
        onClick={() => setPicking((p) => !p)}
      >
        {picking ? '✕' : '☺︎+'}
      </button>
      {picking && (
        <div className="feeling-picker" role="group" aria-label="Tepki seç">
          {FEELINGS.map((emoji) => (
            <button type="button" key={emoji} className={mine === emoji ? 'is-mine' : ''} onClick={() => pick(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
