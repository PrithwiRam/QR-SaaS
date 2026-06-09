export interface NotificationSettings {
  soundEnabled: boolean
  volume: number
  repeatAlerts: boolean
  browserNotificationsEnabled: boolean
}

export const DEFAULT_SETTINGS: NotificationSettings = {
  soundEnabled: true,
  volume: 0.8,
  repeatAlerts: true,
  browserNotificationsEnabled: false,
}

export function getNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem('vendor_notification_settings')
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_SETTINGS
}

export function saveNotificationSettings(s: NotificationSettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('vendor_notification_settings', JSON.stringify(s))
  } catch {}
}

export function playChimeSound(volume: number = 0.8) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const now = ctx.currentTime

    // First chime (D5)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now) // D5
    gain1.gain.setValueAtTime(0.35 * volume, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.5)

    // Second chime (A5)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880.00, now + 0.12) // A5
    gain2.gain.setValueAtTime(0.35 * volume, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.7)
  } catch (err) {
    console.warn("Failed to play notification audio chime:", err)
  }
}
