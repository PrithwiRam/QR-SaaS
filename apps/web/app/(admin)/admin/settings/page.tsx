'use client'
import { useState } from 'react'

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    whatsappPrice: 49,
    posterFee: 1500,
    adCommission: 10,
    platformName: 'QR SaaS Pro',
    supportEmail: 'support@qrsaas.com',
    enableRegistration: true,
  })
  const [success, setSuccess] = useState('')

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSuccess('Platform settings updated successfully!')
    setTimeout(() => setSuccess(''), 4000)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>⚙️ Platform Settings</h1>
          <p>Configure global platform commissions, prices, branding, and parameters</p>
        </div>
      </div>

      {success && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>✅ {success}</div>}

      <div className="grid-2">
        <div className="card">
          <h2>💰 Marketing Fees & Commissions</h2>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
            <div className="form-group">
              <label>WhatsApp Campaign Rate (INR per campaign dispatch)</label>
              <input
                type="number"
                value={settings.whatsappPrice}
                onChange={e => setSettings(s => ({ ...s, whatsappPrice: Number(e.target.value) }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Graphic Poster Design Fee (INR per delivered poster)</label>
              <input
                type="number"
                value={settings.posterFee}
                onChange={e => setSettings(s => ({ ...s, posterFee: Number(e.target.value) }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Ad Management Commission Rate (%)</label>
              <input
                type="number"
                value={settings.adCommission}
                onChange={e => setSettings(s => ({ ...s, adCommission: Number(e.target.value) }))}
                min={0}
                max={100}
                required
              />
            </div>
            <button type="submit" className="btn btn-gold">Save Commission Settings</button>
          </form>
        </div>

        <div className="card">
          <h2>🏢 Brand & System Control</h2>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
            <div className="form-group">
              <label>Platform App Branding Name</label>
              <input
                value={settings.platformName}
                onChange={e => setSettings(s => ({ ...s, platformName: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Administrative Support Email</label>
              <input
                type="email"
                value={settings.supportEmail}
                onChange={e => setSettings(s => ({ ...s, supportEmail: e.target.value }))}
                required
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
              <input
                type="checkbox"
                checked={settings.enableRegistration}
                onChange={e => setSettings(s => ({ ...s, enableRegistration: e.target.checked }))}
                style={{ width: 'auto' }}
                id="enableRegistration"
              />
              <label htmlFor="enableRegistration" style={{ marginBottom: 0, cursor: 'pointer' }}>
                Allow public registrations for new restaurant vendors
              </label>
            </div>
            <button type="submit" className="btn btn-gold">Save Branding Settings</button>
          </form>
        </div>
      </div>
    </div>
  )
}
