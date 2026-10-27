import { COMMENT_FEELINGS as FEELINGS, initials } from '../lib/constants'

// The emojis left on one comment. Leaving one is done by pressing and holding the comment
// (or a double tap for 😂); tapping one of these takes mine back or switches to it.
export default function CommentReactions({ comment, me, members, onReact }) {
  const reactions = comment.reactions ?? []
  const mine = reactions.find((r) => r.user_id === me)?.emoji
  const used = FEELINGS.map((emoji) => [emoji, reactions.filter((r) => r.emoji === emoji)]).filter(([, who]) => who.length)
  const nameOf = (r) => members[r.user_id]?.name ?? r.user_name ?? 'Biri'
  if (!used.length) return null

  return (
    <div className="feelings">
      {used.map(([emoji, who]) => (
        <button
          type="button"
          key={emoji}
          className={`feeling ${mine === emoji ? 'is-mine' : ''}`}
          title={who.map(nameOf).join(', ')}
          aria-label={`${emoji} ${who.map(nameOf).join(', ')}`}
          onClick={() => onReact(comment, mine === emoji ? null : emoji)}
        >
          {emoji}
          <small>{who.map((r) => members[r.user_id]?.short ?? initials(nameOf(r))).join(' ')}</small>
        </button>
      ))}
    </div>
  )
}
