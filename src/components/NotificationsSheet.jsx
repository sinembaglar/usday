import { useEffect, useState } from 'react'
import { isToday, isYesterday } from 'date-fns'
import { Bell } from 'lucide-react'
import { NOTIFICATION_PAGE, clearNotifications, loadNotifications, markNotificationsRead } from '../lib/api'
import { timeAgo } from '../lib/format'
import { t } from '../lib/i18n'

function groupOf(iso) {
  const d = new Date(iso)
  if (isToday(d)) return t('Bugün', 'Today')
  if (isYesterday(d)) return t('Dün', 'Yesterday')
  return t('Daha önce', 'Earlier')
}

// The in-app inbox: everything that was (or would have been) sent to the phone.
// Where a notification leads; older ones without a link still open their plan.
const linkOf = (n) => (n.url && n.url !== '/' ? n.url : n.event_id ? `/?event=${n.event_id}` : null)

export default function NotificationsSheet({ onOpenLink, onRead, onClose, onToast }) {
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
      onToast(t('Yüklenemedi, tekrar dener misin?', 'Couldn’t load. Try again?'))
    }
    setLoadingMore(false)
  }

  async function clearAll() {
    if (!window.confirm(t('Tüm bildirimler silinsin mi?', 'Delete all notifications?'))) return
    try {
      await clearNotifications()
      setItems([])
    } catch {
      onToast(t('Silinemedi, tekrar dener misin?', 'Couldn’t delete. Try again?'))
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
        <h3>{t('Bildirimler', 'Notifications')}</h3>
        {items?.length > 0 && (
          <button className="link-btn" onClick={clearAll}>
            {t('Temizle', 'Clear')}
          </button>
        )}
      </div>

      {items === null && <p className="hint">{t('Yükleniyor…', 'Loading…')}</p>}
      {items?.length === 0 && (
        <div className="inbox-empty">
          <Bell size={36} strokeWidth={1.5} aria-hidden="true" />
          <p>
            {t(
              'Henüz bildirim yok. Yeni planlar, yorumlar ve hatırlatmalar burada görünür.',
              'No notifications yet. New plans, comments and reminders show up here.',
            )}
          </p>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.name} className="inbox-group">
          <small>{group.name}</small>
          {group.items.map((n) => {
            const link = linkOf(n)
            return (
              <button
                key={n.id}
                className={`inbox-item ${n.read_at ? '' : 'is-unread'}`}
                onClick={() => link && onOpenLink(link)}
                disabled={!link}
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
          {loadingMore ? t('Yükleniyor…', 'Loading…') : t('Daha fazla göster', 'Show more')}
        </button>
      )}

      <div className="form-actions">
        <button className="btn btn-primary" onClick={onClose}>
          {t('Kapat', 'Close')}
        </button>
      </div>
    </div>
  )
}
