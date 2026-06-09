'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isAuthenticated } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== 'SUPER_ADMIN')) {
      router.replace('/login?role=admin')
    }
  }, [loading, isAuthenticated, user, router])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="loading-spinner" />
    </div>
  )
  if (!user || user.role !== 'SUPER_ADMIN') return null

  const navLinks = [
    { href: '/admin', label: '🏢 Restaurants', exact: true },
    { href: '/admin/vendors', label: '👥 Vendors', exact: false },
    { href: '/admin/marketing', label: '📣 Marketing', exact: false },
    { href: '/admin/analytics', label: '📊 Platform Analytics', exact: false },
    { href: '/admin/billing', label: '💰 Platform Revenue', exact: false },
    { href: '/admin/settings', label: '⚙️ Platform Settings', exact: false },
  ]

  return (
    <>
      <nav className="navbar">
        <span className="navbar-brand">⚙️ QR Saas Admin</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="text-sm text-muted">{user.email}</span>
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
        </aside>
        <main className="page-content">
          {children}
        </main>
      </div>
    </>
  )
}
