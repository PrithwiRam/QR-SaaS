'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { Restaurant } from '@qr-saas/types'

export default function AdminPage() {
  const [restaurants, setRestaurants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', adminEmail: '', adminPassword: '', address: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadRestaurants()
  }, [])

  async function loadRestaurants() {
    try {
      const data = await api.getRestaurants()
      setRestaurants(data.restaurants || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api.createRestaurant(form)
      setShowModal(false)
      setForm({ name: '', slug: '', adminEmail: '', adminPassword: '', address: '', phone: '' })
      await loadRestaurants()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(r: any) {
    await api.updateRestaurant(r.id, { isActive: !r.isActive })
    await loadRestaurants()
  }

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  const total = restaurants.length
  const active = restaurants.filter(r => r.isActive).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Restaurant Dashboard</h1>
          <p>Manage all tenant restaurants from one place</p>
        </div>
        <button id="create-restaurant-btn" className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Restaurant
        </button>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total Restaurants</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent-green)' }}>{active}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent-red)' }}>{total - active}</div>
          <div className="stat-label">Inactive</div>
        </div>
        <div className="stat-card">
          <div className="stat-value gradient-text">{restaurants.reduce((s, r) => s + (r._count?.orders || 0), 0)}</div>
          <div className="stat-label">Total Orders</div>
        </div>
      </div>

      {/* Error */}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Table */}
      {loading ? (
        <div className="loading-spinner" />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Users</th>
                <th>Orders</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-state-icon">🏪</div>
                    <div className="empty-state-title">No restaurants yet</div>
                    <div className="empty-state-desc">Click "New Restaurant" to add your first tenant</div>
                  </div>
                </td></tr>
              ) : restaurants.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    {r.address && <div className="text-xs text-muted">{r.address}</div>}
                  </td>
                  <td>
                    <code style={{ background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                      {r.slug}
                    </code>
                  </td>
                  <td>
                    <span className={`badge badge-${r.isActive ? 'active' : 'inactive'}`}>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{r._count?.users ?? '-'}</td>
                  <td>{r._count?.orders ?? '-'}</td>
                  <td>
                    <div className="flex gap-2">
                      <a href={`/vendor/${r.slug}`} className="btn btn-secondary btn-sm">Portal →</a>
                      <button
                        className={`btn btn-sm ${r.isActive ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggle(r)}
                      >
                        {r.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Create New Restaurant</div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="grid-2">
                <div className="form-group">
                  <label>Restaurant Name</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: autoSlug(e.target.value) }))}
                    placeholder="Pizza Palace"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>URL Slug</label>
                  <input
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                    placeholder="pizza-palace"
                    required
                    pattern="[a-z0-9-]+"
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Admin Email</label>
                  <input
                    type="email"
                    value={form.adminEmail}
                    onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                    placeholder="admin@pizzapalace.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Admin Password</label>
                  <input
                    type="password"
                    value={form.adminPassword}
                    onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                    placeholder="Min 6 characters"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Address (optional)</label>
                <input
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="123 Main St, City"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Restaurant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
