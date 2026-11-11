import { isEn, locale, timeZone } from './i18n'

// What UsDay+ costs. Until the store apps sell it and show each country's own price, Türkiye (a Turkish
// phone, or one set to Istanbul time) sees lira and everyone else dollars.
export const TRIAL_DAYS = 14

const inTurkey = !isEn || timeZone() === 'Europe/Istanbul'
const PLANS = inTurkey
  ? { currency: 'TRY', yearly: 399.9, monthly: 59.9, yearlyPerMonth: 33.33 }
  : { currency: 'USD', yearly: 39.99, monthly: 5.99, yearlyPerMonth: 3.33 }

// "399,90 TL" in Turkish; "$39.99" or "TRY 399.90" in English.
const money = (amount) =>
  PLANS.currency === 'TRY' && !isEn
    ? `${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
    : new Intl.NumberFormat(locale, { style: 'currency', currency: PLANS.currency }).format(amount)

export const PRICE = {
  yearly: money(PLANS.yearly),
  monthly: money(PLANS.monthly),
  yearlyPerMonth: money(PLANS.yearlyPerMonth),
  // The yearly price shared by everyone it covers, per month.
  perPerson: (max) => money(PLANS.yearly / 12 / (max + 1)),
}
