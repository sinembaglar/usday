import { publicOrigin, shareText } from './native'
import { t } from './i18n'

// Sending an invitation: the phone's share menu, or the link copied where there is none.
// Returns true once the link has been handed over (shared or copied).
export async function shareInvite(code, onToast) {
  const link = `${publicOrigin()}/?davet=${code}`
  const text = t(
    `UsDay’de ortak takvimimizi açtım 💜 Bu linkle kayıt olunca takvimlerimiz birleşiyor (davet kodu: ${code})`,
    `I set up our shared calendar on UsDay 💜 Sign up with this link and our calendars come together (invite code: ${code})`,
  )
  if (await shareText({ title: 'UsDay', text, url: link })) return true
  await navigator.clipboard?.writeText(`${text}\n${link}`)
  onToast(t('🔗 Davet linki kopyalandı', '🔗 Invite link copied'))
  return true
}
