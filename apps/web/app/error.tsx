'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Root application error:', error)
  }, [error])

  const message = error.message || ''
  const isUnauthorized = message.includes('401') || message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('login') || message.toLowerCase().includes('session')
  const isAccessDenied = message.includes('403') || message.toLowerCase().includes('forbidden') || message.toLowerCase().includes('denied')

  let title = 'Unable to load dashboard'
  let description = 'Something went wrong while loading this page.'
  let icon = '⚠️'

  if (isUnauthorized) {
    title = 'Session expired'
    description = 'Your login session has expired or is invalid. Please sign in again.'
    icon = '🔒'
  } else if (isAccessDenied) {
    title = 'Access denied'
    description = 'You do not have permission to view this resource.'
    icon = '🚫'
  } else if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
    title = 'Network error'
    description = 'We had trouble communicating with the server. Please check your internet connection.'
    icon = '📶'
  }

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('authUser')
      window.location.href = '/login'
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary, #0f0f1b)',
      color: 'var(--text-primary, #f3f4f6)',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: 'rgba(26, 26, 46, 0.9)',
        border: '1px solid rgba(212,175,55,0.2)',
        borderRadius: '16px',
        padding: '2.5rem',
        maxWidth: '440px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem' }}>{icon}</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem', color: '#f5d981' }}>{title}</h1>
        <p style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '2rem' }}>
          {description}
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button 
            onClick={reset}
            style={{
              padding: '0.8rem',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #6c63ff, #8b5cf6)',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🔄 Try Again
          </button>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link 
              href="/"
              style={{
                flex: 1,
                padding: '0.8rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontWeight: 600,
                textAlign: 'center',
                textDecoration: 'none',
                fontSize: '0.9rem'
              }}
            >
              🏠 Go Home
            </Link>
            <button 
              onClick={handleLogout}
              style={{
                flex: 1,
                padding: '0.8rem',
                borderRadius: '8px',
                border: '1px solid rgba(239,68,68,0.2)',
                background: 'rgba(239,68,68,0.05)',
                color: '#fca5a5',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              🔓 Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
