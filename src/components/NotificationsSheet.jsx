import { useEffect, useState } from 'react'
import { isToday, isYesterday } from 'date-fns'
import { NOTIFICATION_PAGE, clearNotifications, loadNotifications, markNotificationsRead } from '../lib/api'
import { timeAgo } from '../lib/format'

function groupOf(iso) {
  const d = new Date(iso)
  if (isToday(d)) return 'Bugün'
  if (isYesterday(d)) return 'Dün'
  return 'Daha önce'
}

// The in-app inbox: everything that was (or would have been) sent to the phone.
export default function NotificationsSheet({ onOpenEvent, onOpenAdmin, onRead, onClose, onToast }) {
  const [items, setItems] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let active = true
    loadNotifications()
      .then(async (list) => {
        if (!active) return
        setItems(list)
        setHasMore(list.length === NOTIFICATION_PAGE)
        await markNotificationsRead()
        onRead()
      })
      .catch(() => active && setItems([]))
    return () => {
      active = false
    }
  }, [onRead])

  async function showMore() {
    setLoadingMore(true)
    try {
      const older = await loadNotifications(items.at(-1).created_at)
      setItems((list) => [...list, ...older])
      setHasMore(older.length === NOTIFICATION_PAGE)
    } catch {
      onToast('Yüklenemedi, tekrar dener misin?')
    }
    setLoadingMore(false)
  }

  async function clearAll() {
    if (!window.confirm('Tüm bildirimler silinsin mi?')) return
    try {
      await clearNotifications()
      setItems([])
    } catch {
      onToast('Silinemedi, tekrar dener misin?')
    }
  }

  const groups = []
  for (const item of items ?? []) {
    const name = groupOf(item.created_at)
    const group = groups.at(-1)?.name === name ? groups.at(-1) : groups[groups.push({ name, items: [] }) - 1]
    group.items.push(item)
  }

  return (
    <div className="inbox">
      <div className="inbox-head">
        <h3>Bildirimler</h3>
        {items?.length > 0 && (
          <button className="link-btn" onClick={clearAll}>
            Temizle
          </button>
        )}
      </div>

      {items === null && <p className="hint">Yükleniyor…</p>}
      {items?.length === 0 && (
        <div className="inbox-empty">
          <span>🔔</span>
          <p>Henüz bildirim yok. Yeni planlar, teklifler, yorumlar ve hatırlatmalar burada görünecek.</p>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.name} className="inbox-group">
          <small>{group.name}</small>
          {group.items.map((n) => {
            // Admin notifications open their part of the panel.
            const section = onOpenAdmin && n.url?.startsWith('/?admin=') ? n.url.slice(8) : null
            return (
              <button
                key={n.id}
                className={`inbox-item ${n.read_at ? '' : 'is-unread'}`}
                onClick={() => (section ? onOpenAdmin(section) : n.event_id && onOpenEvent(n.event_id))}
                disabled={!n.event_id && !section}
              >
                <span className="inbox-text">
                  <strong>{n.title}</strong>
                  {n.body && <span>{n.body}</span>}
                </span>
                <small>{timeAgo(n.created_at)}</small>
              </button>
            )
          })}
        </section>
      ))}

      {hasMore && (
        <button className="btn btn-ghost bordered" onClick={showMore} disabled={loadingMore}>
          {loadingMore ? 'Yükleniyor…' : 'Daha fazla göster'}
        </button>
      )}

      <div className="form-actions">
        <button className="btn btn-primary" onClick={onClose}>
          Kapat
        </button>
      </div>
    </div>
  )
}
