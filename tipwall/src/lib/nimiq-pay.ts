export const NIMIQ_PAY_IOS_URL = 'https://apps.apple.com/app/id6471844738'
export const NIMIQ_PAY_ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.nimiq.pay'

export function getNimiqPayDeepLink(url: string): string {
  return `nimiqpay://miniapp?url=${encodeURIComponent(url)}`
}

export function getNimiqPayStoreUrl(): string {
  if (typeof navigator === 'undefined') return NIMIQ_PAY_ANDROID_URL
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ? NIMIQ_PAY_IOS_URL : NIMIQ_PAY_ANDROID_URL
}
