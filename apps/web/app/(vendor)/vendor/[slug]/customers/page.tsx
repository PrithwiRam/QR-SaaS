'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useVendorCtx } from '@/app/(vendor)/vendor-context'

export default function CustomersPage() {
  const params = useParams()
  const slug = params?.slug as string
  const ctx = useVendorCtx()
  const restaurantId = ctx?.restaurantId ?? null

  const [activeTab, setActiveTab] = useState<'crm' | 'offers'>('crm')
  const [customers, setCustomers] = useState<any[]>([])
  const [offers, setOffers] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // New offer form state
  const [showCreateOfferModal, setShowCreateOfferModal] = useState(false)
  const [offerTitle, setOfferTitle] = useState('')
  const [offerDesc, setOfferDesc] = useState('')
  const [offerCode, setOfferCode] = useState('')
  const [offerDiscountType, setOfferDiscountType] = useState<'PERCENTAGE' | 'FLAT'>('PERCENTAGE')
  const [offerDiscountValue, setOfferDiscountValue] = useState(10)
  const [offerPointsRequired, setOfferPointsRequired] = useState(0)
  const [offerIsActive, setOfferIsActive] = useState(true)
  const [creatingOffer, setCreatingOffer] = useState(false)

  // Adjust points modal state
  const [selectedCustomerForPoints, setSelectedCustomerForPoints] = useState<any | null>(null)
  const [adjustPointsValue, setAdjustPointsValue] = useState(10)
  const [adjustPointsMode, setAdjustPointsMode] = useState<'ADD' | 'DEDUCT'>('ADD')
  const [adjustingPoints, setAdjustingPoints] = useState(false)

  useEffect(() => {
    if (restaurantId) {
      loadData(restaurantId)
    } else {
      setLoading(false)
    }
  }, [restaurantId])

  function showMsg(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 4000)
  }

  async function loadData(rid: string) {
    setLoading(true)
    setError('')
    try {
      const custData = await api.getVendorCustomers(rid, searchQuery)
      setCustomers(Array.isArray(custData) ? custData : [])

      const offerData = await api.getVendorOffers(rid)
      setOffers(Array.isArray(offerData) ? offerData : [])
    } catch (e: any) {
      setError(e.message || 'Failed to load customer/loyalty data.')
    } finally {
      setLoading(false)
    }
  }

  // Trigger search on query change
  useEffect(() => {
    if (restaurantId) {
      const delayDebounce = setTimeout(() => {
        api.getVendorCustomers(restaurantId, searchQuery)
          .then(data => setCustomers(Array.isArray(data) ? data : []))
          .catch(() => {})
      }, 300)
      return () => clearTimeout(delayDebounce)
    }
  }, [searchQuery, restaurantId])

  async function handleCreateOffer(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurantId) return
    if (!offerTitle.trim() || !offerDesc.trim() || !offerCode.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    setCreatingOffer(true)
    setError('')
    try {
      await api.createVendorOffer(restaurantId, {
        title: offerTitle.trim(),
        description: offerDesc.trim(),
        code: offerCode.trim(),
        discountType: offerDiscountType,
        discountValue: Number(offerDiscountValue),
        pointsRequired: Number(offerPointsRequired),
        isActive: offerIsActive
      })
      showMsg(`Offer "${offerCode}" created successfully!`)
      setShowCreateOfferModal(false)
      // Reset form
      setOfferTitle('')
      setOfferDesc('')
      setOfferCode('')
      setOfferDiscountValue(10)
      setOfferPointsRequired(0)
      setOfferIsActive(true)

      // Reload offers
      const freshOffers = await api.getVendorOffers(restaurantId)
      setOffers(Array.isArray(freshOffers) ? freshOffers : [])
    } catch (e: any) {
      setError(e.message || 'Failed to create offer')
    } finally {
      setCreatingOffer(false)
    }
  }

  async function handleToggleOfferStatus(offer: any) {
    if (!restaurantId) return
    try {
      const updated = await api.updateVendorOffer(restaurantId, offer.id, {
        isActive: !offer.isActive
      })
      setOffers(prev => prev.map(o => o.id === offer.id ? updated : o))
      showMsg(`Offer ${offer.code} ${updated.isActive ? 'activated' : 'deactivated'}`)
    } catch (e: any) {
      setError(e.message || 'Failed to toggle offer status')
    }
  }

  async function handleDeleteOffer(id: string, code: string) {
    if (!restaurantId) return
    if (!confirm(`Are you sure you want to delete the offer "${code}"?`)) return
    try {
      await api.deleteVendorOffer(restaurantId, id)
      setOffers(prev => prev.filter(o => o.id !== id))
      showMsg(`Offer "${code}" deleted successfully.`)
    } catch (e: any) {
      setError(e.message || 'Failed to delete offer')
    }
  }

  async function handleAdjustPoints(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurantId || !selectedCustomerForPoints) return
    setAdjustingPoints(true)
    setError('')
    try {
      const pointsDiff = adjustPointsMode === 'ADD' ? Number(adjustPointsValue) : -Number(adjustPointsValue)
      // Custom endpoint isn't needed, we can just hit a route or we can support a fast adjustment.
      // Wait, let's look at if we added an update customer endpoint in route customers.ts.
      // Ah! In customers.ts we only have a GET customer route. Let's see: how can we adjust points?
      // Wait! We can update points by using a fast PATCH endpoint on our customer routes.
      // Let's create a PATCH /restaurants/:restaurantId/customers/:customerId/points endpoint in routes/customers.ts if needed!
      // Yes! That's super clean. Let's make sure we support it.
      // Let's verify: did we implement PATCH on customer points? Not yet. Let's call the API (we'll implement it shortly in routes/customers.ts)
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1'}/restaurants/${restaurantId}/customers/${selectedCustomerForPoints.id}/points`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ points: pointsDiff })
      })
      
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed to adjust points')
      }

      showMsg(`Points adjusted for ${selectedCustomerForPoints.name}`)
      setSelectedCustomerForPoints(null)
      loadData(restaurantId)
    } catch (e: any) {
      setError(e.message || 'Failed to adjust customer points')
    } finally {
      setAdjustingPoints(false)
    }
  }

  // Aggregate stats
  const totalCustomersCount = customers.length
  const totalVisitsCount = customers.reduce((sum, c) => sum + c.visitCount, 0)
  const averageVisits = totalCustomersCount > 0 ? (totalVisitsCount / totalCustomersCount).toFixed(1) : 0
  const totalSpendSum = customers.reduce((sum, c) => sum + c.totalSpend, 0)
  const totalPointsDistributed = customers.reduce((sum, c) => sum + c.loyaltyPoints, 0)

  if (loading) return (
    <div>
      <div className="page-header"><h1>👥 Customers & Loyalty</h1></div>
      <div className="loading-spinner" />
    </div>
  )

  return (
    <div>
      {/* Dynamic Style Block */}
      <style jsx>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.25rem;
          margin-bottom: 2rem;
        }
        .stat-card {
          background: #18181B;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .stat-value {
          font-size: 1.75rem;
          font-weight: 800;
          color: #FFF;
          font-family: 'Outfit', sans-serif;
        }
        .tabs-header {
          display: flex;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          margin-bottom: 1.5rem;
          gap: 1.5rem;
        }
        .tab-btn {
          background: none;
          border: none;
          color: #A1A1AA;
          padding: 0.75rem 0.25rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          position: relative;
          transition: color 0.2s;
        }
        .tab-btn.active {
          color: var(--accent-primary);
        }
        .tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--accent-primary);
        }
        .offer-card {
          background: #18181B;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
          transition: transform 0.2s, border-color 0.2s;
        }
        .offer-card:hover {
          transform: translateY(-2px);
          border-color: rgba(212,175,55,0.25);
        }
        .offer-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.25rem;
        }
      `}</style>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1>👥 Customers & Loyalty</h1>
          <p>Analyze your customer loyalty database, reward repeat visits, and manage promotion programs.</p>
        </div>
        {activeTab === 'offers' && (
          <button className="btn btn-primary" onClick={() => setShowCreateOfferModal(true)}>
            + Create New Offer
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>⚠️ {error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>✓ {success}</div>}

      {/* Stats Dashboard */}
      <div className="stats-grid">
        <div className="stat-card">
          <span style={{ fontSize: '0.85rem', color: '#A1A1AA', fontWeight: 600 }}>Total Registered Customers</span>
          <span className="stat-value">👥 {totalCustomersCount}</span>
        </div>
        <div className="stat-card">
          <span style={{ fontSize: '0.85rem', color: '#A1A1AA', fontWeight: 600 }}>Total Customer Visits</span>
          <span className="stat-value">🔄 {totalVisitsCount}</span>
        </div>
        <div className="stat-card">
          <span style={{ fontSize: '0.85rem', color: '#A1A1AA', fontWeight: 600 }}>Average Repeat Frequency</span>
          <span className="stat-value">📈 {averageVisits} visits</span>
        </div>
        <div className="stat-card">
          <span style={{ fontSize: '0.85rem', color: '#A1A1AA', fontWeight: 600 }}>Loyalty Points Distributed</span>
          <span className="stat-value" style={{ color: '#D4AF37' }}>⭐ {totalPointsDistributed} pts</span>
        </div>
        <div className="stat-card">
          <span style={{ fontSize: '0.85rem', color: '#A1A1AA', fontWeight: 600 }}>Total Revenue from Loyalty Members</span>
          <span className="stat-value" style={{ color: '#10B981' }}>₹{totalSpendSum.toFixed(2)}</span>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="tabs-header">
        <button className={`tab-btn ${activeTab === 'crm' ? 'active' : ''}`} onClick={() => setActiveTab('crm')}>
          👤 CRM Customer Directory
        </button>
        <button className={`tab-btn ${activeTab === 'offers' ? 'active' : ''}`} onClick={() => setActiveTab('offers')}>
          🎁 Manage Promo & Rewards Offers
        </button>
      </div>

      {/* Tab 1: CRM Customer Directory */}
      {activeTab === 'crm' && (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
            <input
              type="text"
              placeholder="🔍 Search customers by name or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '0.75rem 1rem', background: '#18181B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#FFF' }}
            />
            <button className="btn btn-secondary" onClick={() => loadData(restaurantId!)}>
              ↺ Refresh List
            </button>
          </div>

          {customers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-title">No customers found</div>
              <div className="empty-state-desc">
                {searchQuery ? 'Try adjusting your search query.' : 'Customers who scan and fill details will appear here automatically.'}
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Phone ID</th>
                    <th>Visits</th>
                    <th>Loyalty Points</th>
                    <th>Orders Completed</th>
                    <th>Total Spend</th>
                    <th>Date Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700, color: '#FFF' }}>{c.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.phone}</td>
                      <td>
                        <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.9rem' }}>
                          🔄 {c.visitCount}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#D4AF37', fontFamily: 'Outfit, sans-serif' }}>
                          ⭐ {c.loyaltyPoints}
                        </strong>
                      </td>
                      <td>{c.orderCount} orders</td>
                      <td style={{ color: '#10B981', fontWeight: 600 }}>₹{c.totalSpend.toFixed(2)}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCustomerForPoints(c)}>
                          Adjust Points
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Manage Promo & Rewards Offers */}
      {activeTab === 'offers' && (
        <div>
          {offers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🎁</div>
              <div className="empty-state-title">No offers created yet</div>
              <div className="empty-state-desc">
                Click &quot;+ Create New Offer&quot; to configure loyalty rewards or general promo codes.
              </div>
            </div>
          ) : (
            <div className="offer-grid">
              {offers.map(offer => (
                <div key={offer.id} className="offer-card" style={{ opacity: offer.isActive ? 1 : 0.6 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        background: 'linear-gradient(135deg, #1e1b4b, #311042)',
                        color: 'var(--accent-primary)',
                        borderRadius: '6px',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        Code: {offer.code}
                      </span>
                      <span className={`badge badge-${offer.isActive ? 'active' : 'inactive'}`}>
                        {offer.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0.5rem 0 0.25rem 0', color: '#FFF' }}>
                      {offer.title}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0', lineHeight: 1.4 }}>
                      {offer.description}
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#A1A1AA' }}>Value:</span>
                      <strong style={{ color: 'var(--accent-primary)' }}>
                        {offer.discountType === 'PERCENTAGE' ? `${offer.discountValue}% Off` : `₹${Number(offer.discountValue).toFixed(2)} Off`}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '1rem' }}>
                      <span style={{ color: '#A1A1AA' }}>Points Cost:</span>
                      <strong style={{ color: offer.pointsRequired > 0 ? '#D4AF37' : '#9CA3AF' }}>
                        {offer.pointsRequired > 0 ? `⭐ ${offer.pointsRequired} pts` : 'Unlocked for everyone'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleToggleOfferStatus(offer)} style={{ flex: 1 }}>
                        {offer.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteOffer(offer.id, offer.code)} style={{ padding: '0.4rem 0.6rem' }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── CREATE OFFER MODAL overlay ─────────────────────────── */}
      {showCreateOfferModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreateOfferModal(false)}>
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-title">🎁 Create Customer Loyalty Offer</div>

            <form onSubmit={handleCreateOffer}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Offer Title <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Free Dessert on orders above ₹500"
                  value={offerTitle}
                  onChange={e => setOfferTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Description <span style={{ color: '#EF4444' }}>*</span></label>
                <textarea
                  placeholder="Provide details of the promotion..."
                  value={offerDesc}
                  onChange={e => setOfferDesc(e.target.value)}
                  rows={2}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label>Unique Promo Code <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. LOYALTY20"
                    value={offerCode}
                    onChange={e => setOfferCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Discount Type</label>
                  <select
                    value={offerDiscountType}
                    onChange={e => setOfferDiscountType(e.target.value as 'PERCENTAGE' | 'FLAT')}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Flat Amount (₹)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label>Discount Value <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    type="number"
                    min={1}
                    value={offerDiscountValue}
                    onChange={e => setOfferDiscountValue(Math.max(1, parseFloat(e.target.value) || 0))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Points Required (0 = Regular Coupon)</label>
                  <input
                    type="number"
                    min={0}
                    value={offerPointsRequired}
                    onChange={e => setOfferPointsRequired(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateOfferModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creatingOffer}>
                  {creatingOffer ? '⏳ Creating...' : 'Create Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ADJUST POINTS MODAL overlay ────────────────────────── */}
      {selectedCustomerForPoints && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedCustomerForPoints(null)}>
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-title">⭐ Adjust Customer Loyalty Points</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Adjust points balance for customer: <strong>{selectedCustomerForPoints.name}</strong> ({selectedCustomerForPoints.phone}).
              Current balance: <strong style={{ color: '#D4AF37' }}>⭐ {selectedCustomerForPoints.loyaltyPoints} pts</strong>
            </p>

            <form onSubmit={handleAdjustPoints}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Action</label>
                <select
                  value={adjustPointsMode}
                  onChange={e => setAdjustPointsMode(e.target.value as 'ADD' | 'DEDUCT')}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  <option value="ADD">Add / Award Points (+)</option>
                  <option value="DEDUCT">Deduct Points (-)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Points Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={adjustPointsValue}
                  onChange={e => setAdjustPointsValue(Math.max(1, parseInt(e.target.value) || 1))}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedCustomerForPoints(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={adjustingPoints}>
                  {adjustingPoints ? '⏳ Adjusting...' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
