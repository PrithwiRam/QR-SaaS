'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

export default function VendorsPage() {
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Selected vendor for modals
  const [selectedVendor, setSelectedVendor] = useState<any>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [vendorDetail, setVendorDetail] = useState<any>(null)

  // Reset password form
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadVendors() }, [])

  async function loadVendors() {
    try {
      const data = await api.getVendors()
      setVendors(data || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function openProfile(vendor: any) {
    setSelectedVendor(vendor)
    setVendorDetail(null)
    setShowProfileModal(true)
    try {
      const data = await api.getVendor(vendor.id)
      setVendorDetail(data)
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleToggleActive(vendor: any) {
    try {
      await api.updateVendor(vendor.id, { isActive: !vendor.isActive })
      setSuccess(`Vendor ${vendor.isActive ? 'deactivated' : 'reactivated'} successfully`)
      setTimeout(() => setSuccess(''), 4000)
      await loadVendors()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setResetting(true)
    setError('')
    try {
      await api.resetVendorPassword(selectedVendor.id, newPassword)
      setSuccess(`Password reset successfully for ${selectedVendor.email}`)
      setTimeout(() => setSuccess(''), 4000)
      setShowResetModal(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setResetting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      await api.deleteVendor(selectedVendor.id)
      setSuccess(`Vendor "${selectedVendor.email}" permanently deleted`)
      setTimeout(() => setSuccess(''), 5000)
      setShowDeleteModal(false)
      setSelectedVendor(null)
      await loadVendors()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const activeCount = vendors.filter(v => v.isActive).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Vendor Management</h1>
          <p>Manage all restaurant vendors — view, reset passwords, activate or permanently delete</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-value">{vendors.length}</div>
          <div className="stat-label">Total Vendors</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent-green)' }}>{activeCount}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent-red)' }}>{vendors.length - activeCount}</div>
          <div className="stat-label">Deactivated</div>
        </div>
        <div className="stat-card">
          <div className="stat-value gradient-text">{vendors.filter(v => v.restaurant?.isActive).length}</div>
          <div className="stat-label">Active Restaurants</div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>✅ {success}</div>}

      {loading ? (
        <div className="loading-spinner" />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Vendor Email</th>
                <th>Restaurant</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-state-icon">👤</div>
                    <div className="empty-state-title">No vendors yet</div>
                    <div className="empty-state-desc">Create a restaurant to automatically generate a vendor account</div>
                  </div>
                </td></tr>
              ) : vendors.map(v => (
                <tr key={v.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{v.email}</div>
                  </td>
                  <td>
                    {v.restaurant ? (
                      <div>
                        <div style={{ fontWeight: 600 }}>{v.restaurant.name}</div>
                        <code style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', background: 'var(--bg-secondary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                          {v.restaurant.slug}
                        </code>
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '0.85rem' }}>No restaurant</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${v.isActive ? 'active' : 'inactive'}`}>
                      {v.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {v.lastLoginAt ? new Date(v.lastLoginAt).toLocaleDateString('en-IN') : 'Never'}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {new Date(v.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openProfile(v)}>
                        👁 Profile
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setSelectedVendor(v); setShowResetModal(true); setError('') }}
                      >
                        🔑 Reset PW
                      </button>
                      <button
                        className={`btn btn-sm ${v.isActive ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggleActive(v)}
                      >
                        {v.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}
                        onClick={() => { setSelectedVendor(v); setShowDeleteModal(true); setError('') }}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && selectedVendor && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowProfileModal(false)}>
          <div className="modal" style={{ maxWidth: '560px' }}>
            <div className="modal-title">👤 Vendor Profile</div>
            {!vendorDetail ? (
              <div className="loading-spinner" />
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="stat-card" style={{ padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Email</div>
                    <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{vendorDetail.email}</div>
                  </div>
                  <div className="stat-card" style={{ padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Status</div>
                    <span className={`badge badge-${vendorDetail.isActive ? 'active' : 'inactive'}`}>
                      {vendorDetail.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </div>
                  <div className="stat-card" style={{ padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Restaurant</div>
                    <div style={{ fontWeight: 600 }}>{vendorDetail.restaurant?.name || '—'}</div>
                    {vendorDetail.restaurant && (
                      <a href={`/vendor/${vendorDetail.restaurant.slug}`} className="text-xs" style={{ color: 'var(--gold-primary)' }}>
                        /{vendorDetail.restaurant.slug} →
                      </a>
                    )}
                  </div>
                  <div className="stat-card" style={{ padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Member Since</div>
                    <div style={{ fontWeight: 600 }}>{new Date(vendorDetail.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>
                </div>

                {vendorDetail.restaurant && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {[
                      { label: 'Total Orders', val: vendorDetail.restaurant._count?.orders ?? 0, color: 'var(--accent-primary)' },
                      { label: 'Customers', val: vendorDetail.restaurant._count?.customers ?? 0, color: 'var(--accent-green)' },
                      { label: 'Menu Items', val: vendorDetail.restaurant._count?.menuItems ?? 0, color: 'var(--accent-blue)' },
                      { label: 'Tables', val: vendorDetail.restaurant._count?.tables ?? 0, color: 'var(--accent-amber)' },
                    ].map(s => (
                      <div key={s.label} className="stat-card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <div className="stat-value" style={{ fontSize: '1.5rem', color: s.color }}>{s.val}</div>
                        <div className="stat-label" style={{ fontSize: '0.7rem' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {vendorDetail.recentActivity?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Recent Orders</h4>
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                      {vendorDetail.recentActivity.map((o: any) => (
                        <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                          <span>Table {o.tableNumber} · <span className={`badge badge-${o.status.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>{o.status}</span></span>
                          <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>₹{Number(o.totalAmount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowProfileModal(false)}>Close</button>
              {vendorDetail?.restaurant && (
                <a href={`/vendor/${vendorDetail.restaurant.slug}`} className="btn btn-gold">
                  Open Vendor Portal →
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && selectedVendor && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowResetModal(false)}>
          <div className="modal">
            <div className="modal-title">🔑 Reset Password</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Reset password for <strong>{selectedVendor.email}</strong>
            </p>
            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>New Password (min 8 characters)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowResetModal(false); setError(''); setNewPassword(''); setConfirmPassword('') }}>
                Cancel
              </button>
              <button className="btn btn-gold" onClick={handleResetPassword} disabled={resetting}>
                {resetting ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedVendor && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDeleteModal(false)}>
          <div className="modal">
            <div className="modal-title" style={{ color: '#EF4444' }}>⚠️ Permanently Delete Vendor</div>
            <div className="alert alert-error" style={{ margin: '1rem 0' }}>
              <strong>This action cannot be undone.</strong>
              <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                Are you sure you want to permanently delete <strong>{selectedVendor.email}</strong>?
                {selectedVendor.restaurant && (
                  <> This will also delete the restaurant <strong>"{selectedVendor.restaurant?.name}"</strong> and all its menus, tables, and order history.</>
                )}
              </p>
            </div>
            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowDeleteModal(false); setError('') }}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
                style={{ background: '#EF4444', color: '#fff', border: 'none' }}
              >
                {deleting ? 'Deleting…' : '🗑 Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
