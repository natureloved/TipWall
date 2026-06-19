'use client'

export interface NimiqPayState {
  isNimiqPay: boolean
  language: string
}

const DETECTED: { isNimiqPay: boolean; language: string } = { isNimiqPay: false, language: 'en' }

function detect() {
  if (typeof window !== 'undefined') {
    const isNimiqPay = typeof (window as Record<string, unknown>).nimiq !== 'undefined'
    const lang =
      (window as Record<string, unknown> & { nimiqPay?: { language?: string } }).nimiqPay?.language ??
      navigator.language.split('-')[0] ??
      'en'
    return { isNimiqPay, language: String(lang) }
  }
  return DETECTED
}

export function useNimiqPay() {
  const state = detect()
  return { ...state, detect }
}

export function isNimiqPayAvailable(): boolean {
  return detect().isNimiqPay
}
