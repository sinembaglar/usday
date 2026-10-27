// Sending an invitation: the phone's share menu, or the link copied where there is none.
export async function shareInvite(code, onToast) {
  const link = `${window.location.origin}/?davet=${code}`
  const text = `UsDay’de ortak takvimimizi açtım 💜 Bu linkle kayıt olunca takvimlerimiz birleşiyor (davet kodu: ${code})`
  if (navigator.share) {
    navigator.share({ title: 'UsDay', text, url: link }).catch(() => {})
  } else {
    await navigator.clipboard?.writeText(`${text}\n${link}`)
    onToast('🔗 Davet linki kopyalandı')
  }
}
