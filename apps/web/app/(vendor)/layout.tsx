'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { VendorContext } from './vendor-context'

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, logout, isAuthenticated } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const slug = params?.slug as string

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [lookupDone, setLookupDone] = useState(false)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?role=vendor')
    }
  }, [authLoading, isAuthenticated, router])

  // Resolve the restaurantId from the slug ALWAYS, ignoring localStorage.
  // This handles both:
  //  1. Vendor logged in normally (restaurantId matches their account)
  //  2. Super Admin browsing any restaurant's vendor portal
  useEffect(() => {
    if (!isAuthenticated || !slug) return

    async function resolveRestaurant() {
      try {
        // If the logged-in user's restaurantId matches the slug we can skip the lookup,
        // but it's safer to always confirm via slug → id mapping.
        const data = await api.lookupRestaurant(slug)
        setRestaurantId(data.id)
        setRestaurantName(data.name)
        setLookupError('')
      } catch (e: any) {
        setLookupError(e.message || 'Restaurant not found')
      } finally {
        setLookupDone(true)
      }
    }

    resolveRestaurant()
  }, [isAuthenticated, slug])

  if (authLoading || !lookupDone) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  if (!isAuthenticated || !user) return null

  if (lookupError || !restaurantId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <h1>Restaurant Not Found</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>
            {lookupError || `No restaurant found with slug "${slug}"`}
          </p>
          {user.role === 'SUPER_ADMIN' ? (
            <Link href="/admin" className="btn btn-primary">← Back to Admin</Link>
          ) : user.restaurantSlug ? (
            <Link href={`/vendor/${user.restaurantSlug}`} className="btn btn-primary">← Go to Dashboard</Link>
          ) : (
            <button className="btn btn-primary" onClick={logout}>← Back to Login</button>
          )}
        </div>
      </div>
    )
  }

  // Cross-tenant protection guard
  if (user.role !== 'SUPER_ADMIN' && user.restaurantId !== restaurantId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
          <h1>Access Denied</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>
            You do not have permission to access this restaurant's portal.
          </p>
          {user.restaurantSlug && (
            <Link href={`/vendor/${user.restaurantSlug}`} className="btn btn-primary">
              Go to Your Portal
            </Link>
          )}
        </div>
      </div>
    )
  }

  const base = `/vendor/${slug}`
  const navLinks = [
    { href: base, label: '📊 Dashboard', exact: true },
    { href: `${base}/revenue`, label: '💰 Revenue', exact: false },
    { href: `${base}/menu`, label: '🍽️ Menu', exact: false },
    { href: `${base}/customize`, label: '🎨 Customize Menu', exact: false },
    { href: `${base}/tables`, label: '📋 Tables & QR', exact: false },
    { href: `${base}/customers`, label: '👥 Customers & Loyalty', exact: false },
    { href: `${base}/loyalty`, label: '⭐ Loyalty Settings', exact: false },
    { href: `${base}/marketing`, label: '📣 Marketing', exact: false },
    { href: `${base}/kitchen`, label: '🍳 Kitchen', exact: false },
    { href: `${base}/settings`, label: '⚙️ Settings', exact: false },
  ]

  return (
    <VendorContext.Provider value={{ restaurantId, restaurantName, slug }}>
      <nav className="navbar">
        <div className="flex items-center gap-3">
          <span className="navbar-brand">🍽️ QR Saas</span>
          <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
            {restaurantName || slug}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="text-sm text-muted" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </span>
          {user.role === 'SUPER_ADMIN' && (
            <Link href="/admin" className="btn btn-secondary btn-sm">⚙️ Admin</Link>
          )}
          <button className="btn btn-secondary btn-sm" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="page-shell">
        <aside className="sidebar">
          {navLinks.map(l => {
            const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
            return (
              <Link key={l.href} href={l.href} className={`sidebar-link ${active ? 'active' : ''}`}>
                {l.label}
              </Link>
            )
          })}
          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            <a href={`/menu/${slug}`} className="sidebar-link" target="_blank" rel="noopener noreferrer">
              🔗 View Menu
            </a>
          </div>
        </aside>
        <main className="page-content" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Mobile sub-nav tab switcher */}
          <div className="mobile-nav-tabs">
            {navLinks.map(l => {
              const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`cat-tab ${active ? 'active' : ''}`}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.8rem',
                    borderRadius: '20px',
                    whiteSpace: 'nowrap',
                    lineHeight: '1.2'
                  }}
                >
                  {l.label}
                </Link>
              )
            })}
          </div>
          {children}
        </main>
      </div>

      {/* Global CSS to show mobile sub-nav on smaller devices */}
      <style jsx global>{`
        .mobile-nav-tabs {
          display: none;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border-subtle);
          margin-bottom: 1.25rem;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .mobile-nav-tabs::-webkit-scrollbar {
          display: none;
        }
        @media (max-width: 768px) {
          .mobile-nav-tabs {
            display: flex;
          }
        }
      `}</style>
    </VendorContext.Provider>
  )
}
