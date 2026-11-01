import { publicOrigin, shareText } from './native'

// Sending an invitation: the phone's share menu, or the link copied where there is none.
// Returns true once the link has been handed over (shared or copied).
export async function shareInvite(code, onToast) {
  const link = `${publicOrigin()}/?davet=${code}`
  const text = `UsDay’de ortak takvimimizi açtım 💜 Bu linkle kayıt olunca takvimlerimiz birleşiyor (davet kodu: ${code})`
  if (await shareText({ title: 'UsDay', text, url: link })) return true
  await navigator.clipboard?.writeText(`${text}\n${link}`)
  onToast('🔗 Davet linki kopyalandı')
  return true
}
