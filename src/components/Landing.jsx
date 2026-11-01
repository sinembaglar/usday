import { Bell, Cake, CalendarCheck, CalendarSync, Gift, HeartHandshake, Lock, MessageCircleQuestion, Users } from 'lucide-react'
import { RELATIONS } from '../lib/constants'
import { RELATION_ICONS } from '../lib/icons'

// Until the store apps are out, UsDay is free on the web; the prices below start with them.
const STORES_LIVE = false

const FEATURES = [
  {
    Icon: MessageCircleQuestion,
    title: 'Plan sor, cevap bekle',
    text: '“Cumartesi sinema?” diye sor; uygun, değil ya da başka zaman desin. Kimse WhatsApp’ta kaybolmaz.',
  },
  {
    Icon: Gift,
    title: 'Gizli dilek listesi',
    text: 'Herkes istediklerini ekler. “Ben alıyorum” dediğini sahibi görmez, diğerleri aynı hediyeyi almaz.',
  },
  {
    Icon: Cake,
    title: 'Doğum günleri bir ay önceden',
    text: 'Sevdiklerinin doğum günü yaklaşınca hatırlatırız; tek dokunuşla sürpriz planlarsın.',
  },
  {
    Icon: Users,
    title: 'Grup planları',
    text: 'Doğum günü yemeği, tatil, kahvaltı: kimin geldiğini, kimin “belki” dediğini tek ekranda gör.',
  },
  {
    Icon: CalendarCheck,
    title: 'Ne zaman boş?',
    text: 'İstersen takvimini paylaş: sadece dolu ya da boş olduğun görünsün veya plan adların.',
  },
  {
    Icon: CalendarSync,
    title: 'Telefonunun takvimiyle',
    text: 'Planların Apple ve Google Takvim’ine de düşer. Sürprizler orada da gizli kalır.',
  },
]

const QUESTIONS = [
  {
    q: 'Google ya da Apple Takvim’den farkı ne?',
    a: 'Onlar takvim tutar; UsDay sevdiklerinle birlikte plan yapmak için. Sürpriz modu, plan sorma, dilek listesi ve doğum günü hatırlatmaları sadece burada. Planların istersen telefonunun takviminde de görünür.',
  },
  {
    q: 'Davet ettiğim kişi de ödemek zorunda mı?',
    a: 'Hayır. Bir abonelik seni ve bağlandığın 5 kişiyi kapsar; onlar ayrıca ödemez.',
  },
  {
    q: 'Verilerim güvende mi?',
    a: 'Planlarını sadece bağlandığın kişiler görür. Reklam yok, verilerini satmıyoruz. Sunucularımız Frankfurt’ta.',
  },
  {
    q: 'iPhone ve Android’de çalışır mı?',
    a: 'Evet. Şimdilik tarayıcıdan açıp ana ekrana ekleyebilirsin. App Store ve Google Play uygulamaları yakında.',
  },
  {
    q: 'Aboneliğim biterse ne olur?',
    a: 'Hiçbir şey silinmez. Takvimin salt okunur kalır; yeniden abone olunca kaldığın yerden devam edersin.',
  },
]

// What a visitor sees at usday.app before signing in: what UsDay is, for whom, and what it costs.
export default function Landing({ onStart, onLogin }) {
  return (
    <div className="landing">
      <header className="landing-bar">
        <span className="landing-brand">
          <img src="/icon-192.png" alt="" width="32" height="32" />
          UsDay
        </span>
        <button className="btn btn-secondary btn-small" onClick={onLogin}>
          Giriş yap
        </button>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-text">
            <span className="landing-eyebrow">Çiftler, aileler ve arkadaşlar için</span>
            <h1>Sevdiklerinle ortak takvim. Sürprizler dahil.</h1>
            <p>
              Planlarınızı tek yerde toplayın, doğum günlerini bir ay önceden hatırlayın, sürpriz hazırlayın. O sadece
              ipucunu görsün.
            </p>
            <div className="landing-ctas">
              <button className="btn btn-primary" onClick={onStart}>
                Hemen başla
              </button>
              <button className="btn btn-ghost" onClick={onLogin}>
                Hesabım var
              </button>
            </div>
          </div>
          <figure className="landing-phone">
            <img src="/landing/ana-ekran.jpg" alt="UsDay ana ekranı: sıradaki buluşma, kişiler ve bekleyen plan sorusu" width="585" height="996" />
          </figure>
        </section>

        <section className="landing-surprise" aria-labelledby="surprise-title">
          <div className="landing-section-head">
            <span className="landing-eyebrow">
              <Lock size={14} aria-hidden="true" /> Sürpriz modu
            </span>
            <h2 id="surprise-title">Sen her şeyi görürsün, o sadece ipucunu</h2>
            <p>Doğum günü, yıldönümü ya da sebepsiz bir akşam. Planı sen hazırlarsın; açılış gününe kadar sır kalır.</p>
          </div>
          <div className="landing-pair">
            <figure>
              <img src="/landing/surpriz-sen.jpg" alt="Sürprizi hazırlayanın gördüğü plan ayrıntısı" width="585" height="996" loading="lazy" />
              <figcaption>Senin ekranın</figcaption>
            </figure>
            <figure>
              <img src="/landing/surpriz-o.jpg" alt="Sürprizin hazırlandığı kişinin gördüğü ipucu" width="585" height="996" loading="lazy" />
              <figcaption>Onun ekranı</figcaption>
            </figure>
          </div>
        </section>

        <section aria-labelledby="features-title">
          <div className="landing-section-head">
            <h2 id="features-title">Takvimden fazlası</h2>
          </div>
          <div className="landing-features">
            {FEATURES.map(({ Icon, title, text }) => (
              <article key={title}>
                <span className="row-icon">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="landing-strip">
            <img src="/landing/dilekler.jpg" alt="Dilek listesi" width="585" height="996" loading="lazy" />
            <img src="/landing/grup-plani.jpg" alt="Davetlilerin cevaplarıyla bir grup planı" width="585" height="996" loading="lazy" />
            <img src="/landing/plan-detay.jpg" alt="Plan ayrıntısı ve sohbet" width="585" height="996" loading="lazy" />
          </div>
        </section>

        <section aria-labelledby="who-title">
          <div className="landing-section-head">
            <h2 id="who-title">Kiminle?</h2>
            <p>Her kişiyle ayrı bir ortak takvimin olur; biri diğerinin planlarını görmez. İstersen hepsini tek ekranda görürsün.</p>
          </div>
          <div className="landing-who">
            {Object.entries(RELATIONS).map(([key, r]) => {
              const Icon = RELATION_ICONS[key]
              return (
                <span key={key}>
                  <Icon size={18} aria-hidden="true" />
                  {r.label}
                </span>
              )
            })}
          </div>
        </section>

        <section aria-labelledby="how-title">
          <div className="landing-section-head">
            <h2 id="how-title">Nasıl başlanır?</h2>
          </div>
          <ol className="landing-steps">
            <li>
              <b>Kaydol</b>
              <span>Adın, doğum günün ve e-postan yeterli. Bir dakika sürer.</span>
            </li>
            <li>
              <b>Davet linkini gönder</b>
              <span>Sevgiline, annene, kardeşine ya da arkadaşına; WhatsApp’tan tek dokunuşla.</span>
            </li>
            <li>
              <b>Birlikte planlayın</b>
              <span>Katıldıkları anda ortak takviminiz açılır, eklediğin planlar orada hazır olur.</span>
            </li>
          </ol>
        </section>

        <section className="landing-price" aria-labelledby="price-title">
          <div className="landing-section-head">
            <h2 id="price-title">Fiyat</h2>
          </div>
          <div className="landing-price-card">
            {STORES_LIVE ? null : (
              <p className="landing-now">
                <HeartHandshake size={18} aria-hidden="true" /> Şu an web’de ücretsiz. Aşağıdaki fiyatlar App Store ve
                Google Play uygulamalarıyla başlayacak.
              </p>
            )}
            <div className="landing-plans">
              <div>
                <span>Yıllık</span>
                <b>799,90 TL</b>
                <small>Ayda 66,66 TL · 4 ay bedava</small>
              </div>
              <div>
                <span>Aylık</span>
                <b>99,90 TL</b>
                <small>İstediğin ay bırak</small>
              </div>
            </div>
            <ul>
              <li>3 gün ücretsiz dene</li>
              <li>Bir abonelik: sen ve bağlandığın 5 kişi</li>
              <li>Abonelik biterse hiçbir şey silinmez</li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="faq-title">
          <div className="landing-section-head">
            <h2 id="faq-title">Sık sorulanlar</h2>
          </div>
          <div className="landing-faq">
            {QUESTIONS.map(({ q, a }) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-final">
          <Bell size={22} aria-hidden="true" />
          <h2>Bir sonraki doğum gününü unutma</h2>
          <button className="btn btn-primary" onClick={onStart}>
            Hemen başla
          </button>
        </section>
      </main>

      <footer className="legal-links landing-footer">
        <a href="/gizlilik">Gizlilik Politikası</a> · <a href="/kosullar">Kullanım Koşulları</a> ·{' '}
        <a href="/hesap-silme">Hesap silme</a>
      </footer>
    </div>
  )
}
