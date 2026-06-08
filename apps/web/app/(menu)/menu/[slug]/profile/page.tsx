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
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  
  // Tab control: 'orders' | 'rewards' | 'claims'
  const [activeTab, setActiveTab] = useState<'orders' | 'rewards' | 'claims'>('orders')
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [newClaimCode, setNewClaimCode] = useState<string | null>(null)

  useEffect(() => {
    if (!slug || !phone) {
      setError('No phone number provided. Scan the QR code to access your profile.')
      setLoading(false)
      return
    }

    refreshData()
  }, [slug, phone])

  async function refreshData() {
    try {
      const [profileData, offersData] = await Promise.all([
        api.getCustomerProfile(slug, phone),
        api.getActiveOffers(slug),
      ])
      setProfile(profileData)
      setOffers(offersData)
    } catch (e: any) {
      setError(e.message || 'Profile lookup failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleRedeem(offer: any) {
    if (profile.loyaltyPoints < offer.pointsRequired) {
      alert(`You need ${offer.pointsRequired} points to redeem this offer.`)
      return
    }

    if (!confirm(`Are you sure you want to redeem "${offer.title}" for ${offer.pointsRequired} points?`)) {
      return
    }

    setClaimingId(offer.id)
    try {
      const claim = await api.claimReward(slug, { phone, offerId: offer.id })
      setNewClaimCode(claim.claimCode)
      setSuccess(`Successfully claimed reward! Show code: ${claim.claimCode} at the counter.`)
      // Refresh points and claims list
      await refreshData()
    } catch (err: any) {
      alert(err.message || 'Failed to claim reward')
    } finally {
      setClaimingId(null)
    }
  }

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
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Loyalty Points', value: profile.loyaltyPoints, icon: '⭐', color: '#D4AF37' },
          { label: 'Visits', value: profile.visitCount, icon: '🍽️', color: 'var(--accent-blue)' },
        ].map(s => (
          <div key={s.label} style={{ padding: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: s.color, fontFamily: 'Outfit, sans-serif' }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Loyalty Wallet Card */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #312152)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Available Points</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#D4AF37', fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>
              {profile.loyaltyPoints}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Worth</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
              ₹{(profile.loyaltyPoints * 0.1).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Progress to next tier */}
        {pointsToNextTier > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.3rem' }}>
              <span>{profile.loyaltyPoints} pts</span>
              <span>{pointsToNextTier} pts to {nextTierName}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '10px', height: '5px', overflow: 'hidden' }}>
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
      </div>

      {/* Success Modal / Banner */}
      {success && (
        <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid var(--accent-green)', borderRadius: '16px', padding: '1rem', marginBottom: '1.5rem', position: 'relative' }}>
          <div style={{ fontWeight: 700, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            🎉 Reward Redeemed!
          </div>
          <p style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: 'var(--text-primary)' }}>
            Present the claim code below to your waiter to get your discount.
          </p>
          {newClaimCode && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.75rem' }}>
              <div style={{ background: 'var(--bg-secondary)', border: '2px dashed #D4AF37', borderRadius: '8px', padding: '0.5rem 1.5rem', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '2px', color: '#D4AF37', fontFamily: 'monospace' }}>
                {newClaimCode}
              </div>
            </div>
          )}
          <button
            onClick={() => { setSuccess(''); setNewClaimCode(null) }}
            style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-secondary)' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs Selector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: '10px', marginBottom: '1.25rem' }}>
        {[
          { id: 'orders', label: '🧾 Orders' },
          { id: 'rewards', label: '⭐ Rewards' },
          { id: 'claims', label: '🎁 Claims' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            style={{
              padding: '0.5rem 0.25rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.8rem',
              background: activeTab === t.id ? 'var(--bg-card)' : 'transparent',
              color: activeTab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === t.id ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Orders */}
      {activeTab === 'orders' && (
        <div>
          {profile.orders?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              No orders yet. Start ordering to earn points!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {profile.orders?.map((order: any) => (
                <div
                  key={order.id}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', overflow: 'hidden' }}
                >
                  <div
                    style={{ padding: '0.85rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Table {order.tableNumber}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: 'var(--accent-green)', fontSize: '0.95rem', fontFamily: 'Outfit, sans-serif' }}>
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
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.8rem' }}>
                          <span>{item.nameSnapshot} ×{item.quantity}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>₹{Number(item.subtotal).toFixed(2)}</span>
                        </div>
                      ))}
                      <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.85rem' }}>
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
      )}

      {/* Tab: Rewards (Offers list to claim) */}
      {activeTab === 'rewards' && (
        <div>
          {offers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              No available rewards offers right now. Check back later!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {offers.map(offer => {
                const canClaim = profile.loyaltyPoints >= offer.pointsRequired
                return (
                  <div
                    key={offer.id}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '16px',
                      padding: '1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: canClaim ? 1 : 0.75,
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: '0.75rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        🎁 {offer.title}
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        {offer.description}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(212,175,55,0.12)', color: '#D4AF37', fontWeight: 700 }}>
                          ⭐ {offer.pointsRequired} pts
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          Code: {offer.code}
                        </span>
                      </div>
                    </div>
                    <button
                      className={`btn btn-sm ${canClaim ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleRedeem(offer)}
                      disabled={!canClaim || claimingId === offer.id}
                      style={{
                        minWidth: '80px',
                        fontSize: '0.75rem',
                        padding: '0.4rem 0.8rem',
                        cursor: canClaim ? 'pointer' : 'not-allowed',
                        background: canClaim ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                        borderColor: canClaim ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      }}
                    >
                      {claimingId === offer.id ? 'Claiming...' : 'Redeem'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Claims History */}
      {activeTab === 'claims' && (
        <div>
          {profile.claims?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              No reward claims yet. Redeem your points in the "Rewards" tab!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {profile.claims?.map((claim: any) => {
                const badgeColor = claim.status === 'APPROVED' ? 'var(--accent-green)' : claim.status === 'REJECTED' ? 'var(--accent-red)' : 'var(--gold-primary)'
                const badgeBg = claim.status === 'APPROVED' ? 'rgba(16,185,129,0.1)' : claim.status === 'REJECTED' ? 'rgba(239,68,68,0.1)' : 'rgba(212,175,55,0.1)'

                return (
                  <div
                    key={claim.id}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '16px',
                      padding: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{claim.offerTitle}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Claimed {new Date(claim.createdAt).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '12px',
                          fontWeight: 700,
                          color: badgeColor,
                          background: badgeBg,
                          border: `1px solid ${badgeColor}33`,
                        }}
                      >
                        {claim.status}
                      </span>
                    </div>

                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Points Spent: <strong style={{ color: '#D4AF37' }}>{claim.pointsRequired} pts</strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Claim Code</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1rem', color: claim.status === 'APPROVED' ? 'var(--text-secondary)' : '#D4AF37' }}>
                          {claim.claimCode}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <a href={`/menu/${slug}`} className="btn btn-secondary">← Back to Menu</a>
      </div>
    </div>
  )
}
