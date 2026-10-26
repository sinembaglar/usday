export const TAGS = {
  date: { label: 'Date', emoji: '💕', color: '#D99AB8' },
  plan: { label: 'Plan', emoji: '📝', color: '#D4A373' },
  is: { label: 'İş', emoji: '💼', color: '#8FA98F' },
  tatil: { label: 'Tatil', emoji: '✈️', color: '#8AA9C9' },
  ozel: { label: 'Özel gün', emoji: '🎉', color: '#9B7FC4' },
}

// Ready-made plans per category: picking a category shows only its own ideas.
export const TEMPLATES = {
  date: {
    heading: 'Date fikirleri',
    items: [
      { title: '🍽️ Akşam yemeği', time: '20:00' },
      { title: '🎬 Sinema', time: '21:00' },
      { title: '🎶 Konser', time: '21:00' },
      { title: '☕ Kahve buluşması', time: '11:00' },
      { title: '🥞 Brunch', time: '11:00' },
      { title: '🧺 Piknik', time: '12:00' },
      { title: '🎭 Tiyatro', time: '20:00' },
      { title: '🎳 Bowling', time: '19:00' },
      { title: '🌅 Gün batımı yürüyüşü', time: '18:00' },
      { title: '🍿 Evde film gecesi', time: '21:00' },
    ],
  },
  plan: {
    heading: 'Günlük planlar',
    items: [
      { title: '🛒 Market alışverişi', time: '18:30' },
      { title: '🧹 Ev temizliği', time: '10:00' },
      { title: '🏋️ Spor', time: '08:00', repeat: 'weekly' },
      { title: '👨‍👩‍👧 Aile ziyareti', time: '13:00' },
      { title: '🥂 Arkadaşlarla buluşma', time: '20:00' },
      { title: '🩺 Doktor randevusu', time: '10:00' },
      { title: '💇 Kuaför', time: '14:00' },
      { title: '🧾 Fatura ödemesi', time: '' },
    ],
  },
  is: {
    heading: 'İş planları',
    items: [
      { title: '💼 Toplantı', time: '10:00' },
      { title: '📊 Sunum', time: '14:00' },
      { title: '🍱 İş yemeği', time: '12:30' },
      { title: '🤝 Mülakat', time: '11:00' },
      { title: '⏳ Teslim tarihi', time: '' },
      { title: '🧳 İş seyahati', time: '' },
    ],
  },
  tatil: {
    heading: 'Seyahat',
    items: [
      { title: '🏖️ Hafta sonu kaçamağı', time: '' },
      { title: '✈️ Uçuş', time: '' },
      { title: '🏨 Otel girişi', time: '14:00' },
      { title: '🗺️ Şehir turu', time: '10:00' },
      { title: '🎒 Bavul hazırlığı', time: '20:00' },
    ],
  },
  ozel: {
    heading: 'Özel günler',
    items: [
      { title: '🎂 Doğum günü', time: '', repeat: 'yearly' },
      { title: '💍 Yıldönümü', time: '', repeat: 'yearly' },
      { title: '💘 Sevgililer Günü', time: '', repeat: 'yearly' },
      { title: '💒 Düğün', time: '19:00' },
      { title: '🎓 Mezuniyet', time: '14:00' },
      { title: '🌙 Bayram', time: '' },
    ],
  },
}

export const isTemplateTitle = (title) =>
  Object.values(TEMPLATES).some((c) => c.items.some((t) => t.title === title))

// Wish categories, and the plan category a wish becomes.
export const WISH_CATEGORIES = {
  gift: { label: 'Hediye', emoji: '🎁', planTag: 'ozel', placeholder: 'Örn. 👟 Beyaz sneaker' },
  travel: { label: 'Gezi', emoji: '✈️', planTag: 'tatil', placeholder: 'Örn. 🎈 Kapadokya balon turu' },
  experience: { label: 'Deneyim', emoji: '🍽️', planTag: 'date', placeholder: 'Örn. 🎶 Tarkan konseri' },
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
