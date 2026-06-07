import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glows */}
      <div style={{ position: 'fixed', top: '15%', left: '50%', transform: 'translateX(-50%)', width: '700px', height: '400px', background: 'radial-gradient(ellipse, rgba(212,175,55,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '10%', right: '10%', width: '500px', height: '300px', background: 'radial-gradient(ellipse, rgba(124,111,247,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '640px', position: 'relative' }}>
        {/* Logo */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '88px', height: '88px',
          background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(124,111,247,0.1))',
          borderRadius: '24px',
          border: '1px solid rgba(212,175,55,0.25)',
          fontSize: '2.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 8px 40px rgba(212,175,55,0.15)',
        }}>
          🍽️
        </div>

        <div className="gradient-text" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)', fontWeight: 900, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em', marginBottom: '1rem', lineHeight: 1 }}>
          QR Saas
        </div>
        <p style={{ fontSize: 'clamp(1rem,2vw,1.25rem)', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 500 }}>
          Premium Digital QR Ordering System
        </p>
        <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', fontSize: '0.95rem' }}>
          Scan. Browse. Order — no app download required.
        </p>

        <div className="flex gap-4" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login?role=vendor" className="btn btn-gold btn-lg">
            Merchant Sign In
          </Link>
        </div>
      </div>
    </main>
  )
}
