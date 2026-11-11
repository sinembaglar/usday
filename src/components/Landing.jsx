import { Bell, Cake, CalendarCheck, CalendarSync, Gift, HeartHandshake, Lock, MessageCircleQuestion, Users } from 'lucide-react'
import { RELATIONS } from '../lib/constants'
import { RELATION_ICONS } from '../lib/icons'
import { isEn, t } from '../lib/i18n'
import { pageUrl } from '../lib/native'
import { PRICE, TRIAL_DAYS } from '../lib/prices'

// Until the store apps are out, UsDay is free on the web; the prices below start with them.
const STORES_LIVE = false

const FEATURES = [
  {
    Icon: MessageCircleQuestion,
    title: t('Plan sor, cevap bekle', 'Ask before you plan'),
    text: t(
      '“Cumartesi sinema?” diye sor; uygun, değil ya da başka zaman desin. Kimse WhatsApp’ta kaybolmaz.',
      '“Movies on Saturday?” Ask, and they can say yes, no or another time. Nothing gets lost in the group chat.',
    ),
  },
  {
    Icon: Gift,
    title: t('Gizli dilek listesi', 'A secret wish list'),
    text: t(
      'Herkes istediklerini ekler. “Ben alıyorum” dediğini sahibi görmez, diğerleri aynı hediyeyi almaz.',
      'Everyone adds what they’d love. Say “I’m getting it”: the owner never knows, and nobody else buys the same gift.',
    ),
  },
  {
    Icon: Cake,
    title: t('Doğum günleri bir ay önceden', 'Birthdays a month ahead'),
    text: t(
      'Sevdiklerinin doğum günü yaklaşınca hatırlatırız; tek dokunuşla sürpriz planlarsın.',
      'We remind you when a birthday is coming up, and you can plan a surprise in one tap.',
    ),
  },
  {
    Icon: Users,
    title: t('Grup planları', 'Group plans'),
    text: t(
      'Doğum günü yemeği, tatil, kahvaltı: kimin geldiğini, kimin “belki” dediğini tek ekranda gör.',
      'A birthday dinner, a trip, brunch: see who’s coming and who said “maybe”, all on one screen.',
    ),
  },
  {
    Icon: CalendarCheck,
    title: t('Ne zaman boş?', 'When are you free?'),
    text: t(
      'İstersen takvimini paylaş: sadece dolu ya da boş olduğun görünsün veya plan adların.',
      'Share your calendar if you like: just when you’re busy, or your plan names too.',
    ),
  },
  {
    Icon: CalendarSync,
    title: t('Telefonunun takvimiyle', 'Works with your phone’s calendar'),
    text: t(
      'Planların Apple ve Google Takvim’ine de düşer. Sürprizler orada da gizli kalır.',
      'Your plans show up in Apple and Google Calendar too. Surprises stay hidden there as well.',
    ),
  },
]

const QUESTIONS = [
  {
    q: t('Google ya da Apple Takvim’den farkı ne?', 'How is it different from Google or Apple Calendar?'),
    a: t(
      'Onlar takvim tutar; UsDay sevdiklerinle birlikte plan yapmak için. Sürpriz modu, plan sorma, dilek listesi ve doğum günü hatırlatmaları sadece burada. Planların istersen telefonunun takviminde de görünür.',
      'They keep a calendar; UsDay is for making plans together with your people. Surprise mode, asking before you plan, wish lists and birthday reminders are only here. Your plans can show up in your phone’s calendar too.',
    ),
  },
  {
    q: t('Davet ettiğim kişi de ödemek zorunda mı?', 'Does the person I invite have to pay too?'),
    a: t(
      'Hayır. Bir abonelik seni ve bağlandığın 5 kişiyi kapsar; onlar ayrıca ödemez.',
      'No. One subscription covers you and 5 people you’re connected with; they don’t pay separately.',
    ),
  },
  {
    q: t('Verilerim güvende mi?', 'Is my data safe?'),
    a: t(
      'Planlarını sadece bağlandığın kişiler görür. Reklam yok, verilerini satmıyoruz. Sunucularımız Frankfurt’ta.',
      'Only the people you connect with see your plans. No ads, and we never sell your data. Our servers are in Frankfurt, Germany.',
    ),
  },
  {
    q: t('iPhone ve Android’de çalışır mı?', 'Does it work on iPhone and Android?'),
    a: t(
      'Evet. Şimdilik tarayıcıdan açıp ana ekrana ekleyebilirsin. App Store ve Google Play uygulamaları yakında.',
      'Yes. For now, open it in your browser and add it to your home screen. The App Store and Google Play apps are coming soon.',
    ),
  },
  {
    q: t('Aboneliğim biterse ne olur?', 'What happens if my subscription ends?'),
    a: t(
      'Hiçbir şey silinmez. Takvimin salt okunur kalır; yeniden abone olunca kaldığın yerden devam edersin.',
      'Nothing is deleted. Your calendar becomes read-only, and you pick up where you left off when you subscribe again.',
    ),
  },
]

// The screenshots show the app in the page's language.
const shot = (name) => `/landing/${isEn ? 'en/' : ''}${name}.jpg`

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
          {t('Giriş yap', 'Sign in')}
        </button>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-text">
            <span className="landing-eyebrow">{t('Çiftler, aileler ve arkadaşlar için', 'For couples, families and friends')}</span>
            <h1>{t('Sevdiklerinle ortak takvim. Sürprizler dahil.', 'A shared calendar for your people. Surprises included.')}</h1>
            <p>
              {t(
                'Planlarınızı tek yerde toplayın, doğum günlerini bir ay önceden hatırlayın, sürpriz hazırlayın. O sadece ipucunu görsün.',
                'Keep your plans in one place, remember birthdays a month ahead and plan surprises. They only see the hint.',
              )}
            </p>
            <div className="landing-ctas">
              <button className="btn btn-primary" onClick={onStart}>
                {t('Hemen başla', 'Get started')}
              </button>
              <button className="btn btn-ghost" onClick={onLogin}>
                {t('Hesabım var', 'I have an account')}
              </button>
            </div>
          </div>
          <figure className="landing-phone">
            <img
              src={shot('ana-ekran')}
              alt={t('UsDay ana ekranı: sıradaki buluşma, kişiler ve bekleyen plan sorusu', 'The UsDay home screen: the next date, your people and a plan waiting for an answer')}
              width="585"
              height="996"
            />
          </figure>
        </section>

        <section className="landing-surprise" aria-labelledby="surprise-title">
          <div className="landing-section-head">
            <span className="landing-eyebrow">
              <Lock size={14} aria-hidden="true" /> {t('Sürpriz modu', 'Surprise mode')}
            </span>
            <h2 id="surprise-title">{t('Sen her şeyi görürsün, o sadece ipucunu', 'You see everything, they only see the hint')}</h2>
            <p>
              {t(
                'Doğum günü, yıldönümü ya da sebepsiz bir akşam. Planı sen hazırlarsın; açılış gününe kadar sır kalır.',
                'A birthday, an anniversary or an evening just because. You plan it; it stays a secret until the reveal day.',
              )}
            </p>
          </div>
          <div className="landing-pair">
            <figure>
              <img
                src={shot('surpriz-sen')}
                alt={t('Sürprizi hazırlayanın gördüğü plan ayrıntısı', 'The plan as the person making the surprise sees it')}
                width="585"
                height="996"
                loading="lazy"
              />
              <figcaption>{t('Senin ekranın', 'Your screen')}</figcaption>
            </figure>
            <figure>
              <img
                src={shot('surpriz-o')}
                alt={t('Sürprizin hazırlandığı kişinin gördüğü ipucu', 'The hint the surprise is for sees')}
                width="585"
                height="996"
                loading="lazy"
              />
              <figcaption>{t('Onun ekranı', 'Their screen')}</figcaption>
            </figure>
          </div>
        </section>

        <section aria-labelledby="features-title">
          <div className="landing-section-head">
            <h2 id="features-title">{t('Takvimden fazlası', 'More than a calendar')}</h2>
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
            <img src={shot('dilekler')} alt={t('Dilek listesi', 'A wish list')} width="585" height="996" loading="lazy" />
            <img
              src={shot('grup-plani')}
              alt={t('Davetlilerin cevaplarıyla bir grup planı', 'A group plan with everyone’s answers')}
              width="585"
              height="996"
              loading="lazy"
            />
            <img src={shot('plan-detay')} alt={t('Plan ayrıntısı ve sohbet', 'A plan and its chat')} width="585" height="996" loading="lazy" />
          </div>
        </section>

        <section aria-labelledby="who-title">
          <div className="landing-section-head">
            <h2 id="who-title">{t('Kiminle?', 'Who with?')}</h2>
            <p>
              {t(
                'Her kişiyle ayrı bir ortak takvimin olur; biri diğerinin planlarını görmez. İstersen hepsini tek ekranda görürsün.',
                'You get a separate shared calendar with each person; nobody sees the others’ plans. You can see them all on one screen.',
              )}
            </p>
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
            <h2 id="how-title">{t('Nasıl başlanır?', 'How it works')}</h2>
          </div>
          <ol className="landing-steps">
            <li>
              <b>{t('Kaydol', 'Sign up')}</b>
              <span>{t('Adın, doğum günün ve e-postan yeterli. Bir dakika sürer.', 'Your name, birthday and email are all it takes. One minute.')}</span>
            </li>
            <li>
              <b>{t('Davet linkini gönder', 'Send your invite link')}</b>
              <span>
                {t(
                  'Sevgiline, annene, kardeşine ya da arkadaşına; WhatsApp’tan tek dokunuşla.',
                  'To your partner, your mum, a sibling or a friend, in one tap.',
                )}
              </span>
            </li>
            <li>
              <b>{t('Birlikte planlayın', 'Plan together')}</b>
              <span>
                {t(
                  'Katıldıkları anda ortak takviminiz açılır, eklediğin planlar orada hazır olur.',
                  'Your shared calendar opens the moment they join, with your plans already there.',
                )}
              </span>
            </li>
          </ol>
        </section>

        <section className="landing-price" aria-labelledby="price-title">
          <div className="landing-section-head">
            <h2 id="price-title">{t('Fiyat', 'Price')}</h2>
          </div>
          <div className="landing-price-card">
            {STORES_LIVE ? null : (
              <p className="landing-now">
                <HeartHandshake size={18} aria-hidden="true" />{' '}
                {t(
                  'Şu an web’de ücretsiz. Aşağıdaki fiyatlar App Store ve Google Play uygulamalarıyla başlayacak.',
                  'Free on the web for now. The prices below start with the App Store and Google Play apps.',
                )}
              </p>
            )}
            <div className="landing-plans">
              <div>
                <span>{t('Yıllık', 'Yearly')}</span>
                <b>{PRICE.yearly}</b>
                <small>{t(`Ayda ${PRICE.yearlyPerMonth} · 5 ay bedava`, `${PRICE.yearlyPerMonth} a month · 5 months free`)}</small>
              </div>
              <div>
                <span>{t('Aylık', 'Monthly')}</span>
                <b>{PRICE.monthly}</b>
                <small>{t('İstediğin ay bırak', 'Stop any month')}</small>
              </div>
            </div>
            <ul>
              <li>{t(`${TRIAL_DAYS} gün ücretsiz dene`, `Try it free for ${TRIAL_DAYS} days`)}</li>
              <li>{t('Bir abonelik: sen ve bağlandığın 5 kişi', 'One subscription: you and 5 of your people')}</li>
              <li>{t('Abonelik biterse hiçbir şey silinmez', 'Nothing is deleted if it ends')}</li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="faq-title">
          <div className="landing-section-head">
            <h2 id="faq-title">{t('Sık sorulanlar', 'Questions')}</h2>
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
          <h2>{t('Bir sonraki doğum gününü unutma', 'Never miss the next birthday')}</h2>
          <button className="btn btn-primary" onClick={onStart}>
            {t('Hemen başla', 'Get started')}
          </button>
        </section>
      </main>

      <footer className="legal-links landing-footer">
        <a href={pageUrl('gizlilik')}>{t('Gizlilik Politikası', 'Privacy Policy')}</a> ·{' '}
        <a href={pageUrl('kosullar')}>{t('Kullanım Koşulları', 'Terms of Use')}</a> ·{' '}
        <a href={pageUrl('hesap-silme')}>{t('Hesap silme', 'Delete account')}</a> · <a href={pageUrl('destek')}>{t('Destek', 'Support')}</a>
      </footer>
    </div>
  )
}
