'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

// ─── Simple SVG Line Chart ───────────────────────────────────────
function LineChart({ data, height = 120 }: { data: { date: string; revenue: number; orders: number }[]; height?: number }) {
  if (!data || data.length === 0) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No data</div>

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
  const maxRev = Math.max(...sorted.map(d => d.revenue), 1)
  const width = 600
  const pad = 10

  const points = sorted.map((d, i) => ({
    x: pad + (i / Math.max(sorted.length - 1, 1)) * (width - pad * 2),
    y: height - pad - ((d.revenue / maxRev) * (height - pad * 2)),
    ...d,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height, display: 'block' }}>
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold-primary)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--gold-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#chartGradient)" />
      <path d={pathD} fill="none" stroke="var(--gold-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--gold-primary)" />
      ))}
    </svg>
  )
}

export default function AdminBillingPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await api.getGlobalAnalytics()
      setData(d)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleExportCSV() {
    setExporting(true)
    const url = api.exportOrders('') // global export — no restaurantId filter
    const a = document.createElement('a')
    a.href = url
    a.download = `global-orders-${Date.now()}.csv`
    a.click()
    setTimeout(() => setExporting(false), 1500)
  }

  const kpis = data ? [
    { label: 'Total Revenue', value: `₹${Number(data.totalRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'var(--gold-primary)', icon: '💰' },
    { label: 'Total Orders', value: data.totalOrders?.toLocaleString('en-IN'), color: 'var(--accent-primary)', icon: '🧾' },
    { label: 'Avg Order Value', value: `₹${Number(data.avgOrderValue).toFixed(2)}`, color: 'var(--accent-blue)', icon: '📊' },
    { label: 'Active Restaurants', value: data.totalRestaurants, color: 'var(--accent-green)', icon: '🏪' },
    { label: 'Today Revenue', value: `₹${Number(data.todayRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'var(--accent-amber)', icon: '📅' },
    { label: 'This Week', value: `₹${Number(data.weekRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'var(--accent-purple, #8B5CF6)', icon: '📈' },
    { label: 'This Month', value: `₹${Number(data.monthRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'var(--accent-primary)', icon: '🗓' },
    { label: 'Total Customers', value: data.totalCustomers?.toLocaleString('en-IN'), color: 'var(--accent-green)', icon: '👥' },
  ] : []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>💰 Billing & Revenue</h1>
          <p>Global platform analytics across all restaurants</p>
        </div>
        <button className="btn btn-gold" onClick={handleExportCSV} disabled={exporting}>
          {exporting ? '⏳ Exporting…' : '📥 Export CSV'}
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}

      {loading ? (
        <div className="loading-spinner" />
      ) : (
        <>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {kpis.map(k => (
              <div key={k.label} className="stat-card">
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{k.icon}</div>
                <div className="stat-value" style={{ color: k.color, fontSize: '1.4rem' }}>{k.value}</div>
                <div className="stat-label">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Revenue Chart */}
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📈 Revenue Trend — Last 30 Days
            </h2>
            <LineChart data={data?.revenueByDay || []} height={140} />
            {data?.revenueByDay?.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>{data.revenueByDay[0]?.date}</span>
                <span>{data.revenueByDay[data.revenueByDay.length - 1]?.date}</span>
              </div>
            )}
          </div>

          {/* Top Restaurants */}
          <div className="card">
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>🏆 Top Restaurants by Revenue</h2>
            {!data?.topRestaurants?.length ? (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-title">No revenue data yet</div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Restaurant</th>
                      <th>Status</th>
                      <th>Orders</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                      <th style={{ textAlign: 'right' }}>Avg Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topRestaurants.map((r: any, i: number) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700, color: i < 3 ? 'var(--gold-primary)' : 'var(--text-secondary)' }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{r.name}</div>
                          <code style={{ fontSize: '0.75rem', color: 'var(--gold-primary)' }}>{r.slug}</code>
                        </td>
                        <td>
                          <span className={`badge badge-${r.isActive ? 'active' : 'inactive'}`}>{r.isActive ? 'Active' : 'Inactive'}</span>
                        </td>
                        <td>{r.orders.toLocaleString('en-IN')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'Outfit, sans-serif' }}>
                          ₹{Number(r.revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          ₹{r.orders > 0 ? (r.revenue / r.orders).toFixed(2) : '0.00'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
