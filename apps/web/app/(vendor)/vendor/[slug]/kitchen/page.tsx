'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { io as connectSocket, Socket } from 'socket.io-client'
import { api } from '@/lib/api'
import { useVendorCtx } from '@/app/(vendor)/vendor-context'

type OrderStatus = 'PENDING' | 'PREPARING' | 'SERVED' | 'CANCELLED'

interface OrderItem {
  id: string
  nameSnapshot: string
  priceSnapshot: string
  quantity: number
}

interface Order {
  id: string
  tableNumber: number
  status: OrderStatus
  customerNote?: string
  totalAmount: string
  placedAt: string
  items: OrderItem[]
  customer?: { name: string; phone: string }
}

const STATUS_NEXT: Record<OrderStatus, OrderStatus | null> = {
  PENDING: 'PREPARING',
  PREPARING: 'SERVED',
  SERVED: null,
  CANCELLED: null,
}

const STATUS_BTN_LABEL: Record<OrderStatus, string> = {
  PENDING: '▶ Start Preparing',
  PREPARING: '✓ Mark Served',
  SERVED: 'Served',
  CANCELLED: 'Cancelled',
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const now = ctx.currentTime

    // First chime (D5)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now) // D5
    gain1.gain.setValueAtTime(0.35, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.5)

    // Second chime (A5)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880.00, now + 0.12) // A5
    gain2.gain.setValueAtTime(0.35, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.7)
  } catch (err) {
    console.warn("Failed to play notification audio chime:", err)
  }
}

export default function KitchenPage() {
  const params = useParams()
  const slug = params?.slug as string
  const ctx = useVendorCtx()
  const restaurantId = ctx?.restaurantId ?? null

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [filter, setFilter] = useState<'live' | 'all'>('live')
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [kitchenNotification, setKitchenNotification] = useState<{ tableNumber: number; id: string } | null>(null)

  // Stock Management Drawer States
  const [showStockDrawer, setShowStockDrawer] = useState(false)
  const [allItems, setAllItems] = useState<any[]>([])
  const [stockSearch, setStockSearch] = useState('')
  const [updatingStockId, setUpdatingStockId] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)

  // Load initial orders & items
  useEffect(() => {
    if (!restaurantId) return
    loadOrders(restaurantId)
    loadItems(restaurantId)
  }, [restaurantId])

  // Connect Socket.io
  useEffect(() => {
    if (!restaurantId) return
    const token = localStorage.getItem('accessToken')
    if (!token) return

    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1').replace('/v1', '')
    const socket = connectSocket(apiUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      // Explicitly join the restaurant room
      socket.emit('join-restaurant', { restaurantId })
    })

    socket.on('connect_error', (err) => {
      console.warn('[Kitchen Socket] connect_error:', err.message)
      setConnected(false)
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('new_order', (order: Order) => {
      setOrders(prev => [order, ...prev])
      setNewOrderIds(s => { const n = new Set(s); n.add(order.id); return n })
      setTimeout(() => setNewOrderIds(s => { const n = new Set(s); n.delete(order.id); return n }), 3000)
      
      // Play crisp double-chime sound notification
      playNotificationSound()

      // Pop up premium banner toast
      setKitchenNotification({ tableNumber: order.tableNumber, id: order.id })
      // Auto-hide after 5 seconds
      setTimeout(() => setKitchenNotification(null), 5000)
    })

    socket.on('order_updated', (updated: Order) => {
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
    })

    // Real-time stock sync — update kitchen drawer immediately
    socket.on('item_updated', (updatedItem: any) => {
      setAllItems(prev => prev.map(x => x.id === updatedItem.id ? { ...x, ...updatedItem } : x))
    })
    socket.on('menu_changed', () => {
      if (restaurantId) loadItems(restaurantId)
    })

    return () => { socket.disconnect() }
  }, [restaurantId])

  async function loadOrders(rid: string) {
    try {
      const data = await api.getOrders(rid, { status: 'PENDING,PREPARING' })
      setOrders(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e.message || 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  async function loadItems(rid: string) {
    try {
      const data = await api.getItems(rid)
      setAllItems(data || [])
    } catch (e: any) {
      console.error('Failed to load menu items:', e)
    }
  }

  async function toggleDishStock(item: any) {
    if (!restaurantId) return
    setUpdatingStockId(item.id)
    const nextVal = !item.isAvailable
    // Optimistic update
    setAllItems(prev => prev.map(x => x.id === item.id ? { ...x, isAvailable: nextVal } : x))
    try {
      await api.updateItem(restaurantId, item.id, { isAvailable: nextVal })
    } catch (e: any) {
      // Revert
      setAllItems(prev => prev.map(x => x.id === item.id ? { ...x, isAvailable: item.isAvailable } : x))
      setError(e.message || 'Failed to update stock status')
      setTimeout(() => setError(''), 4000)
    } finally {
      setUpdatingStockId(null)
    }
  }

  async function advanceStatus(order: Order) {
    const next = STATUS_NEXT[order.status]
    if (!next || !restaurantId) return
    try {
      await api.updateOrder(restaurantId, order.id, { status: next })
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function cancelOrder(order: Order) {
    if (!restaurantId || !confirm('Cancel this order?')) return
    try {
      await api.updateOrder(restaurantId, order.id, { status: 'CANCELLED' })
    } catch (e: any) {
      setError(e.message)
    }
  }

  const displayOrders = filter === 'live'
    ? orders.filter(o => o.status === 'PENDING' || o.status === 'PREPARING')
    : orders

  const pendingCount = orders.filter(o => o.status === 'PENDING').length
  const preparingCount = orders.filter(o => o.status === 'PREPARING').length

  const filteredDishes = allItems.filter(item => {
    const q = stockSearch.toLowerCase()
    return item.name.toLowerCase().includes(q) || (item.category?.name || '').toLowerCase().includes(q)
  })

  if (!restaurantId || loading) return (
    <div>
      <div className="page-header"><h1>🍳 Kitchen Board</h1></div>
      <div className="loading-spinner" />
    </div>
  )

  return (
    <div>
      {/* Keyframes and styles for ringing bell and sliding toast */}
      <style>{`
        @keyframes slideDown {
          from { transform: translate(-50%, -40px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes bellRing {
          0% { transform: rotate(-15deg); }
          100% { transform: rotate(15deg); }
        }
      `}</style>

      {/* Floating Ringing Alert Toast for Incoming Kitchen Orders */}
      {kitchenNotification && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: 'white',
          padding: '1.25rem 2rem',
          borderRadius: '16px',
          boxShadow: '0 10px 35px rgba(245, 158, 11, 0.45)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          animation: 'slideDown 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          fontWeight: 700,
          border: '1.5px solid rgba(255,255,255,0.2)',
        }}>
          <span style={{ fontSize: '1.75rem', display: 'inline-block', animation: 'bellRing 0.15s infinite alternate' }}>🔔</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.75rem', opacity: 0.85, fontWeight: 800 }}>
              Incoming Kitchen Order!
            </div>
            <div style={{ fontSize: '1.05rem', marginTop: '2px' }}>
              New Order Received from <strong>Table {kitchenNotification.tableNumber}</strong>
            </div>
          </div>
          <button
            onClick={() => setKitchenNotification(null)}
            style={{
              background: 'rgba(255,255,255,0.25)',
              border: 'none',
              borderRadius: '50%',
              color: 'white',
              width: '26px',
              height: '26px',
              cursor: 'pointer',
              fontWeight: 900,
              marginLeft: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              transition: 'all 0.15s',
            }}
            onMouseOver={(e: any) => { e.target.style.background = 'rgba(255,255,255,0.4)' }}
            onMouseOut={(e: any) => { e.target.style.background = 'rgba(255,255,255,0.25)' }}
          >
            ×
          </button>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>🍳 Kitchen Board</h1>
          <div className="flex items-center gap-2" style={{ marginTop: '0.25rem' }}>
            <span className={`badge ${connected ? 'badge-active' : 'badge-inactive'}`}
              title={connected ? 'Real-time updates active' : 'Not connected to real-time server'}>
              {connected ? '● Live' : '○ Offline'}
            </span>
            <span className="text-sm text-muted">
              {pendingCount} new · {preparingCount} cooking
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowStockDrawer(true)}
            style={{ border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}
          >
            📋 Manage Stock
          </button>
          <button
            className={`btn btn-sm ${filter === 'live' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('live')}
          >
            Live Orders
          </button>
          <button
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setFilter('all'); if (restaurantId) loadOrders(restaurantId) }}
          >
            All Today
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>
      )}

      {displayOrders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🍽️</div>
          <div className="empty-state-title">
            {filter === 'live' ? 'No active orders' : 'No orders today'}
          </div>
          <div className="empty-state-desc">
            {connected
              ? 'Orders appear here instantly when customers scan the QR code and place an order'
              : 'Connect to the real-time server to receive instant updates'
            }
          </div>
        </div>
      ) : (
        <div className="kitchen-grid">
          {displayOrders.map(order => (
            <div
              key={order.id}
              className={`order-card ${order.status.toLowerCase()} ${newOrderIds.has(order.id) ? 'new-pulse' : ''}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
                <div className="order-table-num">Table {order.tableNumber}</div>
                <span className={`badge badge-${order.status.toLowerCase()}`}>{order.status}</span>
              </div>

              {/* Order Info & Time */}
              <div className="flex justify-between items-center text-xs text-muted" style={{ marginBottom: '0.65rem' }}>
                <span>Order #{order.id.slice(0, 5).toUpperCase()}</span>
                <span>{new Date(order.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {/* Customer Info */}
              {order.customer && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.65rem', paddingBottom: '0.4rem', borderBottom: '1px dashed var(--border-subtle)' }}>
                  👤 {order.customer.name} ({order.customer.phone})
                </div>
              )}

              {/* Items */}
              <div style={{ marginBottom: '0.75rem' }}>
                {order.items.map(item => (
                  <div key={item.id} className="order-item-row">
                    <span style={{ fontWeight: 600 }}>{item.nameSnapshot}</span>
                    <span style={{
                      background: 'var(--accent-primary)',
                      color: 'white',
                      borderRadius: '50%',
                      width: '26px',
                      height: '26px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {item.quantity}
                    </span>
                  </div>
                ))}
              </div>

              {/* Customer note */}
              {order.customerNote && (
                <div style={{
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.85rem',
                  color: '#fcd34d',
                  marginBottom: '0.75rem',
                }}>
                  📝 {order.customerNote}
                </div>
              )}

              {/* Total */}
              <div style={{ fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'Outfit, sans-serif', marginBottom: '1rem' }}>
                ₹{Number(order.totalAmount).toFixed(2)}
              </div>

              {/* Actions */}
              {STATUS_NEXT[order.status] && (
                <div className="flex gap-2">
                  <button
                    className={`btn btn-sm ${order.status === 'PENDING' ? 'btn-primary' : 'btn-success'}`}
                    style={{ flex: 1 }}
                    onClick={() => advanceStatus(order)}
                  >
                    {STATUS_BTN_LABEL[order.status]}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => cancelOrder(order)} title="Cancel order">
                    ✕
                  </button>
                </div>
              )}
              {order.status === 'SERVED' && (
                <div style={{ color: 'var(--accent-green)', fontSize: '0.875rem', fontWeight: 600 }}>✓ Served</div>
              )}
              {order.status === 'CANCELLED' && (
                <div style={{ color: 'var(--accent-red)', fontSize: '0.875rem', fontWeight: 600 }}>✗ Cancelled</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stock Management sliding drawer */}
      {showStockDrawer && (
        <div
          className="modal-overlay"
          style={{ justifyContent: 'flex-end', padding: 0 }}
          onClick={e => e.target === e.currentTarget && setShowStockDrawer(false)}
        >
          <div
            className="modal"
            style={{
              maxWidth: '440px',
              height: '100vh',
              borderRadius: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: '1.5rem',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
              animation: 'slideLeft 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '2px' }}>📋 Stock Manager</h2>
                <p className="text-xs text-muted">Instantly toggle dish availability for ordering</p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowStockDrawer(false)}
                style={{ minWidth: '32px', height: '32px', padding: 0, borderRadius: '50%' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="🔍 Search dishes..."
                value={stockSearch}
                onChange={e => setStockSearch(e.target.value)}
                style={{ minHeight: '38px', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-secondary)',
              padding: '0.4rem'
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
                      padding: '0.65rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-card)',
                      marginBottom: '0.4rem',
                      border: '1px solid var(--border-subtle)',
                      transition: 'all 0.2s',
                      opacity: item.isAvailable ? 1 : 0.65
                    }}>
                      <div style={{ overflow: 'hidden', marginRight: '0.5rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                        <span className="text-xs text-muted">{item.category?.name || 'Item'}</span>
                      </div>

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
                          padding: '0.3rem 0.6rem',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: item.isAvailable ? 'var(--accent-green)' : 'var(--accent-red)',
                          transition: 'all 0.15s',
                          minHeight: '30px'
                        }}
                      >
                        {isUpdating ? (
                          <span className="loading-spinner" style={{ width: '12px', height: '12px', borderWidth: '1.5px', margin: 0 }} />
                        ) : (
                          item.isAvailable ? 'In Stock' : 'Out of Stock'
                        )}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slide left drawer keyframe */}
      <style jsx global>{`
        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

    </div>
  )
}
