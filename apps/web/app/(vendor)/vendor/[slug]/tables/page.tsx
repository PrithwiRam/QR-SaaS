'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useVendorCtx } from '@/app/(vendor)/vendor-context'

export default function TablesPage() {
  const params = useParams()
  const slug = params?.slug as string
  const ctx = useVendorCtx()
  const restaurantId = ctx?.restaurantId ?? null

  const [tables, setTables] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [creating, setCreating] = useState(false)
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [confirmRegen, setConfirmRegen] = useState<any | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [tableNumber, setTableNumber] = useState('')
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single')
  const [bulkCount, setBulkCount] = useState(1)

  useEffect(() => {
    if (restaurantId) {
      loadTables(restaurantId)
    } else {
      setLoading(false)
    }
  }, [restaurantId])

  function showMsg(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 4000)
  }

  async function loadTables(rid: string) {
    setLoading(true)
    setError('')
    try {
      const data = await api.getTables(rid)
      setTables(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e.message || 'Failed to load tables. Make sure the API server is running.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateSingle(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurantId) { setError('Restaurant not resolved — please reload the page'); return }
    const num = parseInt(tableNumber)
    if (!num || num < 1 || num > 9999) { setError('Table number must be between 1 and 9999'); return }
    setCreating(true)
    setError('')
    try {
      await api.createSingleTable(restaurantId, num)
      showMsg(`Table ${num} created with QR code`)
      setTableNumber('')
      await loadTables(restaurantId)
    } catch (e: any) {
      setError(e.message || 'Failed to create table')
    } finally {
      setCreating(false)
    }
  }

  async function handleCreateBulk(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurantId) { setError('Restaurant not resolved — please reload the page'); return }
    const count = Number(bulkCount)
    if (!count || count < 1 || count > 50) { setError('Please enter a count between 1 and 50'); return }
    setCreating(true)
    setError('')
    try {
      const newTables = await api.createTables(restaurantId, count)
      showMsg(`${Array.isArray(newTables) ? newTables.length : count} table(s) created with QR codes`)
      await loadTables(restaurantId)
    } catch (e: any) {
      setError(e.message || 'Failed to create tables')
    } finally {
      setCreating(false)
    }
  }

  async function handleRegenerate() {
    if (!confirmRegen || !restaurantId) return
    setRegenerating(confirmRegen.id)
    setError('')
    try {
      await api.regenerateQr(restaurantId, confirmRegen.id)
      showMsg(`New QR code generated for Table ${confirmRegen.tableNumber}`)
      await loadTables(restaurantId)
      setConfirmRegen(null)
    } catch (e: any) {
      setError(e.message || 'Failed to regenerate QR code')
    } finally {
      setRegenerating(null)
    }
  }

  async function handleDelete() {
    if (!confirmDelete || !restaurantId) return
    setDeleting(confirmDelete.id)
    setError('')
    try {
      await api.deleteTable(restaurantId, confirmDelete.id)
      showMsg(`Table ${confirmDelete.tableNumber} deleted. You can now reuse this number.`)
      setConfirmDelete(null)
      await loadTables(restaurantId)
    } catch (e: any) {
      setError(e.message || 'Failed to delete table')
    } finally {
      setDeleting(null)
    }
  }

  // Figure out which numbers are already taken, to show hints
  const usedNumbers = new Set(tables.map(t => t.tableNumber))

  if (loading) return (
    <div>
      <div className="page-header"><h1>Tables &amp; QR Codes</h1></div>
      <div className="loading-spinner" />
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Tables &amp; QR Codes</h1>
          <p>{tables.length} table{tables.length !== 1 ? 's' : ''} total</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          ✓ {success}
        </div>
      )}

      {/* Add Table Panel */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>➕ Add Table</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Choose a specific number or add multiple tables in bulk.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2" style={{ marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${addMode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAddMode('single')}
          >
            Single Table
          </button>
          <button
            type="button"
            className={`btn btn-sm ${addMode === 'bulk' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAddMode('bulk')}
          >
            Bulk Add
          </button>
        </div>

        {addMode === 'single' ? (
          <form onSubmit={handleCreateSingle} className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Table Number
              </label>
              <input
                type="number"
                min={1}
                max={9999}
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                placeholder="e.g. 1, 4, 12"
                style={{ width: '140px' }}
                required
              />
              {tableNumber && usedNumbers.has(parseInt(tableNumber)) && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-red)' }}>
                  ⚠️ Table {tableNumber} already exists
                </span>
              )}
            </div>
            <button
              id="add-single-table-btn"
              type="submit"
              className="btn btn-primary"
              disabled={creating || !restaurantId || (!!tableNumber && usedNumbers.has(parseInt(tableNumber)))}
              style={{ marginTop: '1.25rem' }}
            >
              {creating ? '⏳ Generating QR...' : `+ Create Table ${tableNumber || '#'}`}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreateBulk} className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                How many tables?
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={bulkCount}
                onChange={e => setBulkCount(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: '100px' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Numbers will start from {(tables.reduce((max, t) => Math.max(max, t.tableNumber), 0)) + 1}
              </span>
            </div>
            <button
              id="add-tables-btn"
              type="submit"
              className="btn btn-primary"
              disabled={creating || !restaurantId}
              style={{ marginTop: '1.25rem' }}
            >
              {creating ? '⏳ Generating QR codes...' : `+ Add ${bulkCount} Table${bulkCount > 1 ? 's' : ''}`}
            </button>
          </form>
        )}
      </div>

      {/* Tables list */}
      {tables.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No tables yet</div>
          <div className="empty-state-desc">
            Enter a table number above and click &quot;+ Create Table&quot; to generate a QR code.
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Table #</th>
                <th>QR Code</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tables.map(table => (
                <tr key={table.id}>
                  <td>
                    <span style={{
                      fontSize: '1.75rem',
                      fontWeight: 900,
                      fontFamily: 'Outfit, sans-serif',
                      color: 'var(--text-primary)',
                    }}>
                      {table.tableNumber}
                    </span>
                  </td>
                  <td>
                    {table.qrImageUrl ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={table.qrImageUrl}
                          alt={`Table ${table.tableNumber} QR code`}
                          style={{
                            width: 64, height: 64, borderRadius: '8px',
                            border: '1px solid var(--border-subtle)',
                            background: 'white', padding: '2px',
                          }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        <a
                          href={table.qrImageUrl}
                          download={`table-${table.tableNumber}-qr.png`}
                          className="btn btn-secondary btn-sm"
                        >
                          ↓ PNG
                        </a>
                      </div>
                    ) : (
                      <span className="text-sm text-muted">No QR image</span>
                    )}
                  </td>
                  <td>
                    <span className="text-sm text-muted">
                      {new Date(table.tokenUpdatedAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                      <a
                        href={`/menu/${slug}?table=${table.qrToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        title="Open customer menu for this table"
                      >
                        🔗 Test
                      </a>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setConfirmRegen(table)}
                        disabled={regenerating === table.id}
                      >
                        {regenerating === table.id ? '⏳' : '↺ Regen QR'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setConfirmDelete(table)}
                        disabled={deleting === table.id}
                      >
                        {deleting === table.id ? '⏳' : '🗑 Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Regenerate Confirmation Modal */}
      {confirmRegen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmRegen(null)}>
          <div className="modal">
            <div className="modal-title">⚠️ Regenerate QR — Table {confirmRegen.tableNumber}</div>
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              This will <strong>invalidate the existing printed QR code</strong> for Table {confirmRegen.tableNumber}.
              Make sure no customers are currently ordering on this table.
            </div>
            <p style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              After regeneration you&apos;ll need to print and replace the physical QR code.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmRegen(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleRegenerate} disabled={!!regenerating}>
                {regenerating ? '⏳ Regenerating...' : 'Yes, Regenerate QR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div className="modal">
            <div className="modal-title">🗑 Delete Table {confirmDelete.tableNumber}?</div>
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              This will <strong>permanently delete Table {confirmDelete.tableNumber}</strong> and its QR code.
              The table number will become available to reuse.
            </div>
            <p style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Note: Deletion will be blocked if this table has active (Pending/Preparing) orders.
              Historical served orders will not be affected.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={!!deleting}>
                {deleting ? '⏳ Deleting...' : 'Yes, Delete Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
