'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useVendorCtx } from '@/app/(vendor)/vendor-context'

// ─── Simple inline SVG Line Chart ───────────────────────────────
function LineChart({ data, height = 120 }: { data: { date: string; revenue: number }[]; height?: number }) {
  if (!data || data.length === 0) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
      No revenue data yet
    </div>
  )
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
  const maxRev = Math.max(...sorted.map(d => d.revenue), 1)
  const W = 600, pad = 10
  const points = sorted.map((d, i) => ({
    x: pad + (i / Math.max(sorted.length - 1, 1)) * (W - pad * 2),
    y: height - pad - ((d.revenue / maxRev) * (height - pad * 2)),
    ...d,
  }))
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`
  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', height, display: 'block' }}>
      <defs>
        <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#rg)" />
      <path d={pathD} fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="var(--accent-primary)" />
      ))}
    </svg>
  )
}

export default function VendorRevenuePage() {
  const params = useParams()
  const slug = params?.slug as string
  const ctx = useVendorCtx()
  const restaurantId = ctx?.restaurantId

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [orderDateFilter, setOrderDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    if (!restaurantId) return
    try {
      const d = await api.getRestaurantAnalytics(restaurantId)
      setData(d)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  function handleExportCSV() {
    if (!restaurantId) return
    const url = api.exportOrders(restaurantId, orderDateFilter || undefined, undefined)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${slug}-${Date.now()}.csv`
    a.click()
  }

  if (!restaurantId || loading) return <div className="loading-spinner" />

  const filteredOrders = (data?.recentOrders || []).filter((o: any) => {
    const matchSearch = !orderSearch || 
      `${o.tableNumber}`.includes(orderSearch) ||
      o.customer?.name?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customer?.phone?.includes(orderSearch)
    const matchDate = !orderDateFilter || o.placedAt.startsWith(orderDateFilter)
    const matchStatus = !statusFilter || o.status === statusFilter
    return matchSearch && matchDate && matchStatus
  })

  const kpis = data ? [
    { label: 'Today', value: `₹${Number(data.todayRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, sub: `${data.todayOrders} orders`, color: 'var(--accent-primary)' },
    { label: 'This Week', value: `₹${Number(data.weekRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, sub: `${data.weekOrders} orders`, color: 'var(--accent-green)' },
    { label: 'This Month', value: `₹${Number(data.monthRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, sub: `${data.monthOrders} orders`, color: 'var(--accent-blue)' },
    { label: 'All Time', value: `₹${Number(data.totalRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, sub: `${data.totalOrders} orders`, color: 'var(--gold-primary)' },
    { label: 'Avg Order', value: `₹${Number(data.avgOrderValue).toFixed(2)}`, sub: '', color: 'var(--accent-amber)' },
    { label: 'Customers', value: data.totalCustomers, sub: '', color: 'var(--accent-green)' },
  ] : []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>💰 Revenue Dashboard</h1>
          <p>Financial overview for <strong>{ctx?.restaurantName || slug}</strong></p>
        </div>
        <button className="btn btn-secondary" onClick={handleExportCSV}>📥 Export CSV</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {kpis.map(k => (
          <div key={k.label} className="stat-card">
            <div className="stat-value" style={{ color: k.color, fontSize: '1.3rem', fontFamily: 'Outfit, sans-serif' }}>{k.value}</div>
            <div className="stat-label">{k.label}</div>
            {k.sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Chart */}
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>📈 Revenue Trend — Last 30 Days</h2>
          <LineChart data={data?.revenueByDay || []} height={140} />
        </div>

        {/* Top Items */}
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>🔥 Top Menu Items</h2>
          {data?.topItems?.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No data yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(data?.topItems || []).slice(0, 8).map((item: any, i: number) => (
                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gold-primary)', marginRight: '0.4rem' }}>#{i + 1}</span>
                    <span style={{ fontSize: '0.875rem' }}>{item.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent-green)' }}>₹{Number(item.revenue).toFixed(2)}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>×{item.quantity} sold</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order History Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>🧾 Order History</h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="🔍 Search table / customer..."
              value={orderSearch}
              onChange={e => setOrderSearch(e.target.value)}
              style={{ minWidth: '200px', minHeight: '36px', fontSize: '0.875rem' }}
            />
            <input
              type="date"
              value={orderDateFilter}
              onChange={e => setOrderDateFilter(e.target.value)}
              style={{ minHeight: '36px', fontSize: '0.875rem' }}
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ minHeight: '36px', fontSize: '0.875rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0 0.75rem' }}
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PREPARING">Preparing</option>
              <option value="SERVED">Served</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Table</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Date & Time</th>
                <th>Paid</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-icon">🧾</div>
                    <div className="empty-state-title">No orders found</div>
                  </div>
                </td></tr>
              ) : filteredOrders.map((o: any) => (
                <tr key={o.id}>
                  <td><code style={{ fontSize: '0.75rem', color: 'var(--gold-primary)' }}>#{o.id.slice(0, 8).toUpperCase()}</code></td>
                  <td style={{ fontWeight: 700 }}>Table {o.tableNumber}</td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {o.customer ? (
                      <div>
                        <div>{o.customer.name}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{o.customer.phone}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td><span className={`badge badge-${o.status.toLowerCase()}`}>{o.status}</span></td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {new Date(o.placedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <span className={`badge badge-${o.isPaid ? 'active' : 'pending'}`} style={{ fontSize: '0.7rem' }}>
                      {o.isPaid ? '💵 Paid' : '🕒 Unpaid'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'Outfit, sans-serif' }}>
                    ₹{Number(o.totalAmount).toFixed(2)}
                    {o.discountAmount && Number(o.discountAmount) > 0 && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', fontWeight: 400 }}>
                        -₹{Number(o.discountAmount).toFixed(2)} disc
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Showing {filteredOrders.length} of {data?.recentOrders?.length || 0} orders
        </div>
      </div>
    </div>
  )
}
