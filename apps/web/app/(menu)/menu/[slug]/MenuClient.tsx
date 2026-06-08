'use client'
import { useState, useEffect, useRef } from 'react'
import { io as connectSocket } from 'socket.io-client'
import { api } from '@/lib/api'

interface MenuItem {
  id: string
  name: string
  description: string | null
  price: string
  imageUrl: string | null
}

interface Category {
  id: string
  name: string
  items: MenuItem[]
}

interface CartItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
}

interface Props {
  restaurant: {
    id: string
    name: string
    slug: string
    logoUrl: string | null
    address: string | null
    themeColor?: string | null
    menuTheme?: string | null
  }
  categories: Category[]
  tableId: string | null
  tableNumber: number | null
  qrToken: string | null
  restaurantId: string
}

type PageState = 'menu' | 'cart' | 'placing' | 'success'

export default function CustomerMenuClient({ restaurant, categories, tableId, tableNumber, qrToken, restaurantId }: Props) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [localCategories, setLocalCategories] = useState<Category[]>(categories)
  const [restaurantInfo, setRestaurantInfo] = useState(restaurant)
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || '')
  const [customerNote, setCustomerNote] = useState('')
  const [page, setPage] = useState<PageState>('menu')
  const [placedOrder, setPlacedOrder] = useState<any>(null)
  const [error, setError] = useState('')
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Customer CRM & Loyalty State
  const [customer, setCustomer] = useState<any>(null)
  const [showCheckInModal, setShowCheckInModal] = useState(false)
  const [showOffersModal, setShowOffersModal] = useState(false)
  const [activeOffers, setActiveOffers] = useState<any[]>([])
  const [selectedOffer, setSelectedOffer] = useState<any>(null)
  const [checkInName, setCheckInName] = useState('')
  const [checkInPhone, setCheckInPhone] = useState('')
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [phoneLookupMode, setPhoneLookupMode] = useState(false)
  const [lookupPhoneInput, setLookupPhoneInput] = useState('')
  const [checkInError, setCheckInError] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)

  const brandColor = restaurantInfo.themeColor || restaurant.themeColor || '#6c63ff'
  const brandTheme = restaurantInfo.menuTheme || restaurant.menuTheme || 'classic'

  // Dynamic VIP tier helper
  function getVipTier(points: number, visits: number) {
    if (points >= 1000 || visits >= 15) return { name: '👑 Platinum VIP', color: '#D4AF37' }
    if (points >= 400 || visits >= 8) return { name: '🌟 Gold Member', color: '#FFD700' }
    if (points >= 150 || visits >= 3) return { name: '✨ Silver Member', color: '#C0C0C0' }
    return { name: '🌱 Bronze Member', color: '#CD7F32' }
  }

  const vipTier = customer ? getVipTier(customer.loyaltyPoints, customer.visitCount) : null

  // Cart total calculations
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  // dynamic discount calculations
  let discountAmount = 0
  if (selectedOffer) {
    if (selectedOffer.discountType === 'PERCENTAGE') {
      discountAmount = (cartTotal * Number(selectedOffer.discountValue)) / 100
    } else {
      discountAmount = Number(selectedOffer.discountValue)
    }
    if (discountAmount > cartTotal) {
      discountAmount = cartTotal
    }
  }
  const finalCartTotal = cartTotal - discountAmount
  const estimatedPointsEarned = Math.floor(finalCartTotal * 0.1)

  const customStyleBlock = (
    <style>{`
      :root {
        --accent-primary: ${brandColor} !important;
        --accent-primary-hover: ${brandColor}ee !important;
      }
      ${brandTheme === 'midnight' ? `
        body {
          background-color: #0B0F19 !important;
          color: #F3F4F6 !important;
        }
        .menu-item-card, .card, .menu-categories-nav {
          background: #111827 !important;
          border-color: rgba(255,255,255,0.08) !important;
          color: #F3F4F6 !important;
        }
        .menu-item-name, h1, h2, h3, span {
          color: #F3F4F6 !important;
        }
        .menu-item-desc, p, .text-muted {
          color: #9CA3AF !important;
        }
      ` : ''}
      ${brandTheme === 'gilded' ? `
        body {
          background-color: #0F0F11 !important;
          color: #F5F5F0 !important;
          font-family: 'Outfit', 'Inter', sans-serif !important;
        }
        .menu-item-card, .card, .menu-categories-nav {
          background: #17171C !important;
          border-color: rgba(212, 175, 55, 0.15) !important;
          border-radius: 20px !important;
          color: #F5F5F0 !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
        }
        .menu-item-name, h1, h2, h3, span {
          color: #F5F5F0 !important;
        }
        .menu-item-desc, p, .text-muted {
          color: #A1A1AA !important;
        }
        .menu-item-price {
          color: #D4AF37 !important;
          font-weight: 800 !important;
        }
        .btn-primary, .qty-btn {
          background: linear-gradient(135deg, #D4AF37, #AA7C11) !important;
          color: #0F0F11 !important;
          box-shadow: 0 4px 15px rgba(212, 175, 55, 0.25) !important;
        }
        .cat-tab.active {
          background: #D4AF37 !important;
          border-color: #D4AF37 !important;
          color: #0F0F11 !important;
        }
      ` : ''}
      ${brandTheme === 'organic' ? `
        body {
          background-color: #F4F6F0 !important;
          color: #1F2937 !important;
          font-family: Georgia, serif !important;
        }
        .menu-item-card, .card, .menu-categories-nav {
          background: #FFFFFF !important;
          border-color: rgba(0,0,0,0.08) !important;
          border-radius: 24px !important;
        }
        .qty-btn {
          border-radius: 50% !important;
        }
      ` : ''}
      ${brandTheme === 'minimalist' ? `
        body {
          background-color: #FFFFFF !important;
          color: #000000 !important;
          font-family: monospace !important;
        }
        .menu-item-card, .card, .menu-categories-nav {
          background: #F9FAFB !important;
          border-color: #000000 !important;
          border-radius: 0px !important;
        }
        .btn, .qty-btn, .menu-item-card {
          border-radius: 0px !important;
        }
      ` : ''}

      /* Premium CRM Custom Styles */
      .loyalty-banner {
        background: linear-gradient(90deg, rgba(108,99,255,0.15) 0%, rgba(212,175,55,0.15) 100%);
        border: 1px dashed rgba(212,175,55,0.4);
        border-radius: 12px;
        padding: 0.75rem 1rem;
        margin: 1rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .loyalty-banner-active {
        background: linear-gradient(135deg, #1e1b4b 0%, #311042 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 1rem;
        margin: 1rem;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      }
      .modal-backdrop {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(15, 15, 20, 0.85);
        backdrop-filter: blur(8px);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
      }
      .crm-modal {
        background: #18181B;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 24px;
        width: 100%;
        max-width: 480px;
        padding: 2rem;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        color: #F4F4F5;
        animation: modalFadeIn 0.3s ease-out;
      }
      @keyframes modalFadeIn {
        from { opacity: 0; transform: translateY(20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .crm-input {
        background: #27272A;
        border: 1px solid #3F3F46;
        color: #FFFFFF;
        border-radius: 12px;
        padding: 0.75rem 1rem;
        width: 100%;
        margin-top: 0.35rem;
        font-size: 1rem;
        transition: border-color 0.2s;
      }
      .crm-input:focus {
        border-color: var(--accent-primary);
        outline: none;
      }
      .coupon-card {
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        padding: 0.75rem 1rem;
        margin-bottom: 0.75rem;
        background: #242427;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        transition: all 0.2s;
      }
      .coupon-card.selected {
        border-color: #D4AF37;
        background: rgba(212,175,55,0.05);
      }
      .coupon-card.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `}</style>
  )

  // ─── Socket.io Real-Time Menu Sync ─────────────────────────────
  useEffect(() => {
    if (!restaurantId) return

    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1').replace('/v1', '')
    const socket = connectSocket(apiUrl, {
      auth: { token: null },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    async function refetchMenu() {
      try {
        const data = await api.getPublicMenu(restaurant.slug)
        if (data?.categories) setLocalCategories(data.categories)
        if (data?.restaurant) {
          setRestaurantInfo(data.restaurant)
        }
      } catch (err) { console.warn('Menu refetch failed', err) }
    }

    socket.on('connect', () => {
      socket.emit('join-restaurant', { restaurantId })
    })

    // Full menu refresh signal (after any create/delete/update)
    socket.on('menu_changed', refetchMenu)

    // Optimistic item availability update (fast path for stock toggles)
    socket.on('item_updated', (updatedItem: any) => {
      setLocalCategories(prev => prev.map(cat => ({
        ...cat,
        items: cat.items
          .map((it: any) => it.id === updatedItem.id ? { ...it, ...updatedItem } : it)
          .filter((it: any) => it.isAvailable !== false || it.id !== updatedItem.id || updatedItem.isAvailable),
      })).map(cat => ({
        ...cat,
        items: cat.items.filter((it: any) => !(it.id === updatedItem.id && !updatedItem.isAvailable)),
      })))

      if (!updatedItem.isAvailable) {
        setCart(prev => {
          const inCart = prev.some(c => c.menuItemId === updatedItem.id)
          if (inCart) {
            alert(`⚠️ "${updatedItem.name}" is now out of stock and was removed from your cart.`)
            return prev.filter(c => c.menuItemId !== updatedItem.id)
          }
          return prev
        })
      }
      // Also do full refetch to ensure consistency
      refetchMenu()
    })

    // Real-time theme/customization updates
    socket.on('restaurant_updated', (info: any) => {
      setRestaurantInfo(prev => ({ ...prev, ...info }))
    })

    return () => { socket.disconnect() }
  }, [restaurantId, restaurant.slug])

  // ─── Load Customer and Offers ────────────────────────────────
  useEffect(() => {
    async function loadCustomerAndOffers() {
      // 1. Fetch active offers anyway
      try {
        const offers = await api.getActiveOffers(restaurant.slug)
        setActiveOffers(offers || [])
      } catch (err) {
        console.error('Failed to load active offers:', err)
      }

      // 2. Resolve customer (isolated strictly by restaurant slug)
      const stored = localStorage.getItem(`customer_${restaurant.slug}`)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed && parsed.phone) {
            const data = await api.lookupCustomer(restaurant.slug, parsed.phone)
            setCustomer(data)
            localStorage.setItem(`customer_${restaurant.slug}`, JSON.stringify(data))
          }
        } catch (err) {
          console.warn('Failed to resolve stored customer, clearing profile:', err)
          localStorage.removeItem(`customer_${restaurant.slug}`)
        }
      } else {
        const skipped = sessionStorage.getItem(`skipped_crm_${restaurant.slug}`)
        if (!skipped) {
          setShowCheckInModal(true)
        }
      }
    }

    loadCustomerAndOffers()
  }, [restaurant.slug])

  // ─── CRM Actions ─────────────────────────────────────────────
  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault()
    setCheckInError('')
    if (!checkInName.trim() || !checkInPhone.trim()) {
      setCheckInError('Please fill in both name and phone number.')
      return
    }
    setCheckingIn(true)
    try {
      const data = await api.checkInCustomer(restaurant.slug, checkInName.trim(), checkInPhone.trim(), consentMarketing)
      setCustomer(data)
      localStorage.setItem(`customer_${restaurant.slug}`, JSON.stringify(data))
      setShowCheckInModal(false)
      const offers = await api.getActiveOffers(restaurant.slug)
      setActiveOffers(offers || [])
      alert(`🎉 Welcome ${data.name}! You checked in successfully and received 50 free Welcome points!`)
    } catch (err: any) {
      setCheckInError(err.message || 'Failed to check in.')
    } finally {
      setCheckingIn(false)
    }
  }

  async function handlePhoneLookup(e: React.FormEvent) {
    e.preventDefault()
    setCheckInError('')
    if (!lookupPhoneInput.trim()) {
      setCheckInError('Please enter your phone number.')
      return
    }
    setCheckingIn(true)
    try {
      const data = await api.lookupCustomer(restaurant.slug, lookupPhoneInput.trim())
      setCustomer(data)
      localStorage.setItem(`customer_${restaurant.slug}`, JSON.stringify(data))
      setShowCheckInModal(false)
      const offers = await api.getActiveOffers(restaurant.slug)
      setActiveOffers(offers || [])
      alert(`🎉 Welcome back, ${data.name}! Your profile loaded successfully.`)
    } catch (err: any) {
      setCheckInError('No profile found with this phone number. Try registering!')
    } finally {
      setCheckingIn(false)
    }
  }

  function handleSkip() {
    sessionStorage.setItem(`skipped_crm_${restaurant.slug}`, 'true')
    setShowCheckInModal(false)
  }

  function handleSignOut() {
    if (confirm('Are you sure you want to sign out of your rewards profile?')) {
      localStorage.removeItem(`customer_${restaurant.slug}`)
      setCustomer(null)
      setSelectedOffer(null)
    }
  }

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id)
      if (existing) {
        return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: Number(item.price), quantity: 1 }]
    })
  }

  function removeFromCart(menuItemId: string) {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === menuItemId)
      if (!existing) return prev
      if (existing.quantity === 1) return prev.filter(c => c.menuItemId !== menuItemId)
      return prev.map(c => c.menuItemId === menuItemId ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  function getQty(menuItemId: string) {
    return cart.find(c => c.menuItemId === menuItemId)?.quantity || 0
  }

  function scrollToCategory(id: string) {
    setActiveCategory(id)
    categoryRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function placeOrder() {
    setError('')
    setPage('placing')
    try {
      const order = await api.placeOrder({
        restaurantId,
        tableId,
        qrToken,
        customerNote: customerNote.trim() || undefined,
        customerId: customer?.id || undefined,
        offerId: selectedOffer?.id || undefined,
        items: cart.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
      })
      setPlacedOrder(order)
      setCart([])
      setSelectedOffer(null)
      setPage('success')

      // Sync fresh loyalty points balance
      if (customer) {
        try {
          const fresh = await api.lookupCustomer(restaurant.slug, customer.phone)
          setCustomer(fresh)
          localStorage.setItem(`customer_${restaurant.slug}`, JSON.stringify(fresh))
        } catch {}
      }
    } catch (e: any) {
      setError(e.message || 'Failed to place order')
      setPage('cart')
    }
  }

  // ─── Success Screen ─────────────────────────────────────────
  if (page === 'success') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
        {customStyleBlock}
        <div style={{ maxWidth: '400px', width: '100%' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'slideUp 0.5s ease' }}>✅</div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Order Placed!</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Your order is on its way to the kitchen. Sit back and relax!
          </p>

          <div className="card" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span className="font-bold">Order Confirmation</span>
              {tableNumber && <span className="badge badge-active">Table {tableNumber}</span>}
            </div>
            {placedOrder?.items.map((item: any) => (
              <div key={item.id} className="order-item-row">
                <span>{item.nameSnapshot}</span>
                <span style={{ color: 'var(--text-secondary)' }}>×{item.quantity} · ₹{Number(item.subtotal).toFixed(2)}</span>
              </div>
            ))}
            {placedOrder?.discountAmount && Number(placedOrder.discountAmount) > 0 && (
              <div className="order-item-row" style={{ color: '#D4AF37' }}>
                <span>Offer Discount Applied ({placedOrder.discountCode})</span>
                <span>-₹{Number(placedOrder.discountAmount).toFixed(2)}</span>
              </div>
            )}
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem' }}>
              <span>Paid Total</span>
              <span style={{ color: 'var(--accent-primary)', fontFamily: 'Outfit, sans-serif' }}>
                ₹{Number(placedOrder?.totalAmount).toFixed(2)}
              </span>
            </div>
          </div>

          {customer && (
            <div className="card" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', marginBottom: '1.5rem', textAlign: 'left' }}>
              <h4 style={{ fontWeight: 700, color: '#D4AF37', margin: '0 0 0.25rem 0' }}>⭐ Loyalty Account Updated!</h4>
              <p style={{ fontSize: '0.85rem', margin: 0, color: 'var(--text-secondary)' }}>
                You earned <strong>{Math.floor(Number(placedOrder?.totalAmount) * 0.1)} points</strong> on this order (10% cashback). Check your active rewards below!
              </p>
            </div>
          )}

          <button className="btn btn-primary btn-full" onClick={() => setPage('menu')}>
            Order More →
          </button>
        </div>
      </div>
    )
  }

  // ─── Cart View ──────────────────────────────────────────────
  if (page === 'cart' || page === 'placing') {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {customStyleBlock}
        <div className="flex items-center gap-2" style={{ marginBottom: '1.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setPage('menu')}>← Back</button>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Your Order {tableNumber ? `· Table ${tableNumber}` : ''}</h2>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {cart.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🛒</div>
            <div className="empty-state-title">Cart is empty</div>
            <div className="empty-state-desc">Add items from the menu</div>
          </div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              {cart.map(item => (
                <div key={item.menuItemId} className="order-item-row">
                  <span style={{ fontWeight: 600 }}>{item.name}</span>
                  <div className="flex items-center gap-2">
                    <button className="qty-btn" onClick={() => removeFromCart(item.menuItemId)}>−</button>
                    <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</span>
                    <button className="qty-btn" onClick={() => addToCart({ id: item.menuItemId, name: item.name, price: String(item.price), description: null, imageUrl: null })}>+</button>
                    <span style={{ minWidth: '64px', textAlign: 'right', color: 'var(--accent-primary)', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                <span>Subtotal</span>
                <span>₹{cartTotal.toFixed(2)}</span>
              </div>
              {selectedOffer && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D4AF37', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                  <span>Discount ({selectedOffer.code})</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem' }}>
                <span>Total Amount</span>
                <span style={{ color: 'var(--accent-primary)', fontFamily: 'Outfit, sans-serif' }}>
                  ₹{finalCartTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Loyalty Coupon Selector */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🎁 Apply Offers & Rewards
              </label>
              {!customer ? (
                <div className="alert alert-info" style={{ fontSize: '0.85rem', padding: '0.75rem', marginTop: '0.5rem' }}>
                  💡 <span style={{ textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }} onClick={() => setShowCheckInModal(true)}>Log in / Sign up</span> to unlock special offers and loyalty points!
                </div>
              ) : (
                <div style={{ marginTop: '0.5rem' }}>
                  {/* Subtle premium customer profile card */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    fontSize: '0.85rem'
                  }}>
                    <div>
                      👤 Logged in as: <strong>{customer.name}</strong> ({customer.phone})
                      <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: vipTier?.color || '#90A4AE', color: '#0F0F11', borderRadius: '12px', marginLeft: '0.5rem', fontWeight: 800 }}>
                        {vipTier?.name || 'Member'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ color: '#D4AF37', fontWeight: 800 }}>⭐ {customer.loyaltyPoints} pts</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', textDecoration: 'underline' }} onClick={handleSignOut}>
                        Sign Out
                      </span>
                    </div>
                  </div>

                  {activeOffers.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No offers available currently.</p>
                  ) : (
                    activeOffers.map(offer => {
                      const pointsNeeded = offer.pointsRequired
                      const hasEnough = customer.loyaltyPoints >= pointsNeeded
                      const isSelected = selectedOffer?.id === offer.id

                      return (
                        <div
                          key={offer.id}
                          className={`coupon-card ${isSelected ? 'selected' : ''} ${!hasEnough ? 'disabled' : ''}`}
                          onClick={() => {
                            if (!hasEnough) return
                            if (isSelected) {
                              setSelectedOffer(null)
                            } else {
                              setSelectedOffer(offer)
                            }
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: isSelected ? '#D4AF37' : '#FFF' }}>
                              {offer.title} {pointsNeeded > 0 && <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', background: '#D4AF37', color: '#000', borderRadius: '4px', marginLeft: '0.5rem' }}>{pointsNeeded} pts</span>}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{offer.description}</div>
                          </div>
                          <div>
                            {pointsNeeded > 0 && !hasEnough ? (
                              <span style={{ fontSize: '0.75rem', color: '#EF4444' }}>Requires {pointsNeeded} pts</span>
                            ) : isSelected ? (
                              <span style={{ color: '#D4AF37', fontWeight: 800 }}>✓ Applied</span>
                            ) : (
                              <span style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600 }}>Apply</span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                  {customer && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Your points balance: <strong>{customer.loyaltyPoints} pts</strong></span>
                      {selectedOffer && <span>Points to deduct: <strong style={{ color: '#EF4444' }}>-{selectedOffer.pointsRequired} pts</strong></span>}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Special instructions (optional)</label>
              <textarea
                value={customerNote}
                onChange={e => setCustomerNote(e.target.value)}
                placeholder="Allergies, preferences, special requests..."
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            {customer && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.75rem 1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem' }}>🎉 Points you'll earn on this order:</span>
                <strong style={{ color: 'var(--accent-primary)' }}>+{estimatedPointsEarned} pts</strong>
              </div>
            )}

            {!tableId && (
              <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                ℹ️ Browsing without a table QR code. Order submission requires a valid QR scan.
              </div>
            )}

            <button
              id="place-order-btn"
              className="btn btn-primary btn-full btn-lg"
              onClick={placeOrder}
              disabled={page === 'placing' || cart.length === 0 || !tableId}
            >
              {page === 'placing' ? '⏳ Placing Order...' : `Place Order · ₹${finalCartTotal.toFixed(2)}`}
            </button>
          </>
        )}
      </div>
    )
  }

  // ─── Menu View ──────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', paddingBottom: cartCount > 0 ? '100px' : '2rem' }}>
      {customStyleBlock}

      {/* Restaurant Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-card))',
        padding: '2rem 1.5rem',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{restaurantInfo.name || restaurant.name}</h1>
        {(restaurantInfo.address || restaurant.address) && <p style={{ fontSize: '0.875rem' }}>{restaurantInfo.address || restaurant.address}</p>}
        {tableNumber && (
          <span className="badge badge-active" style={{ marginTop: '0.75rem', display: 'inline-flex' }}>
            📋 Table {tableNumber}
          </span>
        )}
        {!tableNumber && (
          <span className="badge badge-inactive" style={{ marginTop: '0.75rem', display: 'inline-flex' }}>
            👀 Browse Mode
          </span>
        )}
      </div>

      {/* Category Nav */}
      <div className="menu-categories-nav" style={{ padding: '0.75rem 1rem' }}>
        {localCategories.map(cat => (
          <button
            key={cat.id}
            className={`cat-tab ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => scrollToCategory(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Menu Items */}
      <div style={{ padding: '0 1rem' }}>
        {localCategories.map(cat => (
          <div
            key={cat.id}
            ref={el => { categoryRefs.current[cat.id] = el }}
            style={{ marginBottom: '2rem', scrollMarginTop: '120px' }}
          >
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              {cat.name}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {cat.items.map(item => {
                const qty = getQty(item.id)
                return (
                  <div key={item.id} className="menu-item-card">
                    <div style={{ flex: 1 }}>
                      <div className="menu-item-name">{item.name}</div>
                      {item.description && <div className="menu-item-desc">{item.description}</div>}
                      <div className="menu-item-price" style={{ marginTop: '0.5rem' }}>
                        ₹{Number(item.price).toFixed(2)}
                      </div>
                    </div>
                    <div className="quantity-control">
                      {qty > 0 ? (
                        <>
                          <button className="qty-btn" onClick={() => removeFromCart(item.id)}>−</button>
                          <span style={{ fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{qty}</span>
                          <button className="qty-btn" onClick={() => addToCart(item)}>+</button>
                        </>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => addToCart(item)}
                          style={{ borderRadius: '50%', width: '36px', height: '36px', padding: 0, fontSize: '1.2rem' }}
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Cart Bar */}
      {cartCount > 0 && (
        <div className="cart-bar" onClick={() => setPage('cart')}>
          <div className="flex items-center gap-2">
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.875rem',
            }}>
              {cartCount}
            </span>
            <span className="cart-bar-label">View Order</span>
          </div>
          <span className="cart-bar-total">₹{finalCartTotal.toFixed(2)}</span>
        </div>
      )}

      {/* ─── CHECK IN / LOGIN MODAL overlay ────────────────────────── */}
      {showCheckInModal && (
        <div className="modal-backdrop">
          <div className="crm-modal">
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '3rem' }}>🎁</div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.5rem 0' }}>Join Loyalty Rewards!</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                Scan, Order, and Uncover special offers! Join now to receive <strong>50 free Welcome points</strong> and earn rewards.
              </p>
            </div>

            {checkInError && (
              <div className="alert alert-error" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                ⚠️ {checkInError}
              </div>
            )}

            {!phoneLookupMode ? (
              /* Registration Form */
              <form onSubmit={handleCheckIn}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label>Full Name</label>
                  <input
                    type="text"
                    className="crm-input"
                    placeholder="Enter your name"
                    value={checkInName}
                    onChange={e => setCheckInName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    className="crm-input"
                    placeholder="Enter phone number"
                    value={checkInPhone}
                    onChange={e => setCheckInPhone(e.target.value)}
                    required
                  />
                </div>
                {/* WhatsApp Marketing Consent */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                    padding: '0.75rem',
                    background: 'rgba(16,185,129,0.06)',
                    border: '1px solid rgba(16,185,129,0.15)',
                    borderRadius: '10px',
                    marginBottom: '1.25rem',
                    cursor: 'pointer',
                  }}
                  onClick={() => setConsentMarketing(v => !v)}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '5px',
                      border: `2px solid ${consentMarketing ? '#10B981' : '#4B5563'}`,
                      background: consentMarketing ? '#10B981' : 'transparent',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: '1px',
                      transition: 'all 0.15s',
                    }}
                  >
                    {consentMarketing && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 900 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
                    I agree to receive offers, promotions and updates via WhatsApp from this restaurant. (Optional)
                  </span>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={checkingIn}
                  style={{ marginBottom: '0.75rem' }}
                >
                  {checkingIn ? '⏳ Processing...' : 'Join & Claim Rewards'}
                </button>
                <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Already a member? </span>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 700, cursor: 'pointer' }} onClick={() => { setPhoneLookupMode(true); setCheckInError(''); }}>
                    Log In / Lookup
                  </span>
                </div>
              </form>
            ) : (
              /* Login/Lookup Form */
              <form onSubmit={handlePhoneLookup}>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>Your Phone Number (ID)</label>
                  <input
                    type="tel"
                    className="crm-input"
                    placeholder="Enter phone number to lookup"
                    value={lookupPhoneInput}
                    onChange={e => setLookupPhoneInput(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={checkingIn}
                  style={{ marginBottom: '0.75rem' }}
                >
                  {checkingIn ? '⏳ Searching...' : 'Lookup Profile'}
                </button>
                <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>New here? </span>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 700, cursor: 'pointer' }} onClick={() => { setPhoneLookupMode(false); setCheckInError(''); }}>
                    Sign Up
                  </span>
                </div>
              </form>
            )}

            <div className="divider" style={{ margin: '1.5rem 0' }} />
            <button className="btn btn-secondary btn-full" onClick={handleSkip}>
              Skip & Browse Menu Anonymously
            </button>
          </div>
        </div>
      )}

      {/* ─── OFFERS & LOYALTY MODAL overlay ─────────────────────────── */}
      {showOffersModal && customer && (
        <div className="modal-backdrop" onClick={() => setShowOffersModal(false)}>
          <div className="crm-modal" onClick={e => e.stopPropagation()} style={{ border: '1px solid rgba(212, 175, 55, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>🎁 Offers & Rewards</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowOffersModal(false)}>Close</button>
            </div>

            <div style={{ background: '#27272A', padding: '1rem', borderRadius: '16px', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Loyalty Profile</div>
                  <strong style={{ fontSize: '1.1rem' }}>{customer.name}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.1rem' }}>Phone ID: {customer.phone}</div>
                </div>
                <div style={{ background: vipTier?.color, color: '#0F0F11', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800 }}>
                  {vipTier?.name}
                </div>
              </div>

              <div className="divider" style={{ margin: '0.75rem 0', opacity: 0.2 }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Total Visits:</span>
                <strong>{customer.visitCount} visits</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Current Points:</span>
                <strong style={{ color: '#D4AF37' }}>⭐ {customer.loyaltyPoints} pts</strong>
              </div>
            </div>

            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--accent-primary)' }}>Available Offers</h4>
            <div style={{ maxHeight: '240px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {activeOffers.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>No active offers configured currently.</p>
              ) : (
                activeOffers.map(offer => {
                  const pointsNeeded = offer.pointsRequired
                  const hasEnough = customer.loyaltyPoints >= pointsNeeded
                  return (
                    <div key={offer.id} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '0.75rem', marginBottom: '0.5rem', background: '#242427', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: '#FFF' }}>{offer.title}</strong>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>{offer.description}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {pointsNeeded > 0 ? (
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '0.15rem 0.4rem',
                            background: hasEnough ? '#10B981' : '#EF4444',
                            color: '#FFF',
                            borderRadius: '4px',
                            fontWeight: 700,
                            whiteSpace: 'nowrap'
                          }}>
                            {pointsNeeded} pts
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#6C63FF', fontWeight: 600 }}>FREE</span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1.25rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
              💡 <strong>How it works:</strong> You earn 10% cashback as loyalty points on every order you place. You can redeem point-based offers in your cart during checkout. Simply lookup your profile using your phone number next time you visit!
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
