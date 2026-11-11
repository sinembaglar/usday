import { num, t, upper } from './i18n'

export const TAGS = {
  date: { label: t('Buluşma', 'Date'), emoji: '💕', color: '#B5677F' },
  plan: { label: t('Plan', 'Plan'), emoji: '📝', color: '#B88A4E' },
  is: { label: t('İş', 'Work'), emoji: '💼', color: '#6E8B74' },
  tatil: { label: t('Tatil', 'Trip'), emoji: '✈️', color: '#6683A3' },
  ozel: { label: t('Özel gün', 'Special day'), emoji: '🎉', color: '#7E5A8C' },
}

// Ready-made plans per category: picking a category shows only its own ideas.
export const TEMPLATES = {
  date: {
    heading: t('Buluşma fikirleri', 'Date ideas'),
    items: [
      { title: t('🍽️ Akşam yemeği', '🍽️ Dinner'), time: '20:00' },
      { title: t('🎬 Sinema', '🎬 Movies'), time: '21:00' },
      { title: t('🎶 Konser', '🎶 Concert'), time: '21:00' },
      { title: t('☕ Kahve buluşması', '☕ Coffee date'), time: '11:00' },
      { title: '🥞 Brunch', time: '11:00' },
      { title: t('🧺 Piknik', '🧺 Picnic'), time: '12:00' },
      { title: t('🎭 Tiyatro', '🎭 Theatre'), time: '20:00' },
      { title: '🎳 Bowling', time: '19:00' },
      { title: t('🌅 Gün batımı yürüyüşü', '🌅 Sunset walk'), time: '18:00' },
      { title: t('🍿 Evde film gecesi', '🍿 Movie night in'), time: '21:00' },
    ],
  },
  plan: {
    heading: t('Günlük planlar', 'Everyday plans'),
    items: [
      { title: t('🛒 Market alışverişi', '🛒 Grocery shopping'), time: '18:30' },
      { title: t('🧹 Ev temizliği', '🧹 Cleaning day'), time: '10:00' },
      { title: t('🏋️ Spor', '🏋️ Workout'), time: '08:00', repeat: 'weekly' },
      { title: t('👨‍👩‍👧 Aile ziyareti', '👨‍👩‍👧 Family visit'), time: '13:00' },
      { title: t('🥂 Arkadaşlarla buluşma', '🥂 Drinks with friends'), time: '20:00' },
      { title: t('🩺 Doktor randevusu', '🩺 Doctor’s appointment'), time: '10:00' },
      { title: t('💇 Kuaför', '💇 Hair appointment'), time: '14:00' },
      { title: t('🧾 Fatura ödemesi', '🧾 Pay the bills'), time: '' },
    ],
  },
  is: {
    heading: t('İş planları', 'Work'),
    items: [
      { title: t('💼 Toplantı', '💼 Meeting'), time: '10:00' },
      { title: t('📊 Sunum', '📊 Presentation'), time: '14:00' },
      { title: t('🍱 İş yemeği', '🍱 Business lunch'), time: '12:30' },
      { title: t('🤝 Mülakat', '🤝 Interview'), time: '11:00' },
      { title: t('⏳ Teslim tarihi', '⏳ Deadline'), time: '' },
      { title: t('🧳 İş seyahati', '🧳 Business trip'), time: '' },
    ],
  },
  tatil: {
    heading: t('Seyahat', 'Travel'),
    items: [
      { title: t('🏖️ Hafta sonu kaçamağı', '🏖️ Weekend getaway'), time: '' },
      { title: t('✈️ Uçuş', '✈️ Flight'), time: '' },
      { title: t('🏨 Otel girişi', '🏨 Hotel check-in'), time: '14:00' },
      { title: t('🗺️ Şehir turu', '🗺️ City tour'), time: '10:00' },
      { title: t('🎒 Bavul hazırlığı', '🎒 Packing'), time: '20:00' },
    ],
  },
  ozel: {
    heading: t('Özel günler', 'Special days'),
    items: [
      { title: t('🎂 Doğum günü', '🎂 Birthday'), time: '', repeat: 'yearly' },
      { title: t('💍 Yıldönümü', '💍 Anniversary'), time: '', repeat: 'yearly' },
      { title: t('💘 Sevgililer Günü', '💘 Valentine’s Day'), time: '', repeat: 'yearly' },
      { title: t('💒 Düğün', '💒 Wedding'), time: '19:00' },
      { title: t('🎓 Mezuniyet', '🎓 Graduation'), time: '14:00' },
      { title: t('🌙 Bayram', '🎊 Holiday'), time: '' },
    ],
  },
}

// Who a connection is with. Partners count days and have "date"s; friends count days too.
export const RELATIONS = {
  partner: {
    label: t('Sevgilim / Eşim', 'Partner'),
    emoji: '💕',
    invite: t('Sevgilini davet et', 'Invite your partner'),
    dateLabel: t('Buluşma', 'Date'),
    since: t('Birlikte olduğumuz gün', 'The day we got together'),
    counter: (n) => t(`${num(n)}. günümüz`, `Day ${num(n)}`),
  },
  friend: {
    label: t('Arkadaşım', 'Friend'),
    emoji: '👯',
    invite: t('Arkadaşını davet et', 'Invite a friend'),
    dateLabel: t('Buluşma', 'Meetup'),
    since: t('Arkadaşlığımızın başladığı gün', 'The day our friendship began'),
    counter: (n) => t(`Arkadaşlığımızın ${num(n)}. günü`, `Day ${num(n)} of our friendship`),
  },
  sibling: {
    label: t('Kardeşim', 'Sibling'),
    emoji: '👭',
    invite: t('Kardeşini davet et', 'Invite your sibling'),
    dateLabel: t('Buluşma', 'Meetup'),
    since: null,
  },
  family: {
    label: t('Ailem', 'Family'),
    emoji: '👨‍👩‍👧',
    invite: t('Aileden birini davet et', 'Invite a family member'),
    dateLabel: t('Buluşma', 'Meetup'),
    since: null,
  },
}

// The "date" category becomes "buluşma" outside couples, with fitting ideas.
const MEETUPS = {
  friend: [
    { title: '🥞 Brunch', time: '11:00' },
    { title: t('☕ Kahve molası', '☕ Coffee break'), time: '15:00' },
    { title: t('🛍️ Alışveriş', '🛍️ Shopping'), time: '14:00' },
    { title: t('🎬 Sinema', '🎬 Movies'), time: '21:00' },
    { title: t('🎶 Konser', '🎶 Concert'), time: '21:00' },
    { title: t('💅 Spa / kuaför günü', '💅 Spa day'), time: '13:00' },
    { title: t('🍷 Dostlar gecesi', '🍷 Friends’ night'), time: '20:00' },
    { title: t('🚶 Yürüyüş', '🚶 Walk'), time: '18:00' },
    { title: '🎳 Bowling', time: '19:00' },
    { title: t('🍿 Film gecesi', '🍿 Movie night'), time: '21:00' },
  ],
  family: [
    { title: t('🍽️ Aile yemeği', '🍽️ Family dinner'), time: '19:00' },
    { title: t('🥐 Pazar kahvaltısı', '🥐 Sunday breakfast'), time: '10:00' },
    { title: t('☕ Kahve', '☕ Coffee'), time: '15:00' },
    { title: t('🛍️ Alışveriş', '🛍️ Shopping'), time: '14:00' },
    { title: t('🎬 Sinema', '🎬 Movies'), time: '21:00' },
    { title: t('🧺 Piknik', '🧺 Picnic'), time: '12:00' },
    { title: t('📞 Görüntülü arama', '📞 Video call'), time: '20:00' },
    { title: t('🌙 Bayram ziyareti', '🏡 Holiday visit'), time: '' },
  ],
}

export function templatesFor(tag, relation = 'partner') {
  if (tag === 'date' && relation !== 'partner') {
    return { heading: t('Buluşma fikirleri', 'Meetup ideas'), items: MEETUPS[relation === 'friend' ? 'friend' : 'family'] }
  }
  return TEMPLATES[tag]
}

export const tagLabel = (tag, relation = 'partner') =>
  tag === 'date' ? RELATIONS[relation]?.dateLabel ?? TAGS.date.label : TAGS[tag]?.label

// A "date" between friends or family is a meetup: no hearts.
export const tagEmoji = (tag, relation = 'partner') =>
  tag === 'date' && relation !== 'partner' ? '🥂' : (TAGS[tag] ?? TAGS.plan).emoji

export const isTemplateTitle = (title) =>
  [...Object.values(TEMPLATES), { items: [...MEETUPS.friend, ...MEETUPS.family] }].some((c) =>
    c.items.some((item) => item.title === title),
  )

// Wish categories, and the plan category a wish becomes.
export const WISH_CATEGORIES = {
  gift: { label: t('Hediye', 'Gift'), emoji: '🎁', planTag: 'ozel', placeholder: t('Örn. 👟 Beyaz sneaker', 'E.g. 👟 White sneakers') },
  travel: { label: t('Gezi', 'Trip'), emoji: '✈️', planTag: 'tatil', placeholder: t('Örn. 🎈 Kapadokya balon turu', 'E.g. 🎈 Hot-air balloon ride') },
  experience: { label: t('Deneyim', 'Experience'), emoji: '🍽️', planTag: 'date', placeholder: t('Örn. 🎶 Tarkan konseri', 'E.g. 🎶 A concert in the park') },
}

export const SURPRISE_COLOR = '#C49A45'

export const DEFAULT_TEASER = t('O günü boş tut, sana bir sürprizim var 💌', 'Keep that day free, I have a surprise for you 💌')

export const UNKNOWN_PERSON = { name: t('Biri', 'Someone'), short: '?', color: '#9c8f96' }

// How a comment made you feel; a double tap on a comment is the first one.
export const COMMENT_FEELINGS = ['😂', '😍', '😮', '😢', '😡', '👍']

export const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => upper(word[0]))
    .join('')
    .slice(0, 2)
