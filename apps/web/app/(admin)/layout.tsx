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
          <Link href="/admin" className={`sidebar-link ${pathname === '/admin' ? 'active' : ''}`}>
            🏠 Dashboard
          </Link>
          <Link href="/admin/restaurants" className={`sidebar-link ${pathname.startsWith('/admin/restaurants') ? 'active' : ''}`}>
            🏪 Restaurants
          </Link>
        </aside>
        <main className="page-content">
          {children}
        </main>
      </div>
    </>
  )
}
