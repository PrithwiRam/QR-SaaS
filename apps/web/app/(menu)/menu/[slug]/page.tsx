import { Suspense } from 'react'
import CustomerMenuClient from './MenuClient'

const API = process.env.API_URL || 'http://localhost:4000/v1'

async function getMenuData(slug: string) {
  try {
    const res = await fetch(`${API}/menu/${slug}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const data = await getMenuData(params.slug)
  return {
    title: data ? `${data.restaurant.name} — Menu` : 'Menu',
    description: data ? `Order from ${data.restaurant.name} — scan to order at your table` : '',
  }
}

export default async function MenuPage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: { table?: string }
}) {
  const { slug } = params
  const qrToken = searchParams.table

  // Resolve QR token server-side
  let tableInfo: { tableId: string; tableNumber: number; restaurantId: string } | null = null
  if (qrToken) {
    try {
      const res = await fetch(`${API}/menu/${slug}/resolve?token=${qrToken}`, { cache: 'no-store' })
      if (res.ok) tableInfo = await res.json()
    } catch {}
  }

  // Fetch menu
  const menuData = await getMenuData(slug)

  if (!menuData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
        <div>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <h1>Restaurant Not Found</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            The restaurant &quot;{slug}&quot; doesn&apos;t exist or is currently inactive.
          </p>
        </div>
      </div>
    )
  }

  if (qrToken && !tableInfo) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
        <div>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h1>Invalid QR Code</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            This QR code is invalid or has expired. Please ask for a new QR code.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={<div className="loading-spinner" />}>
      <CustomerMenuClient
        restaurant={menuData.restaurant}
        categories={menuData.categories}
        tableId={tableInfo?.tableId || null}
        tableNumber={tableInfo?.tableNumber || null}
        qrToken={qrToken || null}
        restaurantId={menuData.restaurant.id}
      />
    </Suspense>
  )
}
