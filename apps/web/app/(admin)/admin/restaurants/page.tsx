'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * /admin/restaurants redirects to /admin (Dashboard) which already
 * contains the full restaurant management table. This page exists only
 * to satisfy the Next.js router so the sidebar link doesn't 404.
 */
export default function AdminRestaurantsPage() {
  const router = useRouter()

  useEffect(() => {
    // The admin dashboard page already shows the restaurant table.
    // We redirect here so the sidebar "Restaurants" link doesn't 404.
    router.replace('/admin')
  }, [router])

  return <div className="loading-spinner" />
}
