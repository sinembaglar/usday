const TABS = [
  { id: 'takvim', label: 'Takvim', icon: '📅' },
  { id: 'dilekler', label: 'Dilekler', icon: '🎁' },
]

export default function TabBar({ tab, onChange }) {
  return (
    <nav className="tabbar" aria-label="Bölümler">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={tab === t.id ? 'is-active' : ''}
          aria-current={tab === t.id ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          <span>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
