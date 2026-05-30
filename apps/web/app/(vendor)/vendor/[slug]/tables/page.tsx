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
  const [bulkCount, setBulkCount] = useState(1)
  const [creating, setCreating] = useState(false)
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [confirmRegen, setConfirmRegen] = useState<any | null>(null)

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurantId) {
      setError('Restaurant not resolved — please reload the page')
      return
    }
    const count = Number(bulkCount)
    if (!count || count < 1 || count > 50) {
      setError('Please enter a count between 1 and 50')
      return
    }
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

  async function handleDeactivate(id: string, tableNumber: number) {
    if (!restaurantId) return
    if (!confirm(`Deactivate Table ${tableNumber}? The QR code will stop working for customers.`)) return
    setError('')
    try {
      await api.deleteTable(restaurantId, id)
      showMsg(`Table ${tableNumber} deactivated`)
      await loadTables(restaurantId)
    } catch (e: any) {
      setError(e.message || 'Failed to deactivate table')
    }
  }

  const activeTables = tables.filter(t => t.isActive)

  if (loading) return (
    <div>
      <div className="page-header"><h1>Tables & QR Codes</h1></div>
      <div className="loading-spinner" />
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Tables & QR Codes</h1>
          <p>
            {activeTables.length} active table{activeTables.length !== 1 ? 's' : ''}
            {tables.length > activeTables.length && ` · ${tables.length - activeTables.length} inactive`}
          </p>
        </div>
        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={50}
            value={bulkCount}
            onChange={e => setBulkCount(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ width: '80px' }}
            title="Number of tables to create"
          />
          <button
            id="add-tables-btn"
            type="submit"
            className="btn btn-primary"
            disabled={creating || !restaurantId}
          >
            {creating
              ? '⏳ Generating QR codes...'
              : `+ Add ${bulkCount} Table${bulkCount > 1 ? 's' : ''}`
            }
          </button>
        </form>
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

      {/* Tables list */}
      {tables.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No tables yet</div>
          <div className="empty-state-desc">
            Enter a number above and click &quot;+ Add Tables&quot; to generate QR codes for your tables.
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Table #</th>
                <th>QR Code</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tables.map(table => (
                <tr key={table.id} style={{ opacity: table.isActive ? 1 : 0.45 }}>
                  <td>
                    <span style={{
                      fontSize: '1.75rem',
                      fontWeight: 900,
                      fontFamily: 'Outfit, sans-serif',
                      color: table.isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
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
                    <span className={`badge badge-${table.isActive ? 'active' : 'inactive'}`}>
                      {table.isActive ? '● Active' : '○ Inactive'}
                    </span>
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
                      {table.isActive && (
                        <>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setConfirmRegen(table)}
                            disabled={regenerating === table.id}
                          >
                            {regenerating === table.id ? '⏳' : '↺ Regen QR'}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeactivate(table.id, table.tableNumber)}
                          >
                            Deactivate
                          </button>
                        </>
                      )}
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
    </div>
  )
}
