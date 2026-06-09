'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useVendorCtx } from '@/app/(vendor)/vendor-context'

const SEGMENT_LABELS: Record<string, string> = {
  ALL: '👥 All Customers',
  FREQUENT: '🔥 Frequent (5+ visits)',
  INACTIVE: '💤 Inactive (30+ days)',
  NEW: '🌱 New (last 7 days)',
  MARKETING_CONSENT: '📱 WhatsApp Consent',
}

const SEGMENT_COLORS: Record<string, string> = {
  ALL: 'var(--accent-primary)',
  FREQUENT: 'var(--accent-amber)',
  INACTIVE: 'var(--accent-red)',
  NEW: 'var(--accent-green)',
  MARKETING_CONSENT: '#10B981',
}

const MESSAGE_TEMPLATES = [
  { label: '🎉 Festival Offer', text: 'Hi {name}! 🎉 Celebrating the festival season with special offers just for you. Visit us today and enjoy 20% off on your order! 🍽️' },
  { label: '💝 Loyalty Reward', text: 'Hi {name}! You have {points} loyalty points waiting to be redeemed. Come visit us and enjoy your exclusive reward! 🌟' },
  { label: '📣 New Menu Item', text: 'Hi {name}! We\'ve added exciting new dishes to our menu. Come taste something new today! 🍴' },
  { label: '💤 Win-Back', text: 'Hi {name}! We miss you! It\'s been a while since your last visit. Come back and enjoy a special welcome-back discount! 🤗' },
  { label: '⭐ Thank You', text: 'Hi {name}! Thank you for being a valued customer. Your support means the world to us! 🙏' },
]

import { useAuth } from '@/hooks/useAuth'

export default function MarketingPage() {
  const { user } = useAuth()
  const params = useParams()
  const slug = params?.slug as string
  const ctx = useVendorCtx()
  const restaurantId = ctx?.restaurantId

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center', margin: '2rem auto', maxWidth: '500px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Access Denied</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Marketing campaigns and tracking have been moved to the Admin Dashboard. Only Platform Administrators have access.
        </p>
      </div>
    )
  }

  const [segments, setSegments] = useState<any>({})
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [creating, setCreating] = useState(false)
  const [sending, setSending] = useState<string | null>(null)

  const [showBuilder, setShowBuilder] = useState(false)
  const [form, setForm] = useState({ name: '', message: '', segment: 'ALL' })

  const load = useCallback(async () => {
    if (!restaurantId) return
    try {
      const [segs, camps] = await Promise.all([
        api.getSegments(restaurantId),
        api.getCampaigns(restaurantId),
      ])
      setSegments(segs)
      setCampaigns(camps || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurantId) return
    if (!form.name.trim() || !form.message.trim()) {
      setError('Campaign name and message are required')
      return
    }
    setCreating(true)
    setError('')
    try {
      await api.createCampaign(restaurantId, form)
      setSuccess('Campaign created successfully!')
      setTimeout(() => setSuccess(''), 4000)
      setShowBuilder(false)
      setForm({ name: '', message: '', segment: 'ALL' })
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleSend(campaignId: string) {
    if (!restaurantId) return
    if (!confirm('Send this campaign to all recipients now? This action cannot be undone.')) return
    setSending(campaignId)
    setError('')
    try {
      const result = await api.sendCampaign(restaurantId, campaignId)
      setSuccess(result.message || 'Campaign sent successfully!')
      setTimeout(() => setSuccess(''), 5000)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSending(null)
    }
  }

  async function handleDelete(campaignId: string) {
    if (!restaurantId) return
    if (!confirm('Delete this campaign?')) return
    try {
      await api.deleteCampaign(restaurantId, campaignId)
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (!restaurantId || loading) return <div className="loading-spinner" />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>📣 WhatsApp Marketing</h1>
          <p>Reach your customers with targeted campaigns via WhatsApp</p>
        </div>
        <button className="btn btn-gold" onClick={() => setShowBuilder(true)}>
          + New Campaign
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>✅ {success}</div>}

      <div className="alert alert-info" style={{ marginBottom: '2rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
        <div>
          <strong>WhatsApp Business API Integration</strong>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            Campaigns are currently logged to server console. To enable real WhatsApp delivery, add your{' '}
            <code>WHATSAPP_ACCESS_TOKEN</code> and <code>WHATSAPP_PHONE_ID</code> to Railway environment variables.
            The API integration point is ready in <code>routes/marketing.ts</code>.
          </p>
        </div>
      </div>

      {/* Segment Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {Object.entries(SEGMENT_LABELS).map(([key, label]) => (
          <div
            key={key}
            className="stat-card"
            style={{ cursor: 'pointer', transition: 'transform 0.15s', borderLeft: `4px solid ${SEGMENT_COLORS[key]}` }}
            onClick={() => { setShowBuilder(true); setForm(f => ({ ...f, segment: key })) }}
          >
            <div className="stat-value" style={{ color: SEGMENT_COLORS[key], fontSize: '1.75rem' }}>
              {segments[key] ?? 0}
            </div>
            <div className="stat-label">{label}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Click to target →</div>
          </div>
        ))}
      </div>

      {/* Campaign History */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>📋 Campaign History</h2>
        {campaigns.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📣</div>
            <div className="empty-state-title">No campaigns yet</div>
            <div className="empty-state-desc">Create your first campaign to reach your customers</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Segment</th>
                  <th>Status</th>
                  <th>Recipients</th>
                  <th>Sent At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.message}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: 'var(--bg-secondary)', borderRadius: '6px', color: SEGMENT_COLORS[c.segment] }}>
                        {SEGMENT_LABELS[c.segment] || c.segment}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${c.status === 'SENT' ? 'active' : c.status === 'FAILED' ? 'inactive' : 'pending'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{c.recipientCount}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {c.sentAt ? new Date(c.sentAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {c.status === 'DRAFT' && (
                          <button
                            className="btn btn-sm btn-gold"
                            onClick={() => handleSend(c.id)}
                            disabled={sending === c.id}
                            style={{ fontSize: '0.75rem' }}
                          >
                            {sending === c.id ? '⏳ Sending…' : '📤 Send'}
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(c.id)}
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

      {/* Campaign Builder Modal */}
      {showBuilder && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBuilder(false)}>
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-title">📣 Create Campaign</div>
            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label>Campaign Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Diwali Special Offer"
                  required
                />
              </div>

              <div className="form-group">
                <label>Target Segment</label>
                <select
                  value={form.segment}
                  onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '0.75rem', fontSize: '0.95rem', width: '100%' }}
                >
                  {Object.entries(SEGMENT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v} — {segments[k] ?? 0} customers</option>
                  ))}
                </select>
              </div>

              {/* Template picker */}
              <div className="form-group">
                <label>Message Templates (click to use)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {MESSAGE_TEMPLATES.map(t => (
                    <button
                      key={t.label}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => setForm(f => ({ ...f, message: t.text }))}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Message (use {'{name}'} for personalization)</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Type your message here... Use {name} to personalize."
                  rows={5}
                  style={{ resize: 'vertical' }}
                  required
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {form.message.length}/1000 characters
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-green)', marginBottom: '0.25rem' }}>
                  📊 Estimated Recipients
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  {segments[form.segment] ?? 0} customers
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowBuilder(false); setError('') }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold" disabled={creating}>
                  {creating ? 'Creating…' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
