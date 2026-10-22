export const USERS = {
  me: { id: 'me', name: 'Sinem', short: 'S', dative: "Sinem'e", color: '#C58FB8' },
  partner: { id: 'partner', name: 'Serhat Han', short: 'SH', dative: "Serhat Han'a", color: '#8AA0C9' },
}

export const otherUser = (id) => USERS[id === 'me' ? 'partner' : 'me']

export const TAGS = {
  date: { label: 'Date', emoji: '💕', color: '#D99AB8' },
  plan: { label: 'Plan', emoji: '📝', color: '#D4A373' },
  is: { label: 'İş', emoji: '💼', color: '#8FA98F' },
  tatil: { label: 'Tatil', emoji: '✈️', color: '#8AA9C9' },
  ozel: { label: 'Özel gün', emoji: '🎉', color: '#9B7FC4' },
}

export const SURPRISE_COLOR = '#E0B25C'

export const DEFAULT_TEASER = 'O günü boş tut, sana bir sürprizim var 💌'
