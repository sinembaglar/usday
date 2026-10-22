export const TAGS = {
  date: { label: 'Date', emoji: '💕', color: '#D99AB8' },
  plan: { label: 'Plan', emoji: '📝', color: '#D4A373' },
  is: { label: 'İş', emoji: '💼', color: '#8FA98F' },
  tatil: { label: 'Tatil', emoji: '✈️', color: '#8AA9C9' },
  ozel: { label: 'Özel gün', emoji: '🎉', color: '#9B7FC4' },
}

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
