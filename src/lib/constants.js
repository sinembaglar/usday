export const TAGS = {
  date: { label: 'Date', emoji: '💕', color: '#D99AB8' },
  plan: { label: 'Plan', emoji: '📝', color: '#D4A373' },
  is: { label: 'İş', emoji: '💼', color: '#8FA98F' },
  tatil: { label: 'Tatil', emoji: '✈️', color: '#8AA9C9' },
  ozel: { label: 'Özel gün', emoji: '🎉', color: '#9B7FC4' },
}

export const TEMPLATES = [
  { title: '🍽️ Akşam yemeği', tag: 'date', time: '20:00' },
  { title: '🎬 Sinema', tag: 'date', time: '21:00' },
  { title: '🎶 Konser', tag: 'date', time: '21:00' },
  { title: '☕ Kahve buluşması', tag: 'date', time: '11:00' },
  { title: '🧺 Piknik', tag: 'date', time: '12:00' },
  { title: '🛒 Market alışverişi', tag: 'plan', time: '18:30' },
  { title: '🧹 Ev temizliği', tag: 'plan', time: '10:00' },
  { title: '🏋️ Spor', tag: 'plan', time: '08:00' },
  { title: '👨‍👩‍👧 Aile ziyareti', tag: 'plan', time: '13:00' },
  { title: '💼 Toplantı', tag: 'is', time: '10:00' },
  { title: '✈️ Tatil', tag: 'tatil', time: '' },
  { title: '🎂 Doğum günü', tag: 'ozel', time: '' },
  { title: '💍 Yıldönümü', tag: 'ozel', time: '' },
]

export const SURPRISE_COLOR = '#E0B25C'

export const DEFAULT_TEASER = 'O günü boş tut, sana bir sürprizim var 💌'

export const UNKNOWN_PERSON = { name: 'Eşin', short: '?', color: '#cbbfd3' }

export const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toLocaleUpperCase('tr'))
    .join('')
    .slice(0, 2)
