'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useVendorCtx } from '@/app/(vendor)/vendor-context'

export default function LoyaltySettingsPage() {
  const params = useParams()
  const slug = params?.slug as string
  const ctx = useVendorCtx()
  const restaurantId = ctx?.restaurantId

  const [config, setConfig] = useState<any>({
    isEnabled: true,
    pointsPerRupee: 0.1,
    minOrderForPoints: 0,
    pointsToRupee: 0.1,
    minPointsRedeem: 100,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Analytics state
  const [analytics, setAnalytics] = useState<any>(null)

  const load = useCallback(async () => {
    if (!restaurantId) return
    try {
      const [cfg, analyticsData] = await Promise.all([
        api.getLoyaltyConfig(restaurantId),
        api.getRestaurantAnalytics(restaurantId),
      ])
      setConfig(cfg)
      setAnalytics(analyticsData)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!restaurantId) return
    setSaving(true)
    setError('')
    try {
      const updated = await api.saveLoyaltyConfig(restaurantId, {
        isEnabled: config.isEnabled,
        pointsPerRupee: parseFloat(config.pointsPerRupee),
        minOrderForPoints: parseFloat(config.minOrderForPoints),
        pointsToRupee: parseFloat(config.pointsToRupee),
        minPointsRedeem: parseInt(config.minPointsRedeem),
      })
      setConfig(updated)
      setSuccess('Loyalty settings saved successfully!')
      setTimeout(() => setSuccess(''), 4000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Preview calculator
  const sampleSpend = 500
  const earnedPoints = Math.floor(sampleSpend * parseFloat(config.pointsPerRupee || 0))
  const pointsValue = (earnedPoints * parseFloat(config.pointsToRupee || 0)).toFixed(2)
  const minRedeemValue = (parseInt(config.minPointsRedeem || 0) * parseFloat(config.pointsToRupee || 0)).toFixed(2)

  if (!restaurantId || loading) return <div className="loading-spinner" />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>⭐ Loyalty Program Settings</h1>
          <p>Configure how customers earn and redeem loyalty points at <strong>{ctx?.restaurantName || slug}</strong></p>
        </div>
        <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : '💾 Save Settings'}
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>✅ {success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
        {/* Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Enable/Disable */}
          <div className="card">
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>🔧 Program Status</h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Loyalty Program</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  When disabled, no points are earned or redeemed
                </div>
              </div>
              <button
                onClick={() => setConfig((c: any) => ({ ...c, isEnabled: !c.isEnabled }))}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  background: config.isEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                  color: config.isEnabled ? 'var(--accent-green)' : 'var(--accent-red)',
                  border: `1px solid ${config.isEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
                  transition: 'all 0.2s',
                }}
              >
                {config.isEnabled ? '✅ Enabled' : '❌ Disabled'}
              </button>
            </div>
          </div>

          {/* Earning Rules */}
          <div className="card">
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>🪙 Earning Rules</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Points earned per ₹1 spent</label>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0.5rem' }}>
                  Example: 0.1 means spend ₹100 = earn 10 points | 1.0 means spend ₹1 = earn 1 point
                </p>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.05"
                  value={config.pointsPerRupee}
                  onChange={e => setConfig((c: any) => ({ ...c, pointsPerRupee: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Minimum order amount to earn points (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={config.minOrderForPoints}
                  onChange={e => setConfig((c: any) => ({ ...c, minOrderForPoints: e.target.value }))}
                  placeholder="0 = no minimum"
                />
              </div>
            </div>
          </div>

          {/* Redemption Rules */}
          <div className="card">
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>🎁 Redemption Rules</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Rupee value per point (₹)</label>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0.5rem' }}>
                  Example: 0.1 means 100 points = ₹10 discount
                </p>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.05"
                  value={config.pointsToRupee}
                  onChange={e => setConfig((c: any) => ({ ...c, pointsToRupee: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Minimum points required to redeem</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={config.minPointsRedeem}
                  onChange={e => setConfig((c: any) => ({ ...c, minPointsRedeem: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview + Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Preview Calculator */}
          <div className="card" style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.1), rgba(212,175,55,0.1))', border: '1px solid rgba(212,175,55,0.2)' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>🔍 Preview Calculator</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>If customer spends ₹{sampleSpend}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-primary)', marginTop: '0.25rem' }}>
                  Earns {earnedPoints} points
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>worth ₹{pointsValue}</div>
              </div>
              <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Minimum to redeem</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--gold-primary)', marginTop: '0.25rem' }}>
                  {config.minPointsRedeem} points
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>= ₹{minRedeemValue} discount</div>
              </div>
            </div>
          </div>

          {/* Analytics */}
          {analytics && (
            <div className="card">
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>📊 Loyalty Analytics</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.875rem' }}>👥 Total Members</span>
                  <strong style={{ color: 'var(--accent-primary)' }}>{analytics.totalCustomers}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.875rem' }}>🧾 Total Orders</span>
                  <strong style={{ color: 'var(--accent-green)' }}>{analytics.totalOrders}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.875rem' }}>💰 Total Revenue</span>
                  <strong style={{ color: 'var(--gold-primary)' }}>₹{Number(analytics.totalRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>
            </div>
          )}

          <button className="btn btn-gold" onClick={handleSave} disabled={saving} style={{ width: '100%' }}>
            {saving ? 'Saving…' : '💾 Save Loyalty Settings'}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 900px) {
          .loyalty-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
