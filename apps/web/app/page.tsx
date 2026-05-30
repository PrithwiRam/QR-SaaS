import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: '600px' }}>
        <div className="gradient-text" style={{ fontSize: '3rem', fontWeight: 900, fontFamily: 'Outfit, sans-serif', marginBottom: '1rem' }}>
          🍽️ QR Saas
        </div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          Digital QR Ordering System
        </h1>
        <p style={{ marginBottom: '2.5rem' }}>
          Scan a QR code at the table, browse the menu, and order — no app download required.
        </p>
        <div className="flex gap-4" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login?role=vendor" className="btn btn-primary btn-lg">
            Merchant Sign In
          </Link>
          <Link href="/menu/test-kitchen" className="btn btn-secondary btn-lg">
            View Demo Menu
          </Link>
        </div>
      </div>
    </main>
  )
}
