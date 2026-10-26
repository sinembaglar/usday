import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { adminFeedback, adminOverview, adminReports, adminUsers, setBanned, setStatus } from '../lib/api'
import { RELATIONS } from '../lib/constants'
import { timeAgo } from '../lib/format'
import { REPORT_REASONS } from './ReportSheet'

const SECTIONS = [
  { id: 'overview', label: '📊 Rapor' },
  { id: 'feedback', label: '💬 Geri bildirim' },
  { id: 'reports', label: '🚩 Şikayetler' },
  { id: 'users', label: '👤 Kişiler' },
]

const FEEDBACK_KINDS = {
  idea: '💡 Öneri',
  bug: '🐞 Hata',
  love: '💜 Beğendim',
  other: '💬 Diğer',
}
const REPORT_STATUS = {
  new: '🆕 Yeni',
  reviewing: '👀 İnceleniyor',
  closed: '✓ Kapandı',
}

// "5 dk önce", "şimdi", "12 Eki"
const ago = (iso) => {
  const t = timeAgo(iso)
  return /dk|sa/.test(t) ? `${t} önce` : t
}

const day = (iso) => format(new Date(iso), 'd MMM yyyy, HH:mm', { locale: tr })

function Stat({ value, label, sub }) {
  return (
    <div className="stat">
      <strong>{value ?? '–'}</strong>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </div>
  )
}

// Last 14 days as small bars.
function Bars({ title, days }) {
  const max = Math.max(1, ...days.map((d) => d.n))
  const total = days.reduce((sum, d) => sum + d.n, 0)
  return (
    <div className="bars-card">
      <div className="bars-head">
        <span>{title}</span>
        <small>son 14 gün · {total}</small>
      </div>
      <div className="bars">
        {days.map((d) => (
          <span key={d.day} title={`${format(parseISO(d.day), 'd MMM', { locale: tr })}: ${d.n}`}>
            <i style={{ height: `${(d.n / max) * 100}%` }} />
          </span>
        ))}
      </div>
      <div className="bars-foot">
        <small>{format(parseISO(days[0].day), 'd MMM', { locale: tr })}</small>
        <small>bugün</small>
      </div>
    </div>
  )
}

function Overview({ data }) {
  const connections = Object.entries(data.connections ?? {})
  const lastRun = data.reminders_last_run && new Date(data.reminders_last_run)
  // The reminder job runs every 10 minutes; half an hour of silence means something is wrong.
  const healthy =
    lastRun && Date.now() - lastRun < 30 * 60_000 && !data.reminders_failed_24h && !data.background_errors_24h

  return (
    <>
      <div className={`status-box ${healthy ? '' : 'is-declined'}`}>
        <strong>{healthy ? '🟢 Sistem sorunsuz çalışıyor' : '🟠 Arka plan işlerinde sorun var'}</strong>
        <small>
          Hatırlatmalar en son {lastRun ? ago(lastRun.toISOString()) : '—'} çalıştı · son 24 saatte{' '}
          {data.reminders_failed_24h + data.background_errors_24h} hata
        </small>
      </div>

      <h4 className="admin-title">Kullanıcılar</h4>
      <div className="stats">
        <Stat value={data.users} label="toplam" sub={`+${data.users_7d} bu hafta`} />
        <Stat value={data.active_1d} label="bugün aktif" sub={`${data.active_7d} bu hafta`} />
        <Stat value={data.devices} label="bildirim açık cihaz" />
        <Stat value={data.banned} label="engelli" />
      </div>
      <Bars title="Yeni kullanıcılar" days={data.signups_by_day} />

      <h4 className="admin-title">Bağlantılar</h4>
      <div className="stats">
        {connections.map(([relation, n]) => (
          <Stat
            key={relation}
            value={n}
            label={`${RELATIONS[relation]?.emoji ?? ''} ${RELATIONS[relation]?.label ?? relation}`}
          />
        ))}
        <Stat value={data.open_invites} label="bekleyen davet" />
      </div>

      <h4 className="admin-title">Kullanım</h4>
      <div className="stats">
        <Stat value={data.plans} label="plan" sub={`+${data.plans_7d} bu hafta`} />
        <Stat value={data.group_plans} label="grup planı" />
        <Stat value={data.surprises} label="sürpriz" />
        <Stat value={data.proposals} label="yanıt bekleyen teklif" />
        <Stat value={data.wishes} label="dilek" />
        <Stat value={data.comments_7d} label="yorum" sub="bu hafta" />
        <Stat value={data.notifications_7d} label="bildirim" sub="bu hafta" />
      </div>
      <Bars title="Eklenen planlar" days={data.plans_by_day} />
      <p className="hint">Sadece sayılar gösterilir; kimsenin planı, sürprizi ya da mesajı burada görünmez.</p>
    </>
  )
}

function FeedbackList({ items, onChanged, onToast }) {
  if (!items.length) return <p className="hint admin-empty">Henüz geri bildirim yok.</p>
  async function toggle(f) {
    try {
      await setStatus('feedback', f.id, f.status === 'new' ? 'done' : 'new')
      onChanged()
    } catch {
      onToast('Kaydedilemedi')
    }
  }
  return items.map((f) => (
    <article key={f.id} className={`admin-item ${f.status === 'new' ? 'is-new' : ''}`}>
      <header>
        <strong>{FEEDBACK_KINDS[f.kind]}</strong>
        <small>{day(f.created_at)}</small>
      </header>
      <p>{f.message}</p>
      <small className="admin-meta">
        {f.author_name ?? 'Silinmiş hesap'}
        {f.author_email && ` · ${f.author_email}`}
        {f.device && ` · ${f.device.split(' · ').slice(0, 2).join(', ')}`}
      </small>
      <div className="admin-actions">
        {f.author_email && (
          <a
            className="btn btn-ghost bordered"
            href={`mailto:${f.author_email}?subject=${encodeURIComponent('UsDay geri bildirimin hakkında')}`}
          >
            ✉️ Yanıtla
          </a>
        )}
        <button className="btn btn-ghost bordered" onClick={() => toggle(f)}>
          {f.status === 'new' ? '✓ Tamamlandı' : '↩︎ Yeni yap'}
        </button>
      </div>
    </article>
  ))
}

async function ban(person, onChanged, onToast) {
  const reason = window.prompt(
    `${person.name} engellensin mi?\n\nTüm cihazlarından çıkış yaptırılır (en geç 1 saat içinde), tekrar giriş yapamaz ve bildirim alamaz. Verileri silinmez; engeli sonra kaldırabilirsin.\n\nKısa bir sebep yaz:`,
  )
  if (reason === null) return
  try {
    await setBanned(person.id, true, reason.trim() || null)
    onToast(`🚫 ${person.name} engellendi`)
    onChanged()
  } catch {
    onToast('Engellenemedi, tekrar dener misin?')
  }
}

async function unban(person, onChanged, onToast) {
  if (!window.confirm(`${person.name} kişisinin engeli kaldırılsın mı?`)) return
  try {
    await setBanned(person.id, false)
    onToast('Engel kaldırıldı')
    onChanged()
  } catch {
    onToast('Kaldırılamadı, tekrar dener misin?')
  }
}

function ReportList({ items, onChanged, onToast }) {
  if (!items.length) return <p className="hint admin-empty">Şikayet yok 🌿</p>
  async function move(r, status) {
    try {
      await setStatus('reports', r.id, status)
      onChanged()
    } catch {
      onToast('Kaydedilemedi')
    }
  }
  return items.map((r) => {
    const person = {
      id: r.reported,
      name: r.reported_name ?? 'Silinmiş hesap',
    }
    return (
      <article key={r.id} className={`admin-item ${r.status !== 'closed' ? 'is-new' : ''}`}>
        <header>
          <strong>{REPORT_REASONS[r.reason]}</strong>
          <small>{REPORT_STATUS[r.status]}</small>
        </header>
        <p>
          <b>Şikayet edilen:</b> {person.name}
          {r.reported_email && ` · ${r.reported_email}`}
          {r.reported_banned && ' · 🚫 engelli'}
        </p>
        {r.message && <p>“{r.message}”</p>}
        <small className="admin-meta">
          Bildiren: {r.reporter_name ?? 'Silinmiş hesap'}
          {r.reporter_email && ` · ${r.reporter_email}`} · {day(r.created_at)}
        </small>
        <div className="admin-actions">
          {r.status === 'new' && (
            <button className="btn btn-ghost bordered" onClick={() => move(r, 'reviewing')}>
              👀 İnceliyorum
            </button>
          )}
          {r.status !== 'closed' && (
            <button className="btn btn-ghost bordered" onClick={() => move(r, 'closed')}>
              ✓ Kapat
            </button>
          )}
          {r.reported &&
            (r.reported_banned ? (
              <button className="btn btn-ghost bordered" onClick={() => unban(person, onChanged, onToast)}>
                Engeli kaldır
              </button>
            ) : (
              <button className="btn btn-ghost bordered danger" onClick={() => ban(person, onChanged, onToast)}>
                🚫 Engelle
              </button>
            ))}
        </div>
      </article>
    )
  })
}

function UserList({ onToast }) {
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState(null)

  const load = useCallback(
    (q) =>
      adminUsers(q)
        .then(setUsers)
        .catch(() => onToast('Kişiler yüklenemedi')),
    [onToast],
  )

  useEffect(() => {
    const id = setTimeout(() => load(search.trim()), 250)
    return () => clearTimeout(id)
  }, [search, load])

  const reload = () => load(search.trim())

  return (
    <>
      <input
        className="input"
        type="search"
        placeholder="İsim ya da e-posta ara…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {users === null && <p className="hint">Yükleniyor…</p>}
      {users?.length === 0 && <p className="hint admin-empty">Kimse bulunamadı.</p>}
      {users?.map((u) => (
        <article key={u.id} className="admin-item">
          <header>
            <strong>
              {u.name}
              {u.is_admin && ' · 🛠 yönetici'}
              {u.banned && ' · 🚫 engelli'}
            </strong>
            <small>{u.last_seen_at ? ago(u.last_seen_at) : 'hiç girmedi'}</small>
          </header>
          <small className="admin-meta">
            {u.email} · {format(new Date(u.created_at), 'd MMM yyyy', { locale: tr })} katıldı · {u.connections}{' '}
            bağlantı · {u.plans} plan
            {u.reports > 0 && ` · 🚩 ${u.reports} şikayet`}
          </small>
          {!u.is_admin && (
            <div className="admin-actions">
              {u.banned ? (
                <button className="btn btn-ghost bordered" onClick={() => unban(u, reload, onToast)}>
                  Engeli kaldır
                </button>
              ) : (
                <button className="btn btn-ghost bordered danger" onClick={() => ban(u, reload, onToast)}>
                  🚫 Engelle
                </button>
              )}
            </div>
          )}
        </article>
      ))}
    </>
  )
}

export default function AdminPanel({ initialSection = 'overview', onClose, onToast }) {
  const [section, setSection] = useState(initialSection)
  const [overview, setOverview] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [reports, setReports] = useState(null)

  const load = useCallback(() => {
    adminOverview()
      .then(setOverview)
      .catch(() => onToast('Rapor yüklenemedi'))
    adminFeedback()
      .then(setFeedback)
      .catch(() => setFeedback([]))
    adminReports()
      .then(setReports)
      .catch(() => setReports([]))
  }, [onToast])

  useEffect(load, [load])

  const badge = {
    feedback: overview?.feedback_new,
    reports: overview?.reports_open,
  }

  return (
    <div className="settings admin">
      <h3>🛠 Yönetim paneli</h3>
      <div className="admin-tabs" role="tablist">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={section === s.id}
            className={`chip ${section === s.id ? 'is-active' : ''}`}
            style={{ '--tag': 'var(--rose)' }}
            onClick={() => setSection(s.id)}
          >
            {s.label}
            {badge[s.id] > 0 && <span className="admin-badge">{badge[s.id]}</span>}
          </button>
        ))}
      </div>

      {section === 'overview' && (overview ? <Overview data={overview} /> : <p className="hint">Yükleniyor…</p>)}
      {section === 'feedback' &&
        (feedback ? (
          <FeedbackList items={feedback} onChanged={load} onToast={onToast} />
        ) : (
          <p className="hint">Yükleniyor…</p>
        ))}
      {section === 'reports' &&
        (reports ? (
          <ReportList items={reports} onChanged={load} onToast={onToast} />
        ) : (
          <p className="hint">Yükleniyor…</p>
        ))}
      {section === 'users' && <UserList onToast={onToast} />}

      <div className="form-actions">
        <button className="btn btn-primary" onClick={onClose}>
          Kapat
        </button>
      </div>
    </div>
  )
}
