'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

interface AuthUser {
  id: string
  email: string
  role: string
  restaurantId: string | null
  restaurantSlug: string | null
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function verifyToken() {
      const token = localStorage.getItem('accessToken')
      const storedUser = localStorage.getItem('authUser')
      if (token && storedUser) {
        try {
          // Sync state from localStorage immediately to render layout without redirecting
          const parsed = JSON.parse(storedUser) as AuthUser
          setUser(parsed)
          setAccessToken(token)
          
          // Verify in background
          const latestUser = await api.me() as AuthUser
          localStorage.setItem('authUser', JSON.stringify(latestUser))
          setUser(latestUser)
        } catch (err: any) {
          const msg = err.message || ''
          const isAuthError = msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('token')
          if (isAuthError) {
            localStorage.removeItem('accessToken')
            localStorage.removeItem('authUser')
            setAccessToken(null)
            setUser(null)
          }
        }
      }
      setLoading(false)
    }
    verifyToken()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password)
    localStorage.setItem('accessToken', res.accessToken)
    localStorage.setItem('authUser', JSON.stringify(res.user))
    setAccessToken(res.accessToken)
    setUser(res.user)
    return res
  }, [])

  const logout = useCallback(async () => {
    try { await api.logout() } catch { /* ignore */ }
    localStorage.removeItem('accessToken')
    localStorage.removeItem('authUser')
    setAccessToken(null)
    setUser(null)
    router.push('/login')
  }, [router])

  return { user, accessToken, loading, login, logout, isAuthenticated: !!accessToken }
}
