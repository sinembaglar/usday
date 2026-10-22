import { addDays, format } from 'date-fns'

const day = (offset) => format(addDays(new Date(), offset), 'yyyy-MM-dd')

export const seedEvents = [
  {
    id: 'seed-1',
    title: 'Akşam yemeği',
    date: day(0),
    time: '20:00',
    tag: 'date',
    note: 'Kadıköy, o sevdiğimiz yer',
    createdBy: 'partner',
    surprise: false,
  },
  {
    id: 'seed-2',
    title: 'Market alışverişi',
    date: day(1),
    time: '18:30',
    tag: 'plan',
    note: 'Kahve bitti ☕',
    createdBy: 'me',
    surprise: false,
  },
  {
    id: 'seed-3',
    title: 'Konser 🎶',
    date: day(5),
    time: '21:00',
    tag: 'date',
    note: '2 bilet, sahne önü',
    createdBy: 'me',
    surprise: true,
    teaser: 'O akşamı boş tut, sana bir sürprizim var 💌',
    revealOn: day(5),
  },
  {
    id: 'seed-4',
    title: 'Proje teslimi',
    date: day(3),
    time: '10:00',
    tag: 'is',
    note: '',
    createdBy: 'partner',
    surprise: false,
  },
  {
    id: 'seed-5',
    title: 'Kapadokya kaçamağı',
    date: day(18),
    time: '',
    tag: 'tatil',
    note: 'Balon turu rezervasyonu yapılacak',
    createdBy: 'partner',
    surprise: false,
  },
]
