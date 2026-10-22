# UsDay 💜

Çiftler için ortak takvim: date'ler, günlük planlar, anılar ve sürprizler tek yerde.

## Özellikler

- **Ortak takvim**: ay görünümü, günün planları ve yaklaşan etkinlikler
- **Etiketler**: 💕 Date, 📝 Plan, 💼 İş, ✈️ Tatil, 🎉 Özel gün
- **Bilet ve fotoğraf ekleme**: etkinliğe bilet görüntüsü veya fotoğraf iliştirme
- **🎁 Sürpriz modu**: partnerin sadece bir ipucu görür, detaylar seçilen günde açılır; biletler istenirse açılana kadar bulanık kalır
- **Kapak fotoğrafı ve geri sayım**: sıradaki date'e kaç gün kaldığını gösterir
- **PWA**: iPhone'da "Ana Ekrana Ekle" ile uygulama gibi çalışır

## Teknolojiler

React 19 · Vite · date-fns · Supabase (Auth, Postgres, Storage, Realtime)

## Gizlilik

Sürprizlerin gizliliği istemcide değil veritabanında sağlanır. Row Level Security kuralları, açılış gününe kadar sürprizin detaylarını ve bulanık seçilen fotoğrafları partnerin cihazına hiç göndermez. Partner sadece `surprise_teasers()` fonksiyonundan ipucunu ve tarihi alır. Şema: [`supabase/migrations`](supabase/migrations).

## Çalıştırma

`.env.local` dosyasına Supabase bilgilerini ekleyin:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

```bash
npm install
npm run dev
```

## Yol haritası

- [x] Supabase ile giriş ve ortak veritabanı
- [x] Fotoğrafların bulutta saklanması
- [x] Canlı güncelleme
- [ ] iOS web push bildirimleri
- [ ] Davet koduyla eşleşme (birden çok çift için)
