'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, isAuthenticated, user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const role = searchParams.get('role')

  useEffect(() => {
    if (isAuthenticated && user) {
      if (role === 'vendor' && user.role === 'SUPER_ADMIN') return
      if (role === 'admin' && user.role !== 'SUPER_ADMIN') return

      if (user.role === 'SUPER_ADMIN') router.replace('/admin')
      else if (user.restaurantSlug) router.replace(`/vendor/${user.restaurantSlug}`)
      else if (user.restaurantId) router.replace(`/vendor/test-kitchen`)
    }
  }, [isAuthenticated, user, router, role])

  // Pre-fill credentials for demo
  useEffect(() => {
    if (role === 'admin') { setEmail('admin@qrsaas.com'); setPassword('admin123') }
    if (role === 'vendor') { setEmail('vendor@test-kitchen.com'); setPassword('vendor123') }
  }, [role])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await login(email, password)
      if (res.user.role === 'SUPER_ADMIN') {
        router.replace('/admin')
      } else if (res.user.restaurantSlug) {
        router.replace(`/vendor/${res.user.restaurantSlug}`)
      } else {
        router.replace(`/vendor/test-kitchen`)
      }
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-primary)' }}>
      {/* Background glow */}
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '300px', background: 'radial-gradient(ellipse, rgba(108,99,255,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'Outfit, sans-serif' }}>
            🍽️ QR Saas
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {role === 'admin' ? 'Super Admin Portal' : role === 'vendor' ? 'Vendor Portal' : 'Sign in to continue'}
          </p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button id="login-btn" type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: '0.5rem' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
