'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useVendorCtx } from '@/app/(vendor)/vendor-context'

export default function VendorDashboard() {
  const params = useParams()
  const slug = params?.slug as string
  const ctx = useVendorCtx()
  const restaurantId = ctx?.restaurantId

  const [categories, setCategories] = useState<any[]>([])
  const [tables, setTables] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [allItems, setAllItems] = useState<any[]>([])
  const [dishSearch, setDishSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [updatingStockId, setUpdatingStockId] = useState<string | null>(null)

  useEffect(() => {
    if (!restaurantId) return
    loadDashboard(restaurantId)
  }, [restaurantId])

  async function loadDashboard(rid: string) {
    try {
      const [cats, tbls, ords, itemsList] = await Promise.all([
        api.getCategories(rid),
        api.getTables(rid),
        api.getOrders(rid, { status: 'PENDING,PREPARING,SERVED' }),
        api.getItems(rid),
      ])
      setCategories(cats || [])
      setTables(tbls || [])
      setOrders(ords || [])
      setAllItems(itemsList || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleDishStock(item: any) {
    if (!restaurantId) return
    setUpdatingStockId(item.id)
    setError('')
    setSuccess('')
    try {
      const nextVal = !item.isAvailable
      await api.updateItem(restaurantId, item.id, { isAvailable: nextVal })
      
      // Update local state
      setAllItems(prev => prev.map(x => x.id === item.id ? { ...x, isAvailable: nextVal } : x))
      
      // Also update categories in case they're used
      setCategories(prev => prev.map(cat => {
        if (cat.id !== item.categoryId) return cat
        return {
          ...cat,
          items: cat.items?.map((x: any) => x.id === item.id ? { ...x, isAvailable: nextVal } : x)
        }
      }))
      
      setSuccess(`"${item.name}" is now ${nextVal ? 'Available' : 'Out of Stock'}`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e.message || 'Failed to update stock status')
      setTimeout(() => setError(''), 4000)
    } finally {
      setUpdatingStockId(null)
    }
  }

  async function toggleOrderPayment(order: any) {
    if (!restaurantId) return
    setError('')
    setSuccess('')
    try {
      const nextVal = !order.isPaid
      await api.updateOrder(restaurantId, order.id, { isPaid: nextVal })
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isPaid: nextVal } : o))
      setSuccess(`Order for Table ${order.tableNumber} marked as ${nextVal ? 'Paid' : 'Unpaid'}`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e.message || 'Failed to update payment status')
      setTimeout(() => setError(''), 4000)
    }
  }

  if (!restaurantId) return <div className="loading-spinner" />
  if (loading) return <div className="loading-spinner" />

  const totalItems = allItems.length
  const activeTables = tables.filter((t: any) => t.isActive).length
  const activeOrdersList = orders.filter((o: any) => o.status === 'PENDING' || o.status === 'PREPARING')
  const servedOrdersList = orders.filter((o: any) => o.status === 'SERVED')

  const pendingOrders = orders.filter((o: any) => o.status === 'PENDING').length
  const preparingOrders = orders.filter((o: any) => o.status === 'PREPARING').length
  const servedOrders = servedOrdersList.length

  // Filter menu items for Quick Stock Control
  const filteredDishes = allItems.filter(item => {
    const q = dishSearch.toLowerCase()
    return item.name.toLowerCase().includes(q) || (item.category?.name || '').toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Welcome! 👋</h1>
          <p>Overview for <strong>{ctx?.restaurantName || slug}</strong></p>
        </div>
        <a href={`/menu/${slug}`} target="_blank" className="btn btn-secondary">
          🔗 View Live Menu
        </a>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>✓ {success}</div>}

      {/* 5-Column Responsive Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div className="stat-card">
          <div className="stat-value">{totalItems}</div>
          <div className="stat-label">Menu Items</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activeTables}</div>
          <div className="stat-label">Active Tables</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent-amber)' }}>{pendingOrders}</div>
          <div className="stat-label">Pending Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>{preparingOrders}</div>
          <div className="stat-label">Preparing</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-green)' }}>
          <div className="stat-value" style={{ color: 'var(--accent-green)' }}>{servedOrders}</div>
          <div className="stat-label">Served Today</div>
        </div>
      </div>

      {/* Modern Two-Column Layout */}
      <div className="dashboard-layout" style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr',
        gap: '2rem',
      }}>
        
        {/* Left Column: Orders Dashboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Section 1: Live Orders */}
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🔥 Live Orders 
                <span className="badge badge-pending" style={{ fontSize: '0.7rem', textTransform: 'none' }}>
                  {activeOrdersList.length} Active
                </span>
              </h2>
              <a href={`/vendor/${slug}/kitchen`} className="btn btn-secondary btn-sm">Kitchen Board →</a>
            </div>

            {activeOrdersList.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
                <p style={{ color: 'var(--text-secondary)' }}>No active orders right now</p>
              </div>
            ) : (
              <div className="kitchen-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {activeOrdersList.slice(0, 6).map((order: any) => (
                  <div key={order.id} className={`order-card ${order.status.toLowerCase()}`}>
                    <div className="flex items-center justify-between" style={{ marginBottom: '0.4rem' }}>
                      <div className="order-table-num" style={{ fontSize: '1.4rem' }}>Table {order.tableNumber}</div>
                      <span className={`badge badge-${order.status.toLowerCase()}`}>{order.status}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      Order #{order.id.slice(0, 5).toUpperCase()}
                    </div>
                    {order.customer && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                        👤 {order.customer.name}
                      </div>
                    )}
                    <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '0.5rem' }}>
                      {order.items?.map((item: any) => (
                        <div key={item.id} className="order-item-row" style={{ padding: '0.35rem 0' }}>
                          <span style={{ fontSize: '0.85rem' }}>{item.nameSnapshot}</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>×{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                      <span className="text-xs text-muted">
                        {new Date(order.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'Outfit, sans-serif' }}>
                        ₹{Number(order.totalAmount).toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.5rem' }}>
                      <span className={`badge ${order.isPaid ? 'badge-active' : 'badge-pending'}`} style={{ fontSize: '0.65rem', padding: '0.25rem 0.45rem', textTransform: 'none' }}>
                        {order.isPaid ? '💵 Paid' : '🕒 Unpaid'}
                      </span>
                      <button
                        onClick={() => toggleOrderPayment(order)}
                        className="btn btn-secondary btn-sm"
                        style={{
                          fontSize: '0.65rem',
                          minHeight: '24px',
                          padding: '0.2rem 0.45rem',
                          background: order.isPaid ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                          color: order.isPaid ? 'var(--accent-red)' : 'var(--accent-green)',
                          border: `1px solid ${order.isPaid ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`
                        }}
                      >
                        {order.isPaid ? 'Mark Unpaid' : 'Mark Paid'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Served Details (Requested Feature!) */}
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ✓ Served Details
                <span className="badge badge-served" style={{ fontSize: '0.7rem', textTransform: 'none' }}>
                  {servedOrders} Served Today
                </span>
              </h2>
            </div>

            {servedOrdersList.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No orders served yet today.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Table</th>
                      <th>Time Served</th>
                      <th>Items Ordered</th>
                      <th>Payment Status</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servedOrdersList.slice(0, 5).map((order: any) => (
                      <tr key={order.id}>
                        <td style={{ fontWeight: 700, fontSize: '1rem' }}>
                          <div>Table {order.tableNumber}</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginTop: '2px' }}>
                            Order #{order.id.slice(0, 5).toUpperCase()}
                          </div>
                          {order.customer && (
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--accent-primary)', marginTop: '2px' }}>
                              👤 {order.customer.name}
                            </div>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {new Date(order.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {order.items?.map((item: any) => (
                              <span key={item.id} className="badge badge-inactive" style={{ fontSize: '0.7rem', textTransform: 'none' }}>
                                {item.nameSnapshot} ({item.quantity})
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className={`badge ${order.isPaid ? 'badge-active' : 'badge-pending'}`} style={{ fontSize: '0.75rem', textTransform: 'none' }}>
                              {order.isPaid ? '💵 Paid' : '🕒 Unpaid'}
                            </span>
                            <button
                              onClick={() => toggleOrderPayment(order)}
                              className="btn btn-secondary btn-sm"
                              style={{
                                fontSize: '0.7rem',
                                minHeight: '26px',
                                padding: '0.25rem 0.5rem',
                                background: order.isPaid ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                                color: order.isPaid ? 'var(--accent-red)' : 'var(--accent-green)',
                                border: `1px solid ${order.isPaid ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`
                              }}
                            >
                              {order.isPaid ? 'Mark Unpaid' : 'Mark Paid'}
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'Outfit, sans-serif' }}>
                          ₹{Number(order.totalAmount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Quick Dish Availability Toggler (Requested Feature!) */}
        <div>
          <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🍳 Quick Stock Toggles
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Instantly enable or disable menu items during high-volume rush periods.
              </p>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="🔍 Search dishes or categories..."
                value={dishSearch}
                onChange={e => setDishSearch(e.target.value)}
                style={{ paddingLeft: '2.5rem', minHeight: '40px' }}
              />
            </div>

            {/* Dishes list */}
            <div style={{
              flex: 1,
              maxHeight: '480px',
              overflowY: 'auto',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-secondary)',
              padding: '0.5rem'
            }}>
              {filteredDishes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No dishes found.
                </div>
              ) : (
                filteredDishes.map((item: any) => {
                  const isUpdating = updatingStockId === item.id
                  return (
                    <div key={item.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-card)',
                      marginBottom: '0.5rem',
                      border: '1px solid var(--border-subtle)',
                      transition: 'all 0.2s',
                      opacity: item.isAvailable ? 1 : 0.65
                    }}>
                      <div style={{ overflow: 'hidden', marginRight: '0.5rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '2px', alignItems: 'center' }}>
                          <span className="text-xs text-muted">{item.category?.name || 'Item'}</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                            ₹{Number(item.price).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Stock Switch */}
                      <button
                        onClick={() => toggleDishStock(item)}
                        disabled={isUpdating}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.3rem',
                          background: item.isAvailable ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                          border: `1px solid ${item.isAvailable ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          borderRadius: '6px',
                          padding: '0.35rem 0.65rem',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: item.isAvailable ? 'var(--accent-green)' : 'var(--accent-red)',
                          transition: 'all 0.15s',
                          minHeight: '32px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {isUpdating ? (
                          <span className="loading-spinner" style={{ width: '12px', height: '12px', borderWidth: '1.5px', margin: 0 }} />
                        ) : (
                          <>
                            <span style={{ fontSize: '0.65rem' }}>{item.isAvailable ? '●' : '○'}</span>
                            {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                          </>
                        )}
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span>Total dishes: {allItems.length}</span>
              <span>Available: {allItems.filter(i => i.isAvailable).length}</span>
            </div>
          </div>
        </div>

      </div>

      {/* CSS override to support responsive layout for dashboard */}
      <style jsx global>{`
        @media (max-width: 992px) {
          .dashboard-layout {
            grid-template-columns: 1fr !important;
            gap: 1.5rem !important;
          }
        }
      `}</style>

    </div>
  )
}
