import { CalendarDays, Gift, Plus } from 'lucide-react'

const TABS = [
  { id: 'takvim', label: 'Takvim', Icon: CalendarDays },
  { id: 'dilekler', label: 'Dilekler', Icon: Gift },
]

// The two sections, with "add" in the middle (a plan on Takvim, a wish on Dilekler), so it never
// sits on top of a card.
export default function TabBar({ tab, onChange, onAdd, addLabel }) {
  const [calendar, wishes] = TABS
  const item = ({ id, label, Icon }) => (
    <button
      key={id}
      className={tab === id ? 'is-active' : ''}
      aria-current={tab === id ? 'page' : undefined}
      onClick={() => onChange(id)}
    >
      <Icon size={22} strokeWidth={tab === id ? 2.2 : 1.8} aria-hidden="true" />
      {label}
    </button>
  )

  return (
    <nav className="tabbar" aria-label="Bölümler">
      {item(calendar)}
      <button className="tabbar-add" onClick={onAdd} aria-label={addLabel}>
        <Plus size={26} strokeWidth={2.4} aria-hidden="true" />
      </button>
      {item(wishes)}
    </nav>
  )
}
