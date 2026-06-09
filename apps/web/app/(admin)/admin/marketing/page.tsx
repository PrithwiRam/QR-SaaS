'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

type Tab = 'overview' | 'ads' | 'posters' | 'leads' | 'campaigns'

export default function AdminMarketingPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<any>(null)
  const [ads, setAds] = useState<any[]>([])
  const [posters, setPosters] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [restaurants, setRestaurants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Modals state
  const [showAdModal, setShowAdModal] = useState(false)
  const [showPosterModal, setShowPosterModal] = useState(false)
  const [showLeadModal, setShowLeadModal] = useState(false)

  // Forms state
  const [adForm, setAdForm] = useState({ restaurantId: '', platform: 'META', budget: 5000, notes: '' })
  const [posterForm, setPosterForm] = useState({ restaurantId: '', concept: '', size: 'SQUARE' })
  const [leadForm, setLeadForm] = useState({ restaurantId: '', name: '', email: '', phone: '', source: 'META Ads', status: 'NEW' })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const [s, a, p, l, r] = await Promise.all([
        api.getMarketingStats(),
        api.getAdminAds(),
        api.getAdminPosters(),
        api.getAdminLeads(),
        api.getRestaurants()
      ])
      setStats(s)
      setAds(a || [])
      setPosters(p || [])
      setLeads(l || [])
      setRestaurants(r.restaurants || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load marketing dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleCreateAd(e: React.FormEvent) {
    e.preventDefault()
    if (!adForm.restaurantId) return setError('Please select a restaurant')
    try {
      await api.createAdminAd(adForm)
      setSuccess('Ad campaign request created successfully!')
      setShowAdModal(false)
      setAdForm({ restaurantId: '', platform: 'META', budget: 5000, notes: '' })
      loadData()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleUpdateAdStatus(id: string, status: string) {
    try {
      await api.updateAdminAd(id, { status })
      setSuccess('Ad status updated successfully')
      loadData()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleCreatePoster(e: React.FormEvent) {
    e.preventDefault()
    if (!posterForm.restaurantId) return setError('Please select a restaurant')
    try {
      await api.createAdminPoster(posterForm)
      setSuccess('Poster design request created successfully!')
      setShowPosterModal(false)
      setPosterForm({ restaurantId: '', concept: '', size: 'SQUARE' })
      loadData()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleUpdatePoster(id: string, status: string, imageUrl?: string) {
    try {
      await api.updateAdminPoster(id, { status, imageUrl })
      setSuccess('Poster updated successfully')
      loadData()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleCreateLead(e: React.FormEvent) {
    e.preventDefault()
    if (!leadForm.restaurantId) return setError('Please select a restaurant')
    try {
      await api.createAdminLead(leadForm)
      setSuccess('Customer lead added successfully!')
      setShowLeadModal(false)
      setLeadForm({ restaurantId: '', name: '', email: '', phone: '', source: 'META Ads', status: 'NEW' })
      loadData()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleUpdateLeadStatus(id: string, status: string) {
    try {
      await api.updateAdminLead(id, { status })
      setSuccess('Lead status updated successfully')
      loadData()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  function handleExportLeads() {
    const csvContent = [
      ['Lead ID', 'Restaurant Name', 'Lead Name', 'Email', 'Phone', 'Source', 'Status', 'Date'],
      ...leads.map(l => [
        l.id,
        l.restaurant?.name || '',
        l.name,
        l.email,
        l.phone,
        l.source,
        l.status,
        new Date(l.createdAt).toLocaleString('en-IN')
      ])
    ]
    const csv = csvContent.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `leads_export_${Date.now()}.csv`
    link.click()
  }

  if (loading) return <div className="loading-spinner" />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>📣 Platform Marketing</h1>
          <p>Manage ads campaigns, graphic design proofs, lead generation, and platforms revenue</p>
        </div>
        <div className="flex gap-2">
          {tab === 'ads' && <button className="btn btn-gold" onClick={() => setShowAdModal(true)}>+ Request Ad</button>}
          {tab === 'posters' && <button className="btn btn-gold" onClick={() => setShowPosterModal(true)}>+ New Poster Design</button>}
          {tab === 'leads' && (
            <>
              <button className="btn btn-secondary" onClick={handleExportLeads}>📥 Export Leads</button>
              <button className="btn btn-gold" onClick={() => setShowLeadModal(true)}>+ Add Lead</button>
            </>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}
      {success && <div className="alert alert-success">✅ {success}</div>}

      {/* WhatsApp Business API Warning */}
      {stats && !stats.whatsappConfigured && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div>
            <strong>WhatsApp Business API variables are missing on Railway!</strong>
            <div style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Define <code>WHATSAPP_ACCESS_TOKEN</code> and <code>WHATSAPP_PHONE_ID</code> in the backend environment variables to enable delivery.
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2" style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
        {(['overview', 'ads', 'posters', 'leads'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`btn btn-sm ${tab === t ? 'btn-gold' : 'btn-secondary'}`}
            style={{ textTransform: 'capitalize' }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <div>
          {/* Stats Cards */}
          <div className="grid-4" style={{ marginBottom: '2rem' }}>
            <div className="stat-card">
              <div className="stat-value">₹{Number(stats.totalRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <div className="stat-label">Marketing Revenue</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--gold-primary)' }}>{stats.counts.ads}</div>
              <div className="stat-label">Total Ad Campaigns</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--accent-green)' }}>{stats.counts.posters}</div>
              <div className="stat-label">Delivered Designs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>{stats.counts.leads}</div>
              <div className="stat-label">Total Leads Tracked</div>
            </div>
          </div>

          <div className="grid-2">
            {/* Revenue Breakdown */}
            <div className="card">
              <h2>💰 Marketing Revenue Breakdown</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <span className="text-muted">Ad Management Fees (10%)</span>
                  <span style={{ fontWeight: 600 }}>₹{Number(stats.adsRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <span className="text-muted">Poster Design proof fees (₹1,500/ea)</span>
                  <span style={{ fontWeight: 600 }}>₹{Number(stats.postersRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem' }}>
                  <span className="text-muted">WhatsApp Campaigns Billing (₹49/camp)</span>
                  <span style={{ fontWeight: 600 }}>₹{Number(stats.campaignsRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Social Media Status */}
            <div className="card">
              <h2>📱 Platform Channels Integration</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                <div className="flex justify-between items-center" style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <span>Meta Graph Ads Manager</span>
                  <span className="badge badge-active">Active</span>
                </div>
                <div className="flex justify-between items-center" style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <span>Google AdWords Engine</span>
                  <span className="badge badge-active">Active</span>
                </div>
                <div className="flex justify-between items-center" style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <span>WhatsApp API Server</span>
                  <span className={`badge ${stats.whatsappConfigured ? 'badge-active' : 'badge-inactive'}`}>
                    {stats.whatsappConfigured ? 'Configured' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'ads' && (
        <div className="card">
          <h2>📊 Ads Campaign Requests</h2>
          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>Platform</th>
                  <th>Budget</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ads.length === 0 ? (
                  <tr><td colSpan={6} className="text-center">No ad campaign requests yet.</td></tr>
                ) : ads.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.restaurant?.name}</td>
                    <td>
                      <span className={`badge badge-${a.platform.toLowerCase()}`} style={{ background: a.platform === 'META' ? '#1877F2' : '#EA4335', color: '#fff' }}>
                        {a.platform}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>₹{Number(a.budget).toLocaleString('en-IN')}</td>
                    <td>
                      <span className={`badge badge-${a.status.toLowerCase()}`}>{a.status}</span>
                    </td>
                    <td>{a.notes || '—'}</td>
                    <td>
                      <div className="flex gap-2">
                        {a.status === 'PENDING' && (
                          <button className="btn btn-sm btn-success" onClick={() => handleUpdateAdStatus(a.id, 'APPROVED')}>Approve</button>
                        )}
                        {a.status === 'APPROVED' && (
                          <button className="btn btn-sm btn-gold" onClick={() => handleUpdateAdStatus(a.id, 'COMPLETED')}>Mark Completed</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'posters' && (
        <div className="card">
          <h2>🎨 Poster Graphic Requests</h2>
          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>Concept Details</th>
                  <th>Layout Dimension</th>
                  <th>Status</th>
                  <th>Graphic Delivery</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {posters.length === 0 ? (
                  <tr><td colSpan={6} className="text-center">No poster design requests yet.</td></tr>
                ) : posters.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.restaurant?.name}</td>
                    <td>{p.concept}</td>
                    <td>
                      <code style={{ background: 'var(--bg-secondary)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>{p.size}</code>
                    </td>
                    <td>
                      <span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span>
                    </td>
                    <td>
                      {p.imageUrl ? (
                        <a href={p.imageUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-primary)', textDecoration: 'underline', fontSize: '0.85rem' }}>
                          View Delivery 🔗
                        </a>
                      ) : 'Pending Upload'}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {p.status === 'PENDING' && (
                          <button className="btn btn-sm btn-secondary" onClick={() => handleUpdatePoster(p.id, 'IN_PROGRESS')}>Start Designing</button>
                        )}
                        {p.status === 'IN_PROGRESS' && (
                          <button className="btn btn-sm btn-gold" onClick={() => {
                            const url = prompt('Enter the delivered Graphic URL link:')
                            if (url) handleUpdatePoster(p.id, 'DELIVERED', url)
                          }}>Deliver Image</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="card">
          <h2>👥 Customer Leads Generated</h2>
          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>Customer Name</th>
                  <th>Contact Info</th>
                  <th>Source Platform</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr><td colSpan={6} className="text-center">No customer leads tracked yet.</td></tr>
                ) : leads.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 600 }}>{l.restaurant?.name}</td>
                    <td>{l.name}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      <div>📱 {l.phone}</div>
                      <div>✉️ {l.email}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>{l.source}</span>
                    </td>
                    <td>
                      <span className={`badge badge-${l.status.toLowerCase()}`}>{l.status}</span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {l.status === 'NEW' && (
                          <button className="btn btn-sm btn-secondary" onClick={() => handleUpdateLeadStatus(l.id, 'CONTACTED')}>Contacted</button>
                        )}
                        {l.status === 'CONTACTED' && (
                          <button className="btn btn-sm btn-success" onClick={() => handleUpdateLeadStatus(l.id, 'CONVERTED')}>Converted</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE AD MODAL */}
      {showAdModal && (
        <div className="modal-overlay" onClick={() => setShowAdModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📈 New Ad Campaign Request</div>
            <form onSubmit={handleCreateAd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Restaurant</label>
                <select
                  value={adForm.restaurantId}
                  onChange={e => setAdForm(a => ({ ...a, restaurantId: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  required
                >
                  <option value="">Select Restaurant...</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Platform</label>
                <select
                  value={adForm.platform}
                  onChange={e => setAdForm(a => ({ ...a, platform: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="META">Meta Ads (Facebook & Instagram)</option>
                  <option value="GOOGLE">Google PPC AdWords</option>
                </select>
              </div>
              <div className="form-group">
                <label>Campaign Budget (INR)</label>
                <input
                  type="number"
                  value={adForm.budget}
                  onChange={e => setAdForm(a => ({ ...a, budget: Number(e.target.value) }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Ad Notes & Copy Criteria</label>
                <textarea
                  value={adForm.notes}
                  onChange={e => setAdForm(a => ({ ...a, notes: e.target.value }))}
                  placeholder="Targeting, menu keywords, promotion details..."
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-gold">Submit Campaign</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE POSTER MODAL */}
      {showPosterModal && (
        <div className="modal-overlay" onClick={() => setShowPosterModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🎨 Request Poster Design Proof</div>
            <form onSubmit={handleCreatePoster} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Restaurant</label>
                <select
                  value={posterForm.restaurantId}
                  onChange={e => setPosterForm(p => ({ ...p, restaurantId: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  required
                >
                  <option value="">Select Restaurant...</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Design Layout Size</label>
                <select
                  value={posterForm.size}
                  onChange={e => setPosterForm(p => ({ ...p, size: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="SQUARE">1:1 Square (Feed Post)</option>
                  <option value="BANNER">16:9 Landscape (Website/Email Banner)</option>
                  <option value="STORY">9:16 Vertical Story (IG/WA Status)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Design Concept & Copy instructions</label>
                <textarea
                  value={posterForm.concept}
                  onChange={e => setPosterForm(p => ({ ...p, concept: e.target.value }))}
                  placeholder="e.g. Diwali celebration 15% discount menu graphic with golden accents..."
                  rows={4}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPosterModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-gold">Request Graphic</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE LEAD MODAL */}
      {showLeadModal && (
        <div className="modal-overlay" onClick={() => setShowLeadModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">👥 Add Customer Lead</div>
            <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Restaurant Tenant</label>
                <select
                  value={leadForm.restaurantId}
                  onChange={e => setLeadForm(l => ({ ...l, restaurantId: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  required
                >
                  <option value="">Select Restaurant...</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Lead Full Name</label>
                <input
                  value={leadForm.name}
                  onChange={e => setLeadForm(l => ({ ...l, name: e.target.value }))}
                  placeholder="Rahul Kumar"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={leadForm.email}
                  onChange={e => setLeadForm(l => ({ ...l, email: e.target.value }))}
                  placeholder="rahul@gmail.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  value={leadForm.phone}
                  onChange={e => setLeadForm(l => ({ ...l, phone: e.target.value }))}
                  placeholder="+91 9876543210"
                  required
                />
              </div>
              <div className="form-group">
                <label>Lead Generation Source</label>
                <select
                  value={leadForm.source}
                  onChange={e => setLeadForm(l => ({ ...l, source: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="META Ads">Meta Instagram/FB Ads Form</option>
                  <option value="GOOGLE Ads">Google AdWords Search Form</option>
                  <option value="QR Menu">QR Digital Menu In-App Lead</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowLeadModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-gold">Add Lead Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
