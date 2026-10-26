import { supabase } from './supabase'

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent)

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

function keyBytes(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
}

// Asks for permission when needed (must run from a tap on iOS) and stores this device.
export async function enablePush() {
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') return permission

  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }))

  const { endpoint, keys } = subscription.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', { endpoint, p256dh: keys.p256dh, auth: keys.auth })
  if (error) throw error
  return permission
}

export function notifyPartner(eventId) {
  return supabase.functions.invoke('notify', { body: { event_id: eventId } }).catch(() => {})
}

export function notifyWish(wishId) {
  return supabase.functions.invoke('notify', { body: { wish_id: wishId } }).catch(() => {})
}

export function notifyAnswer(eventId) {
  return supabase.functions.invoke('notify', { body: { response_event_id: eventId } }).catch(() => {})
}

export function notifyComment(commentId) {
  return supabase.functions.invoke('notify', { body: { comment_id: commentId } }).catch(() => {})
}

export function notifyReaction(eventId, emoji) {
  return supabase.functions.invoke('notify', { body: { reaction_event_id: eventId, emoji } }).catch(() => {})
}
