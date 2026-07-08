// Funnel events for the onboarding / tip-recovery conversion tracking.
// Counts are stored anonymously in KV (no PII, no IP). View events are deduped
// per anonymous client id per day so totals reflect people, not page refreshes.

export const FUNNEL_EVENTS = [
  'TIP_WALL_VIEWED',
  'TIP_BUTTON_CLICKED',
  'INSTALL_PROMPT_SHOWN',
  'CLAIM_LINK_CREATED',
  'RETURNED_AFTER_INSTALL',
  'TIP_COMPLETED',
  'WALL_SHARED',
] as const

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number]

export function isFunnelEvent(value: unknown): value is FunnelEvent {
  return typeof value === 'string' && (FUNNEL_EVENTS as readonly string[]).includes(value)
}
