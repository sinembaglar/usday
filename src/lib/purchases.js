// Buying UsDay+ in the phone app, through RevenueCat. Purchases happen in the App Store / Google Play sheet;
// RevenueCat then tells the billing-webhook function, which opens the connections in the database. The
// RevenueCat user id is the Supabase user id, so the webhook knows whose purchase it is. On the web there
// is nothing to buy: the paywall says to use the app.
import { Capacitor } from '@capacitor/core'
import { INTRO_ELIGIBILITY_STATUS, Purchases, PURCHASES_ERROR_CODE } from '@revenuecat/purchases-capacitor'
import { isNative } from './native'

// The entitlement UsDay+ gives in the RevenueCat dashboard (its identifier there is "usday").
const ENTITLEMENT = 'usday'

// Public SDK keys from the RevenueCat dashboard; they are meant to ship inside the app. A test build
// (`vite build --mode storetest`, key in .env.storetest.local) uses RevenueCat's Test Store instead, so
// purchases can be tried without the App Store or Google Play. That key must never reach a store build.
const TEST_KEY = import.meta.env.VITE_REVENUECAT_TEST_KEY
const KEYS = { ios: import.meta.env.VITE_REVENUECAT_IOS_KEY, android: import.meta.env.VITE_REVENUECAT_ANDROID_KEY }
const apiKey = isNative ? (TEST_KEY ?? KEYS[Capacitor.getPlatform()]) : null

// Whether this copy of UsDay can sell UsDay+ (the phone app, once the store is set up).
export const canBuy = Boolean(apiKey)

let configured = null // the user RevenueCat is set up for
let starting = null

// Called when someone signs in: purchases and restores belong to that account.
export async function startPurchases(userId) {
  if (!canBuy || !userId) return
  await starting
  starting = (async () => {
    if (!configured) await Purchases.configure({ apiKey, appUserID: userId })
    else if (configured !== userId) await Purchases.logIn({ appUserID: userId })
    configured = userId
  })()
  return starting
}

const isActive = (customerInfo) => Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENT])

// "P14D" → 14, "P2W" → 14, "P1M" → 30
function days(unit, n) {
  return n * ({ DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 }[unit] ?? 0)
}

// The yearly and monthly plans as the store sells them here: price in the phone's currency, and the free
// trial when this person can still get one.
export async function loadPlans() {
  await starting
  const offerings = await Purchases.getOfferings()
  const offering = offerings.current
  if (!offering) return null
  const packages = [offering.annual, offering.monthly].filter(Boolean)
  let eligible = {}
  if (Capacitor.getPlatform() === 'ios') {
    eligible = await Purchases.checkTrialOrIntroductoryPriceEligibility({
      productIdentifiers: packages.map((p) => p.product.identifier),
    }).catch(() => ({}))
  }
  const plan = (pkg) => {
    if (!pkg) return null
    const intro = pkg.product.introPrice
    const free = intro && intro.price === 0 ? days(intro.periodUnit, intro.periodNumberOfUnits * (intro.cycles || 1)) : 0
    const status = eligible[pkg.product.identifier]?.status
    return {
      pkg,
      price: pkg.product.priceString,
      amount: pkg.product.price,
      perMonth: pkg.product.pricePerMonthString,
      trialDays: status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE ? 0 : free,
    }
  }
  const yearly = plan(offering.annual)
  const monthly = plan(offering.monthly)
  // "5 ay bedava": how many months of the monthly price the yearly plan saves.
  const freeMonths = yearly && monthly ? Math.floor(12 - yearly.amount / monthly.amount) : 0
  return { yearly, monthly, freeMonths }
}

// Opens the store's purchase sheet. Returns 'bought', or 'cancelled' when the person closed it.
export async function buy(plan) {
  await starting
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: plan.pkg })
    return isActive(customerInfo) ? 'bought' : 'pending'
  } catch (err) {
    if (err?.userCancelled || err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return 'cancelled'
    throw err
  }
}

// "Satın alımları geri yükle": a subscription bought with this Apple / Google account comes back.
export async function restore() {
  await starting
  const { customerInfo } = await Purchases.restorePurchases()
  return isActive(customerInfo)
}
