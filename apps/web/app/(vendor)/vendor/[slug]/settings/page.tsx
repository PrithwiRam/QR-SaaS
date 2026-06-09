'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useVendorCtx } from '@/app/(vendor)/vendor-context'
import { api } from '@/lib/api'

import {
  NotificationSettings,
  DEFAULT_SETTINGS,
  getNotificationSettings,
  saveNotificationSettings,
  playChimeSound,
} from '@/lib/notifications'

type SettingsTab = 'notifications' | 'staff'

export default function SettingsPage() {
  const params = useParams()
  const slug = params?.slug as string
  const ctx = useVendorCtx()
  const restaurantId = ctx?.restaurantId

  const [activeTab, setActiveTab] = useState<SettingsTab>('notifications')

  // Notification states
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [permissionStatus, setPermissionStatus] = useState<string>('default')

  // Staff management states
  const [staffList, setStaffList] = useState<any[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [showAddStaffModal, setShowAddStaffModal] = useState(false)
  const [staffForm, setStaffForm] = useState({ email: '', password: '' })

  useEffect(() => {
    setNotifSettings(getNotificationSettings())
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission)
    }
  }, [])

  const loadStaff = useCallback(async () => {
    if (!restaurantId) return
    try {
      setLoadingStaff(true)
      const data = await api.getStaff(restaurantId)
      setStaffList(data || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load staff list')
    } finally {
      setLoadingStaff(false)
    }
  }, [restaurantId])

  useEffect(() => {
    if (activeTab === 'staff') {
      loadStaff()
    }
  }, [activeTab, loadStaff])

  function updateSetting<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    const updated = { ...notifSettings, [key]: value }
    setNotifSettings(updated)
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
    playChimeSound(notifSettings.volume)
  }

  // Staff Actions
  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurantId) return
    setError('')
    try {
      await api.createStaff(restaurantId, staffForm)
      setSuccess('Kitchen Staff user created successfully!')
      setStaffForm({ email: '', password: '' })
      setShowAddStaffModal(false)
      loadStaff()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to create staff member')
    }
  }

  async function handleToggleStaffStatus(staffId: string, currentStatus: boolean) {
    if (!restaurantId) return
    try {
      await api.updateStaff(restaurantId, staffId, { isActive: !currentStatus })
      setSuccess('Staff account status toggled successfully')
      loadStaff()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to update staff status')
    }
  }

  async function handleResetStaffPassword(staffId: string) {
    if (!restaurantId) return
    const newPassword = prompt('Enter new password for this kitchen staff member (min 6 chars):')
    if (!newPassword) return
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long.')
      return
    }
    try {
      await api.updateStaff(restaurantId, staffId, { password: newPassword })
      setSuccess('Staff password reset successfully')
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to reset staff password')
    }
  }

  async function handleDeleteStaff(staffId: string) {
    if (!restaurantId) return
    if (!confirm('Are you sure you want to permanently delete this kitchen staff member?')) return
    try {
      await api.deleteStaff(restaurantId, staffId)
      setSuccess('Staff member deleted successfully')
      loadStaff()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to delete staff member')
    }
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1rem' }}>
      <div className="page-header">
        <div>
          <h1>⚙️ Settings</h1>
          <p>Configure notifications and manage restaurant staff credentials</p>
        </div>
      </div>

      {success && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>✅ {success}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>⚠️ {error}</div>}

      {/* Tabs */}
      <div className="flex gap-2" style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`btn btn-sm ${activeTab === 'notifications' ? 'btn-gold' : 'btn-secondary'}`}
        >
          🔊 Notifications
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`btn btn-sm ${activeTab === 'staff' ? 'btn-gold' : 'btn-secondary'}`}
        >
          👥 Kitchen Staff
        </button>
      </div>

      {activeTab === 'notifications' && (
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
              onClick={() => updateSetting('soundEnabled', !notifSettings.soundEnabled)}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '20px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem',
                background: notifSettings.soundEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                color: notifSettings.soundEnabled ? 'var(--accent-green)' : 'var(--accent-red)',
                border: `1px solid ${notifSettings.soundEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
              }}
            >
              {notifSettings.soundEnabled ? 'On' : 'Off'}
            </button>
          </div>

          {/* Adjust Volume */}
          {notifSettings.soundEnabled && (
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
                  value={notifSettings.volume}
                  onChange={e => updateSetting('volume', parseFloat(e.target.value))}
                  style={{ flex: 1, height: '6px', background: 'var(--border-subtle)', outline: 'none' }}
                />
                <span style={{ fontWeight: 700, width: '40px', textAlign: 'right', fontSize: '0.9rem' }}>
                  {Math.round(notifSettings.volume * 100)}%
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
              onClick={() => updateSetting('repeatAlerts', !notifSettings.repeatAlerts)}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '20px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem',
                background: notifSettings.repeatAlerts ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                color: notifSettings.repeatAlerts ? 'var(--accent-green)' : 'var(--accent-red)',
                border: `1px solid ${notifSettings.repeatAlerts ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
              }}
            >
              {notifSettings.repeatAlerts ? 'Repeat' : 'Once'}
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
      )}

      {activeTab === 'staff' && (
        <div className="card">
          <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.1rem' }}>🍳 Active Kitchen Staff Accounts</h2>
            <button className="btn btn-gold btn-sm" onClick={() => setShowAddStaffModal(true)}>
              + Add Kitchen Staff
            </button>
          </div>

          {loadingStaff ? (
            <div className="loading-spinner" />
          ) : staffList.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-title">No kitchen staff yet</div>
              <div className="empty-state-desc">Create kitchen credentials so your staff can log directly into the Kitchen Display board</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Email Address</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.email}</td>
                      <td>
                        <span className={`badge badge-${s.isActive ? 'active' : 'inactive'}`}>
                          {s.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {new Date(s.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleToggleStaffStatus(s.id, s.isActive)}
                            style={{ fontSize: '0.75rem' }}
                          >
                            {s.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleResetStaffPassword(s.id)}
                            style={{ fontSize: '0.75rem' }}
                          >
                            Reset Password
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteStaff(s.id)}
                            style={{ fontSize: '0.75rem', background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div className="modal-overlay" onClick={() => setShowAddStaffModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-title">👥 Add Kitchen Staff Member</div>
            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Login Email Address</label>
                <input
                  type="email"
                  value={staffForm.email}
                  onChange={e => setStaffForm(sf => ({ ...sf, email: e.target.value }))}
                  placeholder="kitchen@restaurant.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Login Password</label>
                <input
                  type="password"
                  value={staffForm.password}
                  onChange={e => setStaffForm(sf => ({ ...sf, password: e.target.value }))}
                  placeholder="••••••"
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddStaffModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold">
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
