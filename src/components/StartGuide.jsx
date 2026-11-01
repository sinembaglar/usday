import { Check } from 'lucide-react'

// While nobody has joined yet: a few things to do so the calendar is ready when they arrive.
export default function StartGuide({ steps }) {
  const done = steps.filter((s) => s.done).length
  return (
    <section className="card start-guide" aria-labelledby="start-guide-title">
      <div className="start-guide-head">
        <strong id="start-guide-title">Başlarken</strong>
        <span className="start-guide-count">
          {done}/{steps.length}
        </span>
      </div>
      <small>Davet ettiğin kişi katılınca takviminiz canlanır. Bu arada hazırlık yapabilirsin; eklediklerini katılınca görür.</small>
      <div className="start-progress" aria-hidden="true">
        <i style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="start-steps">
        {steps.map((s) => (
          <li key={s.id} className={s.done ? 'is-done' : ''}>
            <span className="start-check" aria-label={s.done ? 'Tamamlandı' : 'Yapılacak'}>
              {s.done && <Check size={13} strokeWidth={3} aria-hidden="true" />}
            </span>
            <span className="row-text">
              {s.title}
              <small>{s.hint}</small>
            </span>
            {!s.done && s.action && (
              <button className="btn btn-secondary btn-small" onClick={s.action}>
                {s.actionLabel}
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
