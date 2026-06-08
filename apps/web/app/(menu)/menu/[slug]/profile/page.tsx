'use client'
import { useState, useEffect } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import { api } from '@/lib/api'

function getVipTier(points: number, visits: number) {
  if (points >= 1000 || visits >= 15) return { name: '👑 Platinum VIP', color: '#D4AF37', bg: 'linear-gradient(135deg, #1a1400, #2d2200)' }
  if (points >= 400 || visits >= 8) return { name: '🌟 Gold Member', color: '#FFD700', bg: 'linear-gradient(135deg, #1a1500, #2a2200)' }
  if (points >= 150 || visits >= 3) return { name: '✨ Silver Member', color: '#C0C0C0', bg: 'linear-gradient(135deg, #161618, #202022)' }
  return { name: '🌱 Bronze Member', color: '#CD7F32', bg: 'linear-gradient(135deg, #120d00, #1e1400)' }
}

export default function CustomerProfilePage() {
  const params = useParams()
  const slug = params?.slug as string
  const searchParams = useSearchParams()
  const phone = searchParams.get('phone') || ''

  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  useEffect(() => {
    if (!slug || !phone) {
      setError('No phone number provided. Scan the QR code to access your profile.')
      setLoading(false)
      return
    }

    api.getCustomerProfile(slug, phone)
      .then(setProfile)
      .catch((e: any) => setError(e.message || 'Profile not found'))
      .finally(() => setLoading(false))
  }, [slug, phone])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="loading-spinner" />
    </div>
  )

  if (error || !profile) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👤</div>
      <h1 style={{ marginBottom: '0.5rem' }}>Profile Not Found</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{error || 'Please check in at the restaurant to create your profile.'}</p>
      <a href={`/menu/${slug}`} className="btn btn-primary">← Back to Menu</a>
    </div>
  )

  const vip = getVipTier(profile.loyaltyPoints, profile.visitCount)
  const initial = profile.name?.charAt(0).toUpperCase() || '?'
  const pointsToNextTier = profile.loyaltyPoints >= 1000 ? 0
    : profile.loyaltyPoints >= 400 ? 1000 - profile.loyaltyPoints
    : profile.loyaltyPoints >= 150 ? 400 - profile.loyaltyPoints
    : 150 - profile.loyaltyPoints

  const nextTierName = profile.loyaltyPoints >= 1000 ? 'Max Tier' :
    profile.loyaltyPoints >= 400 ? 'Platinum' :
    profile.loyaltyPoints >= 150 ? 'Gold' : 'Silver'

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Outfit, Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 1rem',
          background: `linear-gradient(135deg, ${vip.color}, ${vip.color}88)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', fontWeight: 800, color: '#000', boxShadow: `0 4px 20px ${vip.color}44`,
        }}>
          {initial}
        </div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{profile.name}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{profile.phone}</p>
        <span style={{ display: 'inline-block', marginTop: '0.5rem', padding: '0.25rem 1rem', borderRadius: '20px', background: vip.bg, color: vip.color, fontWeight: 700, fontSize: '0.875rem', border: `1px solid ${vip.color}44` }}>
          {vip.name}
        </span>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Loyalty Points', value: profile.loyaltyPoints, icon: '⭐', color: '#D4AF37' },
          { label: 'Total Orders', value: profile.totalOrders, icon: '🧾', color: 'var(--accent-primary)' },
          { label: 'Total Spend', value: `₹${Number(profile.totalSpend).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, icon: '💰', color: 'var(--accent-green)' },
          { label: 'Visits', value: profile.visitCount, icon: '🍽️', color: 'var(--accent-blue)' },
        ].map(s => (
          <div key={s.label} style={{ padding: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, fontFamily: 'Outfit, sans-serif' }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Loyalty Wallet */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #312152)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>Available Points</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#D4AF37', fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>
              {profile.loyaltyPoints}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>Worth</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
              ₹{(profile.loyaltyPoints * 0.1).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Progress to next tier */}
        {pointsToNextTier > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>
              <span>{profile.loyaltyPoints} pts</span>
              <span>{pointsToNextTier} pts to {nextTierName}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '10px', height: '6px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: '10px',
                background: `linear-gradient(90deg, ${vip.color}, ${vip.color}88)`,
                width: `${Math.min(100, (profile.loyaltyPoints / (profile.loyaltyPoints + pointsToNextTier)) * 100)}%`,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        )}

        <div style={{ marginTop: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
          💡 Redeem your points on your next order for instant discounts!
        </div>
      </div>

      {/* Member Since */}
      <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-secondary)', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Member Since</span>
        <strong>{new Date(profile.memberSince).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
      </div>

      {/* Order History */}
      <div>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>🧾 Order History</h2>
        {profile.orders?.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            No orders yet. Start ordering to build your history!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {profile.orders?.map((order: any) => (
              <div
                key={order.id}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', overflow: 'hidden' }}
              >
                <div
                  style={{ padding: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>Table {order.tableNumber}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'Outfit, sans-serif' }}>
                      ₹{Number(order.totalAmount).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {expandedOrder === order.id ? '▲ Hide' : '▼ Details'}
                    </div>
                  </div>
                </div>

                {expandedOrder === order.id && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '0.75rem 1rem', background: 'var(--bg-secondary)' }}>
                    {order.items?.map((item: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', fontSize: '0.875rem' }}>
                        <span>{item.nameSnapshot} ×{item.quantity}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>₹{Number(item.subtotal).toFixed(2)}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>Total</span>
                      <span style={{ color: 'var(--accent-primary)' }}>₹{Number(order.totalAmount).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <a href={`/menu/${slug}`} className="btn btn-secondary">← Back to Menu</a>
      </div>
    </div>
  )
}
