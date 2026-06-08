'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useVendorCtx } from '@/app/(vendor)/vendor-context'

export interface NotificationSettings {
  soundEnabled: boolean
  volume: number
  repeatAlerts: boolean
  browserNotificationsEnabled: boolean
}

const DEFAULT_SETTINGS: NotificationSettings = {
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

export default function NotificationSettingsPage() {
  const params = useParams()
  const slug = params?.slug as string
  const ctx = useVendorCtx()

  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [success, setSuccess] = useState('')
  const [permissionStatus, setPermissionStatus] = useState<string>('default')

  useEffect(() => {
    setSettings(getNotificationSettings())
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission)
    }
  }, [])

  function updateSetting<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    saveNotificationSettings(updated)
  }

  async function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('This browser does not support desktop notifications.')
      return
    }
    const permission = await Notification.requestPermission()
    setPermissionStatus(permission)
    if (permission === 'granted') {
      updateSetting('browserNotificationsEnabled', true)
      new Notification('Notifications Enabled', {
        body: 'You will now receive alerts for incoming orders here.',
        icon: '/favicon.ico',
      })
    } else {
      updateSetting('browserNotificationsEnabled', false)
    }
  }

  function handleTestSound() {
    playChimeSound(settings.volume)
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <div className="page-header">
        <div>
          <h1>⚙️ Notification Settings</h1>
          <p>Configure sounds, repeats, and desktop notifications for <strong>{ctx?.restaurantName || slug}</strong></p>
        </div>
      </div>

      {success && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>✅ {success}</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Toggle Sound */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.25rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🔊 Notification Sound
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Play double-chime audio whenever a new order is received
            </div>
          </div>
          <button
            onClick={() => updateSetting('soundEnabled', !settings.soundEnabled)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              background: settings.soundEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
              color: settings.soundEnabled ? 'var(--accent-green)' : 'var(--accent-red)',
              border: `1px solid ${settings.soundEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
            }}
          >
            {settings.soundEnabled ? 'On' : 'Off'}
          </button>
        </div>

        {/* Adjust Volume */}
        {settings.soundEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                🎚️ Sound Volume
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleTestSound}>
                🔊 Test Chime
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.volume}
                onChange={e => updateSetting('volume', parseFloat(e.target.value))}
                style={{ flex: 1, height: '6px', background: 'var(--border-subtle)', outline: 'none' }}
              />
              <span style={{ fontWeight: 700, width: '40px', textAlign: 'right', fontSize: '0.9rem' }}>
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Repeat Alerts */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.25rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🔁 Repeat Alerts
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Repeat notification sound every 10 seconds until the order is acknowledged/dismissed
            </div>
          </div>
          <button
            onClick={() => updateSetting('repeatAlerts', !settings.repeatAlerts)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              background: settings.repeatAlerts ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
              color: settings.repeatAlerts ? 'var(--accent-green)' : 'var(--accent-red)',
              border: `1px solid ${settings.repeatAlerts ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
            }}
          >
            {settings.repeatAlerts ? 'Repeat' : 'Once'}
          </button>
        </div>

        {/* Browser Notifications */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🖥️ Browser Desktop Notifications
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Show system popup alerts even when you are on another tab or browser is minimized
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', marginTop: '0.25rem' }}>
              Permission status: {permissionStatus === 'granted' ? 'Allowed ✓' : permissionStatus === 'denied' ? 'Blocked ✗' : 'Not Requested'}
            </div>
          </div>
          <button
            className={`btn ${permissionStatus === 'granted' ? 'btn-secondary' : 'btn-gold'}`}
            onClick={requestNotificationPermission}
            disabled={permissionStatus === 'granted'}
            style={{ minHeight: '36px', fontSize: '0.85rem' }}
          >
            {permissionStatus === 'granted' ? 'Granted ✓' : 'Enable'}
          </button>
        </div>

      </div>
    </div>
  )
}
