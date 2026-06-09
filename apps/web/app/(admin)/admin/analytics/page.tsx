'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

// Simple SVG Line Chart for Revenue Trend
function TrendChart({ data }: { data: { date: string; revenue: number; orders: number }[] }) {
  if (!data || data.length === 0) return <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>No Trend Data</div>
  
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
  const maxRev = Math.max(...sorted.map(d => d.revenue), 1)
  const width = 600
  const height = 160
  const pad = 15

  const points = sorted.map((d, i) => ({
    x: pad + (i / Math.max(sorted.length - 1, 1)) * (width - pad * 2),
    y: height - pad - ((d.revenue / maxRev) * (height - pad * 2)),
    ...d
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold-primary)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--gold-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#trendGrad)" />
      <path d={pathD} fill="none" stroke="var(--gold-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--gold-primary)" />
      ))}
    </svg>
  )
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const d = await api.getGlobalAnalytics()
      setData(d)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch global platform analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function handleExportPlatformCSV() {
    setExporting(true)
    const url = api.exportPlatformAnalytics()
    const a = document.createElement('a')
    a.href = url
    a.download = `platform_analytics_${Date.now()}.csv`
    a.click()
    setTimeout(() => setExporting(false), 1500)
  }

  function handleExportRestaurantsCSV() {
    const url = api.exportRestaurants()
    const a = document.createElement('a')
    a.href = url
    a.download = `restaurants_export_${Date.now()}.csv`
    a.click()
  }

  if (loading) return <div className="loading-spinner" />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>📊 Platform Analytics</h1>
          <p>Deeper business intelligence, growth metrics, and charts for Super Admins</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={handleExportRestaurantsCSV}>🏪 Export Restaurants CSV</button>
          <button className="btn btn-gold" onClick={handleExportPlatformCSV} disabled={exporting}>
            {exporting ? '⏳ Exporting…' : '📊 Export Platform Stats CSV'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {data && (
        <>
          <div className="grid-4" style={{ marginBottom: '2rem' }}>
            <div className="stat-card">
              <div className="stat-value">₹{Number(data.totalRevenue).toLocaleString('en-IN')}</div>
              <div className="stat-label">Total GTV (Gross Transaction Value)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--gold-primary)' }}>₹{Number(data.marketingRevenue || 0).toLocaleString('en-IN')}</div>
              <div className="stat-label">Marketing Platform Revenue</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--accent-green)' }}>{data.totalRestaurants}</div>
              <div className="stat-label">Subscribed Tenants</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>{data.totalCustomers}</div>
              <div className="stat-label">Total Direct Customers</div>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: '2rem' }}>
            {/* Chart Card */}
            <div className="card">
              <h2>📈 Platform Sales Trend (Last 30 Days)</h2>
              <div style={{ height: '200px', marginTop: '1.5rem' }}>
                <TrendChart data={data.revenueByDay || []} />
              </div>
              {data.revenueByDay?.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  <span>{data.revenueByDay[0]?.date}</span>
                  <span>{data.revenueByDay[data.revenueByDay.length - 1]?.date}</span>
                </div>
              )}
            </div>

            {/* Performance KPI Table */}
            <div className="card">
              <h2>⚡ Platform Key Performance Indicators (KPIs)</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
                <div className="flex justify-between" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <span className="text-muted">Average Order Value (AOV)</span>
                  <span style={{ fontWeight: 700 }}>₹{Number(data.avgOrderValue).toFixed(2)}</span>
                </div>
                <div className="flex justify-between" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <span className="text-muted">Today transaction count</span>
                  <span style={{ fontWeight: 700 }}>{data.todayOrders} orders</span>
                </div>
                <div className="flex justify-between" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <span className="text-muted">Today GTV Sales volume</span>
                  <span style={{ fontWeight: 700 }}>₹{Number(data.todayRevenue).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <span className="text-muted">Weekly transaction count</span>
                  <span style={{ fontWeight: 700 }}>{data.weekOrders} orders</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Monthly GTV Sales volume</span>
                  <span style={{ fontWeight: 700 }}>₹{Number(data.monthRevenue).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top restaurants list */}
          <div className="card">
            <h2>🏆 Top Performing Restaurants by Sales GTV</h2>
            <div className="table-wrapper" style={{ marginTop: '1.25rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Status</th>
                    <th>Total Orders</th>
                    <th style={{ textAlign: 'right' }}>Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topRestaurants?.map((r: any, idx: number) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td><code>{r.slug}</code></td>
                      <td>
                        <span className={`badge badge-${r.isActive ? 'active' : 'inactive'}`}>{r.isActive ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td>{r.orders}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-green)' }}>
                        ₹{Number(r.revenue).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
