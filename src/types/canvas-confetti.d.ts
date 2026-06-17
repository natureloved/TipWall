declare module 'canvas-confetti' {
  export interface Options {
    particleCount?: number
    spread?: number
    origin?: { x?: number; y?: number }
    startVelocity?: number
    colors?: string[]
    shapes?: string[]
    zIndex?: number
    disableForReducedMotion?: boolean
  }
  export function confetti(options?: Options): void
  export default confetti
}
