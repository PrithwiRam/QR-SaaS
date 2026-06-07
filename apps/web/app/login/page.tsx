'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    }
  }, [isAuthenticated, user, router, role])

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
        setError('No restaurant associated with this account. Contact support.')
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = role === 'admin'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: 'var(--bg-primary)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glows */}
      <div style={{ position: 'fixed', top: '10%', left: '20%', width: '500px', height: '500px', background: 'radial-gradient(ellipse, rgba(108,99,255,0.08) 0%, transparent 70%)', pointerEvents: 'none', borderRadius: '50%' }} />
      <div style={{ position: 'fixed', bottom: '10%', right: '20%', width: '400px', height: '400px', background: 'radial-gradient(ellipse, rgba(212,175,55,0.06) 0%, transparent 70%)', pointerEvents: 'none', borderRadius: '50%' }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '72px', height: '72px',
            background: 'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(212,175,55,0.2))',
            borderRadius: '20px',
            border: '1px solid rgba(212,175,55,0.25)',
            fontSize: '2rem',
            marginBottom: '1.25rem',
            boxShadow: '0 8px 32px rgba(108,99,255,0.2)',
          }}>
            🍽️
          </div>
          <div style={{
            fontSize: '2rem',
            fontWeight: 900,
            fontFamily: 'Outfit, sans-serif',
            background: 'linear-gradient(135deg, #d4af37, #f5d981, #b8962e)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.02em',
          }}>
            QR Saas
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
            {isAdmin ? '⚙️ Super Admin Portal' : '🏪 Vendor Portal'}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(26, 26, 46, 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(212,175,55,0.18)',
          borderRadius: '20px',
          padding: '2.25rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
            Sign in to your account
          </h2>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5',
              borderRadius: '10px',
              padding: '0.875rem 1rem',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label htmlFor="email" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                Email Address
              </label>
              <input
                id="email"
                type="email"
                name="qrsaas-login-email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                required
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                style={{ borderRadius: '10px' }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="qrsaas-login-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  style={{ borderRadius: '10px', paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-secondary)', fontSize: '1.1rem', padding: '0',
                    display: 'flex', alignItems: 'center', lineHeight: 1,
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              id="login-btn"
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.25rem',
                width: '100%',
                padding: '0.875rem',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #6c63ff, #8b5cf6)',
                color: 'white',
                fontWeight: 700,
                fontSize: '1rem',
                fontFamily: 'inherit',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 20px rgba(108,99,255,0.4)',
                transition: 'all 0.2s ease',
                letterSpacing: '0.01em',
              }}
            >
              {loading ? '⏳ Signing in...' : 'Sign In →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Contact your administrator for access
        </p>
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
